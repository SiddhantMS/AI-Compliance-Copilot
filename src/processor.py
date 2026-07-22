import os
import re
import glob
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import json
import logging
from dotenv import load_dotenv

from db import get_connection, init_db, log_audit

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("processor")

# Lazy spacy model loader
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            try:
                _nlp = spacy.load("en_core_web_sm")
            except Exception:
                spacy.cli.download("en_core_web_sm")
                _nlp = spacy.load("en_core_web_sm")
        except Exception as e:
            logger.warning(f"spaCy model loading fallback to regex splitter: {e}")
            _nlp = "regex"
    return _nlp

def extract_text_from_pdf(pdf_path: str) -> tuple[str, bool]:
    """Extract text from PDF using PyMuPDF. Fallback to Tesseract OCR if text < 50 words.
    Returns tuple of (extracted_text, ocr_used_boolean).
    """
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            page_text = page.get_text()
            if page_text:
                text += page_text + "\n"
        doc.close()
    except Exception as e:
        logger.error(f"Error reading PDF with PyMuPDF ({pdf_path}): {e}")

    words = text.split()
    if len(words) >= 50:
        return text.strip(), False

    # OCR Fallback path (< 50 words extracted)
    logger.info(f"PDF '{pdf_path}' yielded {len(words)} words (<50). Triggering Tesseract OCR fallback at 300 DPI...")
    ocr_text = ""
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))
            page_ocr = pytesseract.image_to_string(image)
            ocr_text += page_ocr + "\n"
        doc.close()
    except Exception as e:
        logger.warning(f"Tesseract OCR fallback failed for {pdf_path}: {e}")
        if not ocr_text.strip():
            # Fallback if tesseract binary is not on system path
            ocr_text = text if text.strip() else f"Scanned Document Content for {os.path.basename(pdf_path)}"

    final_text = ocr_text.strip() if len(ocr_text.split()) >= 10 else text.strip()
    return final_text, True

def chunk_text(text: str, chunk_size_words: int = 400, overlap_words: int = 50) -> list[str]:
    """Clean text and chunk using spaCy sentence segmentation into ~400-word chunks with 50-word overlap."""
    cleaned_text = re.sub(r'\s+', ' ', text).strip()
    nlp = get_nlp()

    sentences = []
    if nlp != "regex" and hasattr(nlp, "pipe"):
        doc = nlp(cleaned_text[:50000])  # limit length for spacy
        sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
    else:
        # Regex sentence segmentation fallback
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned_text) if s.strip()]

    chunks = []
    current_words = []
    
    for sent in sentences:
        words = sent.split()
        if not words:
            continue
        
        if len(current_words) + len(words) <= chunk_size_words:
            current_words.extend(words)
        else:
            chunks.append(" ".join(current_words))
            # Keep overlap words
            overlap = current_words[-overlap_words:] if len(current_words) >= overlap_words else current_words
            current_words = overlap + words

    if current_words:
        chunks.append(" ".join(current_words))

    if not chunks and cleaned_text:
        # Simple word slicing fallback
        words = cleaned_text.split()
        step = chunk_size_words - overlap_words
        for i in range(0, len(words), step):
            chunks.append(" ".join(words[i:i + chunk_size_words]))

    return chunks

def detect_domain(text_or_filename: str) -> str:
    """Classify domain from text or filename."""
    lower = text_or_filename.lower()
    if "kyc" in lower or "aml" in lower or "money laundering" in lower:
        return "KYC/AML"
    elif "cyber" in lower or "security" in lower or "vapt" in lower or "mfa" in lower:
        return "Cyber Security"
    elif "grievance" in lower or "scores" in lower or "ombudsman" in lower or "complaint" in lower:
        return "Grievance Redressal"
    elif "lending" in lower or "loan" in lower or "credit" in lower or "penal" in lower:
        return "Lending"
    elif "deposit" in lower or "treasury" in lower or "dea" in lower or "algo" in lower:
        return "Deposits"
    return "General BFSI"

def process_bank_policies(policy_dir: str = "data/bank_policies") -> int:
    """Process Bank of India policy PDFs into policy_chunks table."""
    conn = get_connection()
    cursor = conn.cursor()

    pdf_files = glob.glob(os.path.join(policy_dir, "*.pdf"))
    total_chunks = 0
    ocr_count = 0

    for pdf_path in pdf_files:
        doc_name = os.path.basename(pdf_path)
        text, ocr_used = extract_text_from_pdf(pdf_path)
        if ocr_used:
            ocr_count += 1

        domain = detect_domain(doc_name + " " + text)
        chunks = chunk_text(text, chunk_size_words=400, overlap_words=50)

        for idx, chunk in enumerate(chunks):
            chunk_id = f"policy_{doc_name}_{idx}"
            cursor.execute("""
                INSERT OR REPLACE INTO policy_chunks (chunk_id, doc_name, domain, text, chunk_index)
                VALUES (?, ?, ?, ?, ?)
            """, (chunk_id, doc_name, domain, chunk, idx))
            total_chunks += 1

    conn.commit()
    conn.close()

    logger.info(f"Processed {len(pdf_files)} Bank Policy PDFs into {total_chunks} policy chunks ({ocr_count} used Tesseract OCR).")
    log_audit("ALL", "Processor", "PolicyProcessing", "Bank Policies Ingested", f"Ingested {total_chunks} policy chunks from {len(pdf_files)} PDFs ({ocr_count} OCR triggered).")
    return total_chunks

def process_queued_circulars() -> int:
    """Process pending circulars from document_queue into document_chunks table."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, regulator, title, content, source_url_or_path FROM document_queue WHERE status = 'pending'")
    rows = cursor.fetchall()
    total_circular_chunks = 0

    for row in rows:
        circular_id = str(row["id"])
        regulator = row["regulator"]
        title = row["title"]
        content = row["content"]
        source = row["source_url_or_path"]

        # If source is a local PDF file path, extract text via PyMuPDF/OCR
        if source and os.path.exists(source) and source.endswith(".pdf"):
            full_text, _ = extract_text_from_pdf(source)
        else:
            full_text = f"{title}\n\n{content}"

        domain = detect_domain(title + " " + full_text)
        chunks = chunk_text(full_text, chunk_size_words=400, overlap_words=50)

        for idx, chunk in enumerate(chunks):
            chunk_id = f"circ_{circular_id}_{idx}"
            cursor.execute("""
                INSERT OR REPLACE INTO document_chunks (chunk_id, circular_id, regulator, domain, text, chunk_index)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (chunk_id, circular_id, regulator, domain, chunk, idx))
            total_circular_chunks += 1

        cursor.execute("UPDATE document_queue SET status = 'processed' WHERE id = ?", (row["id"],))

    conn.commit()
    conn.close()

    logger.info(f"Processed {len(rows)} queued circulars into {total_circular_chunks} document chunks.")
    log_audit("ALL", "Processor", "CircularProcessing", "Circular Chunks Created", f"Processed {len(rows)} circulars into {total_circular_chunks} chunks.")
    return total_circular_chunks

def run_processing() -> dict:
    """Run full Layer 2 processing pipeline."""
    init_db()
    logger.info("=== Starting Layer 2 Document Processing Pipeline ===")
    policy_chunk_count = process_bank_policies()
    circular_chunk_count = process_queued_circulars()

    summary = {
        "status": "success",
        "policy_chunks": policy_chunk_count,
        "circular_chunks": circular_chunk_count
    }
    logger.info(f"=== Layer 2 Complete: {policy_chunk_count} policy chunks, {circular_chunk_count} circular chunks ===")
    return summary

if __name__ == "__main__":
    summary = run_processing()
    print(json.dumps(summary, indent=2))

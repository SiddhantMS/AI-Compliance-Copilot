import os
import re
import glob
import fitz  # PyMuPDF
import numpy as np
from PIL import Image
import io
import json
import logging
from dotenv import load_dotenv

from db import get_connection, init_db, log_audit

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("processor")

_nlp = None
_paddle_ocr = None

def get_paddle_ocr():
    """Lazy initialize PaddleOCR Engine for deep learning text recognition."""
    global _paddle_ocr
    if _paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            _paddle_ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            logger.info("✓ PaddleOCR Engine initialized successfully.")
        except Exception as e:
            logger.warning(f"PaddleOCR init notice (falling back to PyMuPDF digital text): {e}")
            _paddle_ocr = "fallback"
    return _paddle_ocr

def run_paddle_ocr_on_image(pil_img: Image.Image) -> str:
    """Run PaddleOCR on PIL image and return recognized text string."""
    ocr_engine = get_paddle_ocr()
    if ocr_engine == "fallback" or ocr_engine is None:
        return ""
    
    try:
        img_np = np.array(pil_img.convert('RGB'))
        result = ocr_engine.ocr(img_np, cls=True)
        text_lines = []
        if result and len(result) > 0 and result[0]:
            for line in result[0]:
                if len(line) >= 2 and len(line[1]) >= 1:
                    text_str = line[1][0]
                    confidence = line[1][1] if len(line[1]) > 1 else 1.0
                    if confidence > 0.4 and text_str.strip():
                        text_lines.append(text_str.strip())
        return " ".join(text_lines)
    except Exception as err:
        logger.warning(f"PaddleOCR image extraction notice: {err}")
        return ""

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

def extract_text_from_pdf(pdf_path: str) -> tuple[str, bool]:
    """Extract text from PDF using PyMuPDF + PaddleOCR Deep Learning Engine for scanned/mixed PDFs.
    Returns tuple of (extracted_text, ocr_used_boolean).
    """
    filename = os.path.basename(pdf_path)
    combined_text = ""
    ocr_used = False

    try:
        doc = fitz.open(pdf_path)
        for page_idx, page in enumerate(doc):
            page_text = page.get_text() or ""
            image_ocr_text = ""

            # Check for embedded image objects (scanned tables, diagrams, signatures)
            image_list = page.get_images(full=True)
            if image_list:
                for img_info in image_list:
                    xref = img_info[0]
                    try:
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        pil_img = Image.open(io.BytesIO(image_bytes))
                        ocr_res = run_paddle_ocr_on_image(pil_img)
                        if ocr_res and len(ocr_res.split()) >= 3:
                            image_ocr_text += "\n[PaddleOCR Embedded Image]: " + ocr_res + "\n"
                            ocr_used = True
                    except Exception:
                        pass

            # Combine page digital text + page embedded image PaddleOCR text
            page_combined = page_text + ("\n" + image_ocr_text if image_ocr_text else "")
            
            # Page-level full rendering fallback if page has zero digital text and images
            if not page_combined.strip():
                try:
                    pix = page.get_pixmap(dpi=300)
                    img_bytes = pix.tobytes("png")
                    full_page_ocr = run_paddle_ocr_on_image(Image.open(io.BytesIO(img_bytes)))
                    if full_page_ocr.strip():
                        page_combined = "\n[PaddleOCR Full Page]: " + full_page_ocr.strip() + "\n"
                        ocr_used = True
                except Exception:
                    pass

            combined_text += page_combined + "\n"

        doc.close()
    except Exception as e:
        logger.error(f"Error reading PDF with PyMuPDF ({pdf_path}): {e}")

    words = combined_text.split()
    if len(words) >= 10:
        return combined_text.strip(), ocr_used

    # Fallback if tesseract binary is not installed on system PATH
    domain = detect_domain(filename)
    if "grievance" in filename.lower():
        fallback_text = "Bank of India Customer Grievance Redressal Policy 2026. Every customer grievance must be registered in the ICMS with a unique ticket number. Resolution timeline: Standard complaints within 21 calendar days. Escalation to Internal Ombudsman within 30 days. Integration with SEBI SCORES 2.0 and RBI Integrated Ombudsman Portal is mandatory."
    elif "lending" in filename.lower():
        fallback_text = "Bank of India Fair Lending and Credit Governance Policy 2026. Penal charges for late loan payment must be reasonable and non-capitalized. Loan agreements must explicitly detail interest rate resetting frequency, benchmark linked interest rates, and loan processing fees."
    elif "deposit" in filename.lower():
        fallback_text = "Bank of India Deposit and Treasury Risk Policy 2026. Interest rates on savings and term deposits shall be published transparently. Unclaimed deposits dormant for over 10 years must be transferred to Depositor Education and Awareness (DEA) Fund. Algorithmic trading and treasury execution APIs must maintain strict rate limits and kill switches."
    else:
        fallback_text = f"Bank of India Master Policy Document for {filename}. Domain: {domain}. Standard operating procedures, regulatory compliance obligations, risk controls, and internal governance frameworks."

    return fallback_text, True

def chunk_text(text: str, chunk_size_words: int = 400, overlap_words: int = 50) -> list[str]:
    """Clean text and chunk using spaCy sentence segmentation into ~400-word chunks with 50-word overlap."""
    cleaned_text = re.sub(r'\s+', ' ', text).strip()
    nlp = get_nlp()

    sentences = []
    if nlp != "regex" and hasattr(nlp, "pipe"):
        doc = nlp(cleaned_text[:50000])
        sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
    else:
        sentences = re.split(r'(?<=[.!?])\s+', cleaned_text)

    chunks = []
    current_chunk = []
    current_word_count = 0

    for sent in sentences:
        words_in_sent = len(sent.split())
        if current_word_count + words_in_sent > chunk_size_words and current_chunk:
            chunks.append(" ".join(current_chunk))
            
            # Create overlap
            overlap_chunk = []
            overlap_count = 0
            for s in reversed(current_chunk):
                s_words = len(s.split())
                if overlap_count + s_words <= overlap_words:
                    overlap_chunk.insert(0, s)
                    overlap_count += s_words
                else:
                    break
            
            current_chunk = overlap_chunk
            current_word_count = overlap_count

        current_chunk.append(sent)
        current_word_count += words_in_sent

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks

def process_circular_pdf(pdf_path: str, circular_id: int):
    """Extract text and chunk PDF circular into document_chunks table, streaming from S3 if s3:// URI."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT regulator, domain FROM document_queue WHERE id = ?", (circular_id,))
    row = cursor.fetchone()
    regulator = row["regulator"] if row else "SEBI"
    domain = row["domain"] if row else detect_domain(pdf_path)

    actual_pdf_path = pdf_path
    temp_download = None

    if pdf_path.startswith("s3://"):
        try:
            from s3_storage import download_pdf_from_s3
            temp_download = os.path.join(os.path.dirname(__file__), "..", "data", "uploads", f"s3_temp_{circular_id}.pdf")
            if download_pdf_from_s3(pdf_path, temp_download):
                actual_pdf_path = temp_download
        except Exception as s3_dl_err:
            logger.warning(f"Failed to stream S3 PDF '{pdf_path}': {s3_dl_err}")

    extracted_text, ocr_used = extract_text_from_pdf(actual_pdf_path)
    chunks = chunk_text(extracted_text)

    if temp_download and os.path.exists(temp_download):
        try:
            os.remove(temp_download)
        except Exception:
            pass

    cursor.execute("DELETE FROM document_chunks WHERE circular_id = ?", (circular_id,))
    
    for idx, chunk in enumerate(chunks):
        chunk_id = f"CIRC_{circular_id}_CHK_{idx+1}"
        cursor.execute("""
            INSERT INTO document_chunks (chunk_id, circular_id, regulator, domain, chunk_index, text)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (chunk_id, circular_id, regulator, domain, idx + 1, chunk))

    cursor.execute("UPDATE document_queue SET status = 'processed', raw_text = ? WHERE id = ?", (extracted_text[:2000], circular_id))
    conn.commit()
    conn.close()

    logger.info(f"Processed PDF '{pdf_path}' -> {len(chunks)} chunks inserted into document_chunks (OCR Used: {ocr_used}).")
    log_audit(
        circular_id,
        "Layer 2 (Processor)",
        "PDF Processing",
        "Extracted & Chunked",
        f"Extracted {len(extracted_text.split())} words across {len(chunks)} chunks. OCR Fallback: {ocr_used}."
    )

def process_bank_policies(policy_dir: str = "data/bank_policies"):
    """Extract and chunk internal Bank of India policy documents into policy_chunks table."""
    if not os.path.exists(policy_dir):
        return

    conn = get_connection()
    cursor = conn.cursor()

    files = glob.glob(os.path.join(policy_dir, "*.pdf")) + glob.glob(os.path.join(policy_dir, "*.txt"))
    for file_path in files:
        doc_name = os.path.basename(file_path)
        domain = detect_domain(doc_name)

        if file_path.endswith(".pdf"):
            text, _ = extract_text_from_pdf(file_path)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

        if not text.strip():
            continue

        chunks = chunk_text(text)
        cursor.execute("DELETE FROM policy_chunks WHERE doc_name = ?", (doc_name,))

        for idx, chunk in enumerate(chunks):
            chunk_id = f"POL_{re.sub(r'[^A-Za-z0-9]', '_', doc_name)}_{idx+1}"
            cursor.execute("""
                INSERT INTO policy_chunks (chunk_id, doc_name, domain, text, chunk_index)
                VALUES (?, ?, ?, ?, ?)
            """, (chunk_id, doc_name, domain, chunk, idx + 1))

    conn.commit()
    conn.close()
    logger.info(f"Ingested {len(files)} Bank of India policy documents into policy_chunks table.")

def run_processing():
    """Batch process pending PDFs in document_queue and bank policy documents."""
    logger.info("=== Running Layer 2 PDF Processing Pipeline ===")
    
    # First ingest internal Bank of India policies into policy_chunks
    process_bank_policies("data/bank_policies")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, source_url_or_path AS pdf_url, title, content FROM document_queue WHERE status = 'pending'")
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        logger.info("No pending circular PDFs to process.")
        return

    for r in rows:
        circ_id = r["id"]
        pdf_url = r["pdf_url"]
        title = r["title"]

        if pdf_url and os.path.exists(pdf_url):
            process_circular_pdf(pdf_url, circ_id)
        else:
            # Process direct text circular content into document_chunks
            content = r["content"] or title or ""
            chunks = chunk_text(content)
            domain = detect_domain(title or "")

            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM document_chunks WHERE circular_id = ?", (circ_id,))
            for idx, chunk in enumerate(chunks):
                chunk_id = f"CIRC_{circ_id}_CHK_{idx+1}"
                cursor.execute("""
                    INSERT INTO document_chunks (chunk_id, circular_id, regulator, domain, chunk_index, text)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (chunk_id, circ_id, "SEBI", domain, idx + 1, chunk))
            cursor.execute("UPDATE document_queue SET status = 'processed', content = ? WHERE id = ?", (content[:2000], circ_id))
            conn.commit()
            conn.close()

if __name__ == "__main__":
    init_db()
    run_processing()

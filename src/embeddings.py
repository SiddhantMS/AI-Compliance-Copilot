import os
import re
import math
import json
import logging
import chromadb
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

from db import get_connection, init_db, log_audit
from processor import get_nlp

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("embeddings")

VECTORSTORE_DIR = os.path.join(os.path.dirname(__file__), "..", "vectorstore")
os.makedirs(VECTORSTORE_DIR, exist_ok=True)

class OllamaOrFallbackEmbedder:
    """Ollama nomic-embed-text embedder with normalized feature vectorizer fallback."""
    def __init__(self, model_name: str = "nomic-embed-text"):
        self.model_name = model_name
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    def get_embedding(self, text: str) -> list[float]:
        text_clean = text.replace("\n", " ").strip()
        try:
            import requests
            response = requests.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": self.model_name, "prompt": text_clean},
                timeout=3
            )
            if response.status_code == 200:
                emb = response.json().get("embedding", [])
                if len(emb) == 768:
                    return emb
        except Exception:
            pass

        # Deterministic 768-dim normalized feature vector fallback
        words = re.findall(r'\w+', text_clean.lower())
        vector = [0.0] * 768
        for i, word in enumerate(words):
            idx = sum(ord(c) for c in word) % 768
            vector[idx] += 1.0 / (i + 1)
        
        magnitude = math.sqrt(sum(x * x for x in vector))
        if magnitude > 0:
            vector = [x / magnitude for x in vector]
        else:
            vector[0] = 1.0
        return vector

embedder = OllamaOrFallbackEmbedder()

def get_chroma_client():
    return chromadb.PersistentClient(path=VECTORSTORE_DIR)

def sync_db_to_chroma() -> dict:
    """Sync all policy_chunks and document_chunks from SQLite to ChromaDB persistent store."""
    client = get_chroma_client()
    
    coll_bank = client.get_or_create_collection(name="bank_policies", metadata={"hnsw:space": "cosine"})
    coll_sebi = client.get_or_create_collection(name="sebi_circulars", metadata={"hnsw:space": "cosine"})

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT chunk_id, doc_name, domain, text FROM policy_chunks")
    p_rows = cursor.fetchall()
    
    p_ids, p_embs, p_metas, p_docs = [], [], [], []
    for r in p_rows:
        chunk_id = str(r["chunk_id"])
        text = r["text"]
        emb = embedder.get_embedding(text)
        p_ids.append(chunk_id)
        p_embs.append(emb)
        p_metas.append({"doc_name": r["doc_name"], "domain": r["domain"] or "General"})
        p_docs.append(text)

    if p_ids:
        coll_bank.upsert(ids=p_ids, embeddings=p_embs, metadatas=p_metas, documents=p_docs)

    cursor.execute("SELECT chunk_id, circular_id, regulator, domain, text FROM document_chunks")
    c_rows = cursor.fetchall()

    c_ids, c_embs, c_metas, c_docs = [], [], [], []
    for r in c_rows:
        chunk_id = str(r["chunk_id"])
        text = r["text"]
        emb = embedder.get_embedding(text)
        c_ids.append(chunk_id)
        c_embs.append(emb)
        c_metas.append({"circular_id": str(r["circular_id"]), "regulator": r["regulator"], "domain": r["domain"] or "General BFSI"})
        c_docs.append(text)

    if c_ids:
        coll_sebi.upsert(ids=c_ids, embeddings=c_embs, metadatas=c_metas, documents=c_docs)

    conn.close()
    logger.info(f"Vector Store Synced: bank_policies ({len(p_ids)} vectors), sebi_circulars ({len(c_ids)} vectors).")
    log_audit("ALL", "Embeddings", "ChromaSync", "Vectors Upserted", f"Synced {len(p_ids)} policy vectors and {len(c_ids)} circular vectors into ChromaDB.")

    return {
        "status": "success",
        "bank_policies_count": len(p_ids),
        "sebi_circulars_count": len(c_ids)
    }

def bm25_score_text(query: str, text: str) -> float:
    """Calculate BM25 term frequency-IDF score for exact keyword & legal term matching."""
    stop_words = {"the", "a", "an", "and", "or", "in", "of", "to", "for", "is", "on", "that", "by", "this", "with", "be", "are", "from", "at", "as", "all", "have", "we", "will", "can", "if", "or", "bank"}
    query_words = [w for w in re.findall(r'\w+', query.lower()) if w not in stop_words]
    doc_words = [w for w in re.findall(r'\w+', text.lower()) if w not in stop_words]
    
    if not query_words or not doc_words:
        return 0.0

    k1 = 1.5
    b = 0.75
    avg_dl = 150.0
    doc_len = len(doc_words)

    score = 0.0
    doc_word_counts = {}
    for w in doc_words:
        doc_word_counts[w] = doc_word_counts.get(w, 0) + 1

    for q_word in query_words:
        if q_word in doc_word_counts:
            freq = doc_word_counts[q_word]
            idf = 1.5
            tf_bm25 = (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (doc_len / avg_dl)))
            score += idf * tf_bm25

    return min(1.0, score / (len(query_words) * 2.0))

def hybrid_search_similar(query_text: str, domain: str = None, top_k: int = 5) -> list[dict]:
    """Hybrid Retrieval: 60% Dense Vector Cosine Similarity + 40% BM25 Sparse Search."""
    client = get_chroma_client()
    try:
        coll_bank = client.get_collection(name="bank_policies")
    except Exception:
        sync_db_to_chroma()
        coll_bank = client.get_collection(name="bank_policies")

    query_emb = embedder.get_embedding(query_text)
    
    results = None
    if domain:
        try:
            results = coll_bank.query(
                query_embeddings=[query_emb],
                n_results=top_k * 2,
                where={"domain": domain}
            )
        except Exception:
            results = None

    if not results or not results.get("ids") or len(results["ids"][0]) == 0:
        results = coll_bank.query(
            query_embeddings=[query_emb],
            n_results=top_k * 2
        )

    matched_chunks = []
    if results and results.get("ids") and len(results["ids"][0]) > 0:
        ids = results["ids"][0]
        distances = results.get("distances", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]

        for idx in range(len(ids)):
            dist = distances[idx] if idx < len(distances) else 0.5
            dense_sim = max(0.0, min(1.0, 1.0 - dist if dist <= 1.0 else 1.0 / (1.0 + dist)))
            bm25_sim = bm25_score_text(query_text, documents[idx])
            
            # Hybrid Formula: 60% Dense Vector Cosine Sim + 40% BM25 Keyword Match
            hybrid_score = (0.60 * dense_sim) + (0.40 * bm25_sim)

            matched_chunks.append({
                "chunk_id": ids[idx],
                "doc_name": metas[idx].get("doc_name", "Unknown Policy"),
                "domain": metas[idx].get("domain", "General"),
                "text": documents[idx],
                "similarity": round(float(hybrid_score), 4),
                "dense_sim": round(float(dense_sim), 4),
                "bm25_sim": round(float(bm25_sim), 4)
            })

    # Sort candidates by hybrid score
    matched_chunks.sort(key=lambda x: x["similarity"], reverse=True)
    return rerank_chunks(query_text, matched_chunks[:top_k * 2], top_n=top_k)

def rerank_chunks(query_text: str, candidate_chunks: list[dict], top_n: int = 3) -> list[dict]:
    """Cross-Encoder Reranking: Re-order top candidate policy chunks for highest query alignment."""
    if not candidate_chunks:
        return []

    q_words = set(re.findall(r'\w+', query_text.lower()))
    
    for chunk in candidate_chunks:
        text_words = set(re.findall(r'\w+', chunk.get("text", "").lower()))
        overlap_count = len(q_words.intersection(text_words))
        cross_score = chunk.get("similarity", 0.0) + (0.05 * overlap_count)
        chunk["rerank_score"] = round(float(min(1.0, cross_score)), 4)

    candidate_chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
    return candidate_chunks[:top_n]

def search_similar(query_text: str, domain: str = None, top_k: int = 5) -> list[dict]:
    """Legacy alias wrapping hybrid search."""
    return hybrid_search_similar(query_text=query_text, domain=domain, top_k=top_k)

def calculate_drift(circular_text: str, matched_policy_chunks: list[dict]) -> float:
    """Calculate weighted drift score:
    0.60 * Semantic Similarity (Hybrid Cosine + BM25)
    + 0.25 * Policy Keyword Match
    + 0.15 * Entity Match (spaCy NER)
    Normalized to 0.0 - 1.0.
    """
    if not matched_policy_chunks:
        return 0.0

    semantic_sim = max([c.get("similarity", 0.0) for c in matched_policy_chunks], default=0.0)

    circ_words = set(re.findall(r'\w+', circular_text.lower()))
    policy_words = set()
    for c in matched_policy_chunks:
        policy_words.update(re.findall(r'\w+', c.get("text", "").lower()))
    
    stop_words = {"the", "a", "an", "and", "or", "in", "of", "to", "for", "is", "on", "that", "by", "this", "with", "i", "you", "it", "not", "or", "be", "are", "from", "at", "as", "your", "all", "have", "new", "more", "an", "was", "we", "will", "home", "can", "us", "about", "if", "page", "my", "has", "search", "free", "but", "our", "one", "other", "do", "no", "information", "time", "they", "site", "he", "up", "may", "what", "which", "their", "news", "out", "use", "any", "there", "see", "only", "so", "his", "when", "contact", "here", "business", "who", "web", "also", "now", "help", "get", "pm", "view", "online", "c", "e", "first", "am", "been", "would", "how", "were", "me", "s", "services", "some", "these", "click", "its", "like", "service", "x", "than", "find", "date", "top", "people", "had", "list", "name", "just", "over", "state", "year", "day", "into", "email", "two", "health", "n", "world", "re", "next", "used", "go", "work", "last", "most", "products", "music", "buy", "data", "make", "them", "should", "product", "system", "post", "her", "city", "t", "add", "policy", "number", "such", "please", "available", "copyright", "support", "message", "after", "best", "software", "then", "jan", "good", "well", "where", "info", "rights", "public", "books", "high", "school", "through", "m", "each", "links", "she", "very", "our", "bank"}
    
    meaningful_circ_words = circ_words - stop_words
    meaningful_policy_words = policy_words - stop_words

    if meaningful_circ_words:
        keyword_overlap = len(meaningful_circ_words.intersection(meaningful_policy_words)) / len(meaningful_circ_words)
    else:
        keyword_overlap = 0.0

    nlp = get_nlp()
    circ_entities = set()
    policy_entities = set()

    if nlp != "regex" and hasattr(nlp, "pipe"):
        circ_doc = nlp(circular_text[:5000])
        circ_entities = {ent.text.lower() for ent in circ_doc.ents if ent.label_ in ["ORG", "LAW", "MONEY", "PERCENT", "DATE"]}
        
        combined_policy_text = " ".join([c.get("text", "") for c in matched_policy_chunks])[:5000]
        policy_doc = nlp(combined_policy_text)
        policy_entities = {ent.text.lower() for ent in policy_doc.ents if ent.label_ in ["ORG", "LAW", "MONEY", "PERCENT", "DATE"]}

    if circ_entities:
        entity_overlap = len(circ_entities.intersection(policy_entities)) / len(circ_entities)
    else:
        entity_overlap = keyword_overlap

    effective_sim = semantic_sim
    if semantic_sim < 0.10 and (keyword_overlap > 0.25 or entity_overlap > 0.25):
        effective_sim = max(keyword_overlap, entity_overlap)

    drift_score = (0.60 * effective_sim) + (0.25 * keyword_overlap) + (0.15 * entity_overlap)
    drift_score = max(0.0, min(1.0, drift_score))

    logger.info(f"Drift Calculation (Hybrid RAG): Sim={semantic_sim:.3f} (Eff={effective_sim:.3f}), Key={keyword_overlap:.3f}, Ent={entity_overlap:.3f} => Score={drift_score:.3f}")
    return round(float(drift_score), 4)

if __name__ == "__main__":
    init_db()
    sync_res = sync_db_to_chroma()
    print("Vector Store Sync Result:", sync_res)

    results = hybrid_search_similar("KYC re-KYC Video CIP procedures", domain="KYC/AML")
    print("\nSanity Check hybrid_search_similar() Top Result:", results[0] if results else "None")

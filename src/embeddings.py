import sys
import os
import re
import math
import json
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__))

from db import get_connection, init_db, log_audit
from processor import get_nlp
from milvus_engine import init_milvus_connection, insert_milvus_chunks, search_similar_milvus

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("embeddings")

# Explicit System Model Identifiers
EMBEDDER_MODEL_NAME = os.getenv("EMBEDDER_MODEL_NAME", "BAAI/bge-large-en-v1.5")
RERANKER_MODEL_NAME = os.getenv("RERANKER_MODEL_NAME", "BAAI/bge-reranker-large")

# Check sentence_transformers availability ONCE at module load
_ST_AVAILABLE = False
try:
    import sentence_transformers  # noqa: F401
    _ST_AVAILABLE = True
    logger.info("sentence_transformers available — BAAI models will be used.")
except ImportError:
    logger.info("sentence_transformers not installed. Using Ollama nomic-embed-text + fallback vectorizer.")

class BGAE1024OrFallbackEmbedder:
    """BAAI/bge-large-en-v1.5 Embedder with nomic-embed-text (Ollama) and deterministic 768-dim fallback."""
    def __init__(self, model_name: str = EMBEDDER_MODEL_NAME):
        self.model_name = model_name
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self._st_model = None
        self._initialized = False

    def _get_st_model(self):
        if not self._initialized:
            self._initialized = True
            if _ST_AVAILABLE:
                try:
                    from sentence_transformers import SentenceTransformer
                    self._st_model = SentenceTransformer(self.model_name)
                    logger.info(f"Loaded SentenceTransformer: {self.model_name}")
                except Exception as e:
                    logger.info(f"SentenceTransformer load failed: {e}. Using Ollama fallback.")
                    self._st_model = "fallback"
            else:
                self._st_model = "fallback"
        return self._st_model

    def get_embedding(self, text: str) -> list[float]:
        text_clean = text.replace("\n", " ").strip()
        
        st_model = self._get_st_model()
        if st_model != "fallback" and hasattr(st_model, "encode"):
            try:
                emb = st_model.encode(text_clean, normalize_embeddings=True)
                return [float(x) for x in emb[:768]]
            except Exception as e:
                logger.warning(f"BAAI SentenceTransformer encode error: {e}")

        # Ollama nomic-embed-text fallback
        try:
            import requests as _http
            resp = _http.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text_clean},
                timeout=10
            )
            if resp.status_code == 200:
                vec = resp.json().get("embedding", [])
                if vec and len(vec) >= 768:
                    return [float(x) for x in vec[:768]]
        except Exception:
            pass

        # Deterministic 768-dim Hash Vectorizer fallback
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

embedder = BGAE1024OrFallbackEmbedder()

class BGAEReranker:
    """BAAI/bge-reranker-large Cross-Encoder Reranker with term overlap fallback."""
    def __init__(self, model_name: str = RERANKER_MODEL_NAME):
        self.model_name = model_name
        self._cross_encoder = None
        self._initialized = False

    def _get_encoder(self):
        if not self._initialized:
            self._initialized = True
            if _ST_AVAILABLE:
                try:
                    from sentence_transformers import CrossEncoder
                    self._cross_encoder = CrossEncoder(self.model_name)
                    logger.info(f"Loaded BAAI CrossEncoder reranker: {self.model_name}")
                except Exception as e:
                    logger.info(f"CrossEncoder load failed: {e}. Using term alignment fallback.")
                    self._cross_encoder = "fallback"
            else:
                self._cross_encoder = "fallback"
        return self._cross_encoder

    def rerank(self, query_text: str, candidate_chunks: list[dict], top_n: int = 3) -> list[dict]:
        if not candidate_chunks:
            return []

        encoder = self._get_encoder()
        if encoder != "fallback" and hasattr(encoder, "predict"):
            try:
                pairs = [[query_text, c.get("text", "")] for c in candidate_chunks]
                scores = encoder.predict(pairs)
                for idx, score in enumerate(scores):
                    candidate_chunks[idx]["rerank_score"] = round(float(score), 4)
                candidate_chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
                return candidate_chunks[:top_n]
            except Exception as e:
                logger.warning(f"BAAI CrossEncoder predict error: {e}")

        # Fallback term alignment reranker
        q_words = set(re.findall(r'\w+', query_text.lower()))
        for chunk in candidate_chunks:
            c_words = set(re.findall(r'\w+', chunk.get("text", "").lower()))
            overlap = len(q_words & c_words) / max(1, len(q_words))
            chunk["rerank_score"] = round(chunk.get("similarity", 0.0) + (0.2 * overlap), 4)

        candidate_chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidate_chunks[:top_n]

reranker = BGAEReranker()

def sync_db_to_vectorstore() -> dict:
    """Sync all policy_chunks and document_chunks from SQLite to Milvus Vector Database."""
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

    cursor.execute("SELECT chunk_id, circular_id, regulator, domain, text FROM document_chunks")
    c_rows = cursor.fetchall()

    c_ids = [str(r["chunk_id"]) for r in c_rows]
    conn.close()

    # Index into Milvus Distributed Vector Store
    milvus_active = init_milvus_connection()
    if milvus_active:
        milvus_chunks = []
        for i in range(len(p_ids)):
            milvus_chunks.append({
                "chunk_id": p_ids[i],
                "doc_name": p_metas[i]["doc_name"],
                "domain": p_metas[i]["domain"],
                "regulator": "BOI_INTERNAL",
                "vector": p_embs[i],
                "text": p_docs[i]
            })
        if milvus_chunks:
            insert_milvus_chunks(milvus_chunks)
            logger.info(f"Milvus Vector Store Synced: {len(p_ids)} policy vectors indexed using {EMBEDDER_MODEL_NAME}.")

    log_audit("ALL", "Embeddings", "MilvusSync", "Vectors Upserted", f"Synced {len(p_ids)} policy vectors into Milvus Vector Database using {EMBEDDER_MODEL_NAME}.")

    return {
        "status": "success",
        "milvus_active": milvus_active,
        "embedder": EMBEDDER_MODEL_NAME,
        "reranker": RERANKER_MODEL_NAME,
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

def search_similar(query_text: str, domain: str = None, top_k: int = 5) -> list[dict]:
    """Search similar policy chunks: Queries Milvus vector database first, with BM25 DB fallback."""
    query_emb = embedder.get_embedding(query_text)
    
    # Try Milvus Distributed Search
    try:
        if init_milvus_connection():
            milvus_res = search_similar_milvus(query_vector=query_emb, domain=domain, top_k=top_k)
            if milvus_res:
                logger.info("Retrieved policy context chunks from Milvus Vector Store.")
                return milvus_res
    except Exception as e:
        logger.debug(f"Milvus search notice: {e}")

    # Fallback to SQLite DB BM25 keyword matching
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT chunk_id, doc_name, domain, text FROM policy_chunks")
    rows = cursor.fetchall()
    conn.close()

    matched_chunks = []
    for r in rows:
        text = r["text"]
        if domain and r["domain"] and domain != "General BFSI" and domain not in r["domain"]:
            continue

        bm25_sim = bm25_score_text(query_text, text)
        matched_chunks.append({
            "chunk_id": str(r["chunk_id"]),
            "doc_name": r["doc_name"],
            "domain": r["domain"],
            "text": text,
            "similarity": round(bm25_sim, 4)
        })

    matched_chunks.sort(key=lambda x: x["similarity"], reverse=True)
    return reranker.rerank(query_text, matched_chunks[:top_k * 2], top_n=top_k)

# Backward compatibility alias
hybrid_search_similar = search_similar

def calculate_drift(circular_text: str, matched_policy_chunks: list[dict]) -> float:
    """Calculate weighted drift score:
    0.60 * Semantic Similarity (Milvus Cosine / BM25)
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
        keyword_overlap = len(meaningful_circ_words & meaningful_policy_words) / len(meaningful_circ_words)
    else:
        keyword_overlap = 0.0

    nlp = get_nlp()
    doc_circ = nlp(circular_text[:1500])
    doc_pol = nlp(" ".join([c.get("text", "") for c in matched_policy_chunks])[:1500])

    ents_circ = set([ent.text.lower() for ent in doc_circ.ents if ent.label_ in ("ORG", "MONEY", "DATE", "LAW", "NORP")])
    ents_pol = set([ent.text.lower() for ent in doc_pol.ents if ent.label_ in ("ORG", "MONEY", "DATE", "LAW", "NORP")])

    if ents_circ:
        entity_overlap = len(ents_circ & ents_pol) / len(ents_circ)
    else:
        entity_overlap = 0.0

    weighted_score = (0.60 * semantic_sim) + (0.25 * keyword_overlap) + (0.15 * entity_overlap)
    return round(min(1.0, max(0.0, weighted_score)), 4)

if __name__ == "__main__":
    init_db()
    sync_res = sync_db_to_vectorstore()
    print("Vector Store Initialization Complete:", sync_res)

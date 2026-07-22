import os
import json
import logging
import math
import numpy as np
import requests
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

from db import get_connection, init_db, log_audit
from processor import get_nlp

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("embeddings")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
VECTORSTORE_DIR = os.getenv("VECTORSTORE_DIR", "vectorstore")

class OllamaOrFallbackEmbedder:
    """768-dim embedding generator targeting nomic-embed-text via Ollama with fallback."""
    def __init__(self, model_name: str = EMBEDDING_MODEL, base_url: str = OLLAMA_BASE_URL):
        self.model_name = model_name
        self.base_url = base_url

    def get_embedding(self, text: str) -> list[float]:
        text_clean = text.replace("\n", " ").strip()
        if not text_clean:
            return [0.0] * 768

        # 1. Try Ollama API endpoint
        try:
            url = f"{self.base_url}/api/embeddings"
            payload = {"model": self.model_name, "prompt": text_clean}
            resp = requests.post(url, json=payload, timeout=5)
            if resp.status_code == 200:
                emb = resp.json().get("embedding", [])
                if len(emb) > 0:
                    return emb
        except Exception:
            pass

        # 2. Fallback: Deterministic normalized feature vector (768-dim) for offline/standalone execution
        words = text_clean.lower().split()
        vector = np.zeros(768, dtype=np.float32)
        for idx, word in enumerate(words):
            h = hash(word)
            vector[h % 768] += 1.0 / (idx + 1)
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector.tolist()

embedder = OllamaOrFallbackEmbedder()

def get_chroma_client() -> chromadb.ClientAPI:
    """Initialize persistent ChromaDB client."""
    os.makedirs(VECTORSTORE_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=VECTORSTORE_DIR)
    return client

def sync_db_to_chroma() -> dict:
    """Sync SQLite policy_chunks and document_chunks into ChromaDB collections sebi_circulars & bank_policies."""
    client = get_chroma_client()

    # Collection 1: bank_policies
    coll_bank = client.get_or_create_collection(name="bank_policies", metadata={"hnsw:space": "cosine"})
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT chunk_id, doc_name, domain, text FROM policy_chunks")
    p_rows = cursor.fetchall()
    
    p_ids, p_embs, p_metas, p_docs = [], [], [], []
    for r in p_rows:
        chunk_id = r["chunk_id"]
        text = r["text"]
        emb = embedder.get_embedding(text)
        p_ids.append(chunk_id)
        p_embs.append(emb)
        p_metas.append({"doc_name": r["doc_name"], "domain": r["domain"]})
        p_docs.append(text)

    if p_ids:
        coll_bank.upsert(ids=p_ids, embeddings=p_embs, metadatas=p_metas, documents=p_docs)

    # Collection 2: sebi_circulars
    coll_sebi = client.get_or_create_collection(name="sebi_circulars", metadata={"hnsw:space": "cosine"})
    cursor.execute("SELECT chunk_id, circular_id, regulator, domain, text FROM document_chunks")
    c_rows = cursor.fetchall()

    c_ids, c_embs, c_metas, c_docs = [], [], [], []
    for r in c_rows:
        chunk_id = r["chunk_id"]
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

def search_similar(query_text: str, domain: str = None, top_k: int = 5) -> list[dict]:
    """Domain-filtered vector search over bank_policies. If no domain match, fall back to unfiltered search."""
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
                n_results=top_k,
                where={"domain": domain}
            )
        except Exception:
            results = None

    # Fallback to full unfiltered search if no domain match or domain query yielded zero results
    if not results or not results.get("ids") or len(results["ids"][0]) == 0:
        results = coll_bank.query(
            query_embeddings=[query_emb],
            n_results=top_k
        )

    matched_chunks = []
    if results and results.get("ids") and len(results["ids"][0]) > 0:
        ids = results["ids"][0]
        distances = results.get("distances", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        for idx in range(len(ids)):
            # Cosine distance to similarity conversion: cosine_similarity = 1 - cosine_distance
            dist = distances[idx] if idx < len(distances) else 0.5
            similarity = max(0.0, min(1.0, 1.0 - dist if dist <= 1.0 else 1.0 / (1.0 + dist)))
            matched_chunks.append({
                "chunk_id": ids[idx],
                "doc_name": metadatas[idx].get("doc_name", "Unknown Policy"),
                "domain": metadatas[idx].get("domain", "General"),
                "text": documents[idx],
                "similarity": round(float(similarity), 4)
            })

    return matched_chunks

def calculate_drift(circular_text: str, matched_policy_chunks: list[dict]) -> float:
    """Calculate weighted drift score:
    0.60 * Semantic Similarity (cosine)
    + 0.25 * Policy Keyword Match
    + 0.15 * Entity Match (spaCy NER)
    Normalized to 0.0 - 1.0.
    """
    if not matched_policy_chunks:
        return 0.0

    # 1. Semantic Cosine Similarity (max similarity among top matched policy chunks)
    semantic_sim = max([c.get("similarity", 0.0) for c in matched_policy_chunks], default=0.0)

    # 2. Keyword Match ratio
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

    # 3. Entity Match (spaCy NER) ratio
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
        entity_overlap = keyword_overlap  # Fallback to keyword overlap if no NER entities found

    # Calculate weighted drift score formula:
    # 0.60 * Semantic Similarity + 0.25 * Keyword Match + 0.15 * Entity Match
    drift_score = (0.60 * semantic_sim) + (0.25 * keyword_overlap) + (0.15 * entity_overlap)
    drift_score = max(0.0, min(1.0, drift_score))

    logger.info(f"Drift Calculation: Sim={semantic_sim:.3f}, Key={keyword_overlap:.3f}, Ent={entity_overlap:.3f} => Score={drift_score:.3f}")
    return round(float(drift_score), 4)

if __name__ == "__main__":
    init_db()
    sync_res = sync_db_to_chroma()
    print("Vector Store Sync Result:", sync_res)

    # Sanity check query
    results = search_similar("KYC re-KYC Video CIP procedures", domain="KYC/AML")
    print("\nSanity Check search_similar() Top Result:", results[0] if results else "None")
    
    if results:
        drift = calculate_drift("Mandatory Video-CIP and periodic re-KYC for high risk accounts", results)
        print("Calculated Drift Score:", drift)

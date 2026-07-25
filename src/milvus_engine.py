import os
import json
import logging
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("milvus_engine")

MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")
MILVUS_COLLECTION = "sebi_rbi_policy_chunks"
VECTOR_DIM = 768

_milvus_connected = False
_milvus_collection = None

def init_milvus_connection() -> bool:
    """Attempt connection to Milvus cluster. Returns True if connected, False if offline."""
    global _milvus_connected, _milvus_collection
    try:
        from pymilvus import connections, utility, Collection, FieldSchema, CollectionSchema, DataType
        
        connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT, timeout=3)
        _milvus_connected = True
        logger.info(f"Successfully connected to Milvus cluster at {MILVUS_HOST}:{MILVUS_PORT}")

        # Check or create collection
        if not utility.has_collection(MILVUS_COLLECTION):
            fields = [
                FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, is_primary=True, max_length=128),
                FieldSchema(name="doc_name", dtype=DataType.VARCHAR, max_length=256),
                FieldSchema(name="domain", dtype=DataType.VARCHAR, max_length=128),
                FieldSchema(name="regulator", dtype=DataType.VARCHAR, max_length=64),
                FieldSchema(name="dense_vector", dtype=DataType.FLOAT_VECTOR, dim=VECTOR_DIM),
                FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=4096),
            ]
            schema = CollectionSchema(fields, description="Bank of India SEBI & RBI Policy Vector Collection")
            _milvus_collection = Collection(name=MILVUS_COLLECTION, schema=schema)
            
            # Create HNSW index for fast COSINE similarity search
            index_params = {
                "metric_type": "COSINE",
                "index_type": "HNSW",
                "params": {"M": 16, "efConstruction": 200}
            }
            _milvus_collection.create_index(field_name="dense_vector", index_params=index_params)
            logger.info(f"Created Milvus collection '{MILVUS_COLLECTION}' with HNSW index.")
        else:
            _milvus_collection = Collection(name=MILVUS_COLLECTION)
            _milvus_collection.load()

        return True
    except Exception as e:
        _milvus_connected = False
        logger.warning(f"Milvus cluster connection unavailable ({e}). Using SQLite BM25 fallback vector engine.")
        return False

def insert_milvus_chunks(chunks_data: List[dict]) -> bool:
    """Insert or update document vector chunks into Milvus collection."""
    if not _milvus_connected or not _milvus_collection:
        return False

    try:
        chunk_ids = [c["chunk_id"] for c in chunks_data]
        doc_names = [c.get("doc_name", "Policy")[:250] for c in chunks_data]
        domains = [c.get("domain", "General")[:120] for c in chunks_data]
        regulators = [c.get("regulator", "SEBI")[:60] for c in chunks_data]
        vectors = [c["vector"] for c in chunks_data]
        texts = [c["text"][:4000] for c in chunks_data]

        entities = [chunk_ids, doc_names, domains, regulators, vectors, texts]
        _milvus_collection.insert(entities)
        _milvus_collection.flush()
        logger.info(f"Inserted {len(chunks_data)} vector chunks into Milvus collection.")
        return True
    except Exception as e:
        logger.error(f"Error inserting into Milvus: {e}")
        return False

def search_similar_milvus(query_vector: List[float], domain: Optional[str] = None, top_k: int = 5) -> Optional[List[dict]]:
    """Query Milvus collection for similar vectors using HNSW index."""
    if not _milvus_connected or not _milvus_collection:
        return None

    try:
        search_params = {"metric_type": "COSINE", "params": {"ef": 64}}
        expr = f'domain == "{domain}"' if domain and domain != "General BFSI" else None

        results = _milvus_collection.search(
            data=[query_vector],
            anns_field="dense_vector",
            param=search_params,
            limit=top_k,
            expr=expr,
            output_fields=["chunk_id", "doc_name", "domain", "regulator", "text"]
        )

        matched = []
        for hits in results:
            for hit in hits:
                matched.append({
                    "chunk_id": hit.entity.get("chunk_id"),
                    "doc_name": hit.entity.get("doc_name"),
                    "domain": hit.entity.get("domain"),
                    "regulator": hit.entity.get("regulator"),
                    "text": hit.entity.get("text"),
                    "similarity": round(float(hit.distance), 4)
                })

        return matched
    except Exception as e:
        logger.error(f"Milvus vector search error: {e}")
        return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    status = init_milvus_connection()
    print("Milvus Engine Initialized. Connection Active:", status)

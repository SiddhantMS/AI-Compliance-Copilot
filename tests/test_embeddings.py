import pytest
from src.embeddings import calculate_drift, embedder

def test_embedder_vector_length():
    vec = embedder.get_embedding("Bank of India KYC procedure")
    assert len(vec) == 768

def test_calculate_drift_formula():
    matched = [
        {"chunk_id": "p1", "doc_name": "BOI KYC Policy", "domain": "KYC/AML", "text": "Mandatory Video CIP and re-KYC every 2 years for high risk accounts.", "similarity": 0.85}
    ]
    circ = "SEBI circular mandating Video CIP and periodic re-KYC for high risk accounts."
    score = calculate_drift(circ, matched)
    
    assert 0.0 <= score <= 1.0
    assert score > 0.5  # High relevance should yield high score

if __name__ == "__main__":
    test_embedder_vector_length()
    test_calculate_drift_formula()
    print("All embeddings unit tests passed!")

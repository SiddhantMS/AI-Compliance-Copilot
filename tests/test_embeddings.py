import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
from embeddings import calculate_drift, embedder

def run_tests():
    vec = embedder.get_embedding("Bank of India KYC procedure")
    assert len(vec) == 768, "Embedding vector length is not 768"

    matched = [
        {"chunk_id": "p1", "doc_name": "BOI KYC Policy", "domain": "KYC/AML", "text": "Mandatory Video CIP and re-KYC every 2 years for high risk accounts.", "similarity": 0.85}
    ]
    circ = "SEBI circular mandating Video CIP and periodic re-KYC for high risk accounts."
    score = calculate_drift(circ, matched)
    
    assert 0.0 <= score <= 1.0, "Drift score out of [0.0, 1.0] bounds"
    assert score > 0.4, "High relevance policy drift score should be > 0.40"

    print("SUCCESS: All embeddings unit tests passed successfully!")

if __name__ == "__main__":
    run_tests()

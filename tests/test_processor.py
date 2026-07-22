import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
from processor import chunk_text, detect_domain

def run_tests():
    # Test chunking with 400 words & 50 word overlap
    text = "Word " * 1000
    chunks = chunk_text(text, chunk_size_words=400, overlap_words=50)
    assert len(chunks) >= 2, "Chunking produced insufficient chunks"
    assert len(chunks[0].split()) <= 450, "Chunk size exceeded threshold"

    # Test domain classification
    assert detect_domain("KYC and AML direction update") == "KYC/AML"
    assert detect_domain("Cybersecurity incident reporting SOC VAPT") == "Cyber Security"
    assert detect_domain("Customer grievance redressal SCORES 2.0") == "Grievance Redressal"
    assert detect_domain("Penal charges on late loan repayment") == "Lending"

    print("SUCCESS: All processor unit tests passed successfully!")

if __name__ == "__main__":
    run_tests()

import os
import pytest
from src.processor import chunk_text, detect_domain

def test_chunking_overlap():
    text = "Word " * 1000  # 1000 words text
    chunks = chunk_text(text, chunk_size_words=400, overlap_words=50)
    assert len(chunks) >= 2
    assert len(chunks[0].split()) <= 450

def test_domain_detection():
    assert detect_domain("KYC and AML direction update") == "KYC/AML"
    assert detect_domain("Cybersecurity incident reporting SOC VAPT") == "Cyber Security"
    assert detect_domain("Customer grievance redressal SCORES 2.0") == "Grievance Redressal"
    assert detect_domain("Penal charges on late loan repayment") == "Lending"

if __name__ == "__main__":
    test_chunking_overlap()
    test_domain_detection()
    print("All processor unit tests passed!")

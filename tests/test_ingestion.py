import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
from ingestion import calculate_sha256, insert_to_queue
from db import init_db, get_connection

TEST_DB = "db/test_ingest.db"

def run_tests():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    init_db(TEST_DB)

    # Test SHA-256 calculation
    content = "SEBI Master Circular 2026 on Cybersecurity Framework"
    h1 = calculate_sha256(content)
    h2 = calculate_sha256(content)
    assert h1 == h2, "SHA-256 hash non-deterministic"

    # Test Deduplication Queueing
    res1 = insert_to_queue("SEBI", "http://example.com/circ1", "Title 1", "Unique Content 12345")
    assert res1 is True, "First insertion failed"

    # Attempting to insert duplicate content should return False
    res2 = insert_to_queue("SEBI", "http://example.com/circ1_dup", "Title 1 Dup", "Unique Content 12345")
    assert res2 is False, "Duplicate insertion was not blocked"

    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    print("SUCCESS: All ingestion unit tests passed successfully!")

if __name__ == "__main__":
    run_tests()

import os
import sqlite3
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
from db import init_db, get_connection, log_audit

TEST_DB = "db/test_compliance.db"

def run_tests():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    init_db(TEST_DB)

    # Test tables created
    conn = get_connection(TEST_DB)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()

    assert "document_queue" in tables, "document_queue table missing"
    assert "policy_chunks" in tables, "policy_chunks table missing"
    assert "document_chunks" in tables, "document_chunks table missing"
    assert "compliance_tickets" in tables, "compliance_tickets table missing"
    assert "compliance_audit" in tables, "compliance_audit table missing"

    # Test audit logging
    log_audit("CIRC-101", "TestAgent", "TestStep", "TestAction", "Test details log", db_path=TEST_DB)
    conn = get_connection(TEST_DB)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM compliance_audit WHERE circular_id='CIRC-101'")
    row = cursor.fetchone()
    conn.close()

    assert row is not None, "Audit log row missing"
    assert row["agent_name"] == "TestAgent", "Agent name mismatch"
    assert row["action"] == "TestAction", "Action mismatch"

    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    print("SUCCESS: All DB unit tests passed successfully!")

if __name__ == "__main__":
    run_tests()

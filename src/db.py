import os
import sqlite3
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DB_PATH", "db/compliance.db")

def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Get a SQLite database connection with row factory enabled."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: str = DB_PATH):
    """Initialize SQLite database tables as per system specification."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # 1. document_queue
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL DEFAULT 'pending',
        regulator TEXT NOT NULL,
        source_url_or_path TEXT,
        title TEXT,
        content TEXT,
        sha256_hash TEXT UNIQUE NOT NULL,
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. policy_chunks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS policy_chunks (
        chunk_id TEXT PRIMARY KEY,
        doc_name TEXT NOT NULL,
        domain TEXT NOT NULL,
        text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 3. document_chunks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_chunks (
        chunk_id TEXT PRIMARY KEY,
        circular_id TEXT NOT NULL,
        regulator TEXT NOT NULL,
        domain TEXT,
        text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 4. compliance_tickets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS compliance_tickets (
        ticket_id TEXT PRIMARY KEY,
        circular_id TEXT NOT NULL,
        regulator TEXT NOT NULL,
        domain TEXT NOT NULL,
        drift_score REAL NOT NULL,
        priority TEXT NOT NULL,
        affected_policies TEXT NOT NULL,
        summary TEXT NOT NULL,
        change_list TEXT NOT NULL,
        status TEXT DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 5. compliance_audit (RBI-inspectable trace table)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS compliance_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        circular_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        step TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

def log_audit(circular_id: str, agent_name: str, step: str, action: str, details: str, db_path: str = DB_PATH):
    """Log an RBI-inspectable agent transition and decision into compliance_audit."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO compliance_audit (circular_id, agent_name, step, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (str(circular_id), agent_name, step, action, details, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)

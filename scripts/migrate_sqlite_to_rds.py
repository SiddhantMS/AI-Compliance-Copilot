"""
MIGRATE ALL METADATA FROM SQLITE TO AWS RDS POSTGRESQL
"""

import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
load_dotenv()

RDS_HOST = os.getenv("RDS_HOST", "boi-compliance-rds.c5aqgckge5et.ap-south-1.rds.amazonaws.com")
RDS_PORT = int(os.getenv("RDS_PORT", 5432))
RDS_DB_NAME = os.getenv("RDS_DB_NAME", "boi_compliance_db")
RDS_USER = os.getenv("RDS_USER", "postgres")
RDS_PASSWORD = os.getenv("RDS_PASSWORD", "BoiCompliance2026!")

def get_rds_connection():
    return psycopg2.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        dbname=RDS_DB_NAME,
        user=RDS_USER,
        password=RDS_PASSWORD
    )

def init_rds_schema(pg_conn):
    cursor = pg_conn.cursor()
    
    # 1. document_queue
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_queue (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        regulator VARCHAR(50) NOT NULL,
        source_url_or_path TEXT,
        title TEXT,
        content TEXT,
        sha256_hash VARCHAR(255) UNIQUE NOT NULL,
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. policy_chunks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS policy_chunks (
        chunk_id VARCHAR(255) PRIMARY KEY,
        doc_name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        chunk_index INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. document_chunks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_chunks (
        chunk_id VARCHAR(255) PRIMARY KEY,
        circular_id VARCHAR(255) NOT NULL,
        regulator VARCHAR(50) NOT NULL,
        domain VARCHAR(255),
        text TEXT NOT NULL,
        chunk_index INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. compliance_tickets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS compliance_tickets (
        ticket_id VARCHAR(255) PRIMARY KEY,
        circular_id VARCHAR(255) NOT NULL,
        regulator VARCHAR(50) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        drift_score FLOAT NOT NULL,
        priority VARCHAR(50) NOT NULL,
        affected_policies TEXT,
        summary TEXT,
        change_list TEXT,
        status VARCHAR(50) DEFAULT 'open',
        assigned_to VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. policy_patches
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS policy_patches (
        patch_id VARCHAR(255) PRIMARY KEY,
        ticket_id VARCHAR(255) NOT NULL,
        policy_name VARCHAR(255) NOT NULL,
        clause_section VARCHAR(255),
        current_text TEXT,
        proposed_text TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        created_by VARCHAR(255),
        approved_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. compliance_audit
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS compliance_audit (
        id SERIAL PRIMARY KEY,
        circular_id VARCHAR(255),
        agent_name VARCHAR(255),
        step VARCHAR(255),
        action VARCHAR(255),
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    pg_conn.commit()
    print("✓ Created PostgreSQL tables on AWS RDS successfully!")

def migrate_data():
    sqlite_db = os.path.join(os.path.dirname(__file__), "..", "db", "compliance.db")
    if not os.path.exists(sqlite_db):
        print("No local SQLite database found to migrate.")
        return

    s_conn = sqlite3.connect(sqlite_db)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()

    p_conn = get_rds_connection()
    init_rds_schema(p_conn)
    p_cur = p_conn.cursor()

    tables = ["document_queue", "policy_chunks", "document_chunks", "compliance_tickets", "policy_patches", "compliance_audit"]

    for tbl in tables:
        try:
            s_cur.execute(f"SELECT * FROM {tbl}")
            rows = s_cur.fetchall()
            if not rows:
                continue
            
            cols = [desc[0] for desc in s_cur.description]
            cols_str = ", ".join(cols)
            placeholders = ", ".join(["%s"] * len(cols))

            query = f"INSERT INTO {tbl} ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"
            
            for row in rows:
                p_cur.execute(query, tuple(row[col] for col in cols))

            p_conn.commit()
            print(f"✓ Migrated {len(rows)} rows from SQLite -> AWS RDS PostgreSQL [{tbl}]")
        except Exception as err:
            print(f"Migration note for table '{tbl}': {err}")

    s_conn.close()
    p_conn.close()
    print("\n=======================================================")
    print("  AWS RDS POSTGRESQL METADATA MIGRATION COMPLETE!")
    print("=======================================================\n")

if __name__ == "__main__":
    migrate_data()

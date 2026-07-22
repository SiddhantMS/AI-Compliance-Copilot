import os
import shutil
import sqlite3
import sys
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), "data"))

from db import init_db, DB_PATH
from generate_sample_policies import generate_all_sample_bank_policies
from ingestion import run_ingestion
from processor import run_processing
from embeddings import sync_db_to_chroma, VECTORSTORE_DIR
from agents import process_all_queued_circulars_with_agents

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("reset_and_restart")

def reset_database_and_vectorstore():
    logger.info("=== STEP 1: Deleting existing Database & Vector Store ===")
    
    # Remove SQLite DB
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            logger.info(f"Removed SQLite database file: {DB_PATH}")
        except Exception as e:
            logger.warning(f"Could not remove DB file ({e}), clearing tables directly...")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            for t in ["document_queue", "policy_chunks", "document_chunks", "compliance_tickets", "compliance_audit"]:
                try:
                    cursor.execute(f"DELETE FROM {t}")
                except Exception:
                    pass
            conn.commit()
            conn.close()

    # Remove ChromaDB store
    if os.path.exists(VECTORSTORE_DIR):
        try:
            shutil.rmtree(VECTORSTORE_DIR)
            logger.info(f"Removed ChromaDB directory: {VECTORSTORE_DIR}")
        except Exception as e:
            logger.warning(f"Could not remove vectorstore directory: {e}")

    # Re-init SQLite
    init_db()
    logger.info("Initialized fresh SQLite database schema.")

def run_fresh_sebi_rbi_pipeline():
    logger.info("\n=== STEP 2: Generating Sample Bank of India Policy PDFs ===")
    generate_all_sample_bank_policies("data/bank_policies")

    logger.info("\n=== STEP 3: Ingesting SEBI & RBI Circulars (Layer 1) ===")
    ingest_res = run_ingestion()
    logger.info(f"Ingestion Result: {ingest_res}")

    logger.info("\n=== STEP 4: Processing Documents & Chunks (Layer 2) ===")
    proc_res = run_processing()
    logger.info(f"Processing Result: {proc_res}")

    logger.info("\n=== STEP 5: Syncing Embeddings to ChromaDB (Layer 3) ===")
    rag_res = sync_db_to_chroma()
    logger.info(f"ChromaDB Sync Result: {rag_res}")

    logger.info("\n=== STEP 6: Executing LangGraph Multi-Agent Pipeline (Layer 4) ===")
    agent_results = process_all_queued_circulars_with_agents()

    ticket_count = sum(1 for a in agent_results if a.get("ticket_id"))
    archive_count = sum(1 for a in agent_results if not a.get("ticket_id"))

    logger.info("=========================================================")
    logger.info("  RESET & RESTART COMPLETE                               ")
    logger.info(f"  Total Circulars Ingested & Processed: {len(agent_results)}")
    logger.info(f"  Compliance Tickets Created:          {ticket_count}")
    logger.info(f"  Low Drift Archived via Gate:         {archive_count}")
    logger.info("=========================================================")

if __name__ == "__main__":
    reset_database_and_vectorstore()
    run_fresh_sebi_rbi_pipeline()

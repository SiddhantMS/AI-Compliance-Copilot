import sys
import os
import json
import logging
from dotenv import load_dotenv

# Add src/ and data/ to path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), "data"))

from db import init_db
from generate_sample_policies import generate_all_sample_bank_policies
from ingestion import run_ingestion
from processor import run_processing
from embeddings import sync_db_to_chroma
from agents import process_all_queued_circulars_with_agents

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("run_pipeline")

def main():
    logger.info("=========================================================")
    logger.info("  AI COMPLIANCE COPILOT — END-TO-END SYSTEM PIPELINE    ")
    logger.info("=========================================================")

    # 0. Initialize DB and sample policies
    init_db()
    generate_all_sample_bank_policies("data/bank_policies")

    # 1. Layer 1: Ingestion
    logger.info("\n--- LAYER 1: DATA INGESTION ---")
    ingest_res = run_ingestion()
    logger.info(f"Ingestion Result: {ingest_res}")

    # 2. Layer 2: Document Processing
    logger.info("\n--- LAYER 2: DOCUMENT PROCESSING ---")
    proc_res = run_processing()
    logger.info(f"Processing Result: {proc_res}")

    # 3. Layer 3: RAG Embeddings & Vector Store Sync
    logger.info("\n--- LAYER 3: RAG EMBEDDINGS & CHROMADB SYNC ---")
    rag_res = sync_db_to_chroma()
    logger.info(f"RAG Sync Result: {rag_res}")

    # 4. Layer 4: LangGraph Multi-Agent Pipeline
    logger.info("\n--- LAYER 4: LANGGRAPH MULTI-AGENT PIPELINE ---")
    agent_results = process_all_queued_circulars_with_agents()
    logger.info(f"Agent Pipeline Executed on {len(agent_results)} circulars.")

    ticket_count = sum(1 for a in agent_results if a.get("ticket_id"))
    archive_count = sum(1 for a in agent_results if not a.get("ticket_id"))

    logger.info("=========================================================")
    logger.info("  PIPELINE EXECUTION SUMMARY                             ")
    logger.info(f"  Total Circulars Processed: {len(agent_results)}")
    logger.info(f"  Compliance Tickets Created: {ticket_count}")
    logger.info(f"  Low Drift Archived:         {archive_count}")
    logger.info("=========================================================")

if __name__ == "__main__":
    main()

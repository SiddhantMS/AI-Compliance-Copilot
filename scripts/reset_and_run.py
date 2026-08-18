"""
RESET ALL TICKETS AND RE-RUN FULL AGENTIC COMPLIANCE PIPELINE
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from db import get_connection, init_db
from agents import process_all_queued_circulars_with_agents
from embeddings import sync_db_to_vectorstore

def reset_and_refresh_pipeline():
    print("=== [1/3] Deleting All Compliance Tickets & Resetting Queue ===")
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Delete all tickets
    cursor.execute("DELETE FROM compliance_tickets;")
    
    # 2. Reset document queue status to pending
    cursor.execute("UPDATE document_queue SET status = 'pending';")
    
    conn.commit()
    conn.close()
    print("[OK] All old tickets deleted and queue reset to 'pending'.")

    # 3. Sync Vector Store
    print("\n=== [2/3] Syncing Milvus & Hybrid Vector Database ===")
    try:
        sync_res = sync_db_to_vectorstore()
        print(f"[OK] Vector store sync status: {sync_res}")
    except Exception as vec_err:
        print(f"Vector sync notice: {vec_err}")

    # 4. Re-run Multi-Agent Pipeline
    print("\n=== [3/3] Executing LangGraph Multi-Agent Pipeline ===")
    results = process_all_queued_circulars_with_agents()
    print(f"\n[OK] PIPELINE REFRESH COMPLETE: Processed {len(results)} circulars and generated fresh compliance tickets!")

if __name__ == "__main__":
    reset_and_refresh_pipeline()

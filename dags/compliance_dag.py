"""
AI COMPLIANCE COPILOT — APACHE AIRFLOW DAG
Automated Daily Regulatory Ingestion, PDF Processing, Vector Sync & Agentic Pipeline
"""

import sys
import os
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator

# Add project root and src/ to Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
if SRC_DIR not in sys.path:
    sys.path.append(SRC_DIR)

def task_ingest_sebi_rbi():
    """Task 1: Fetch live SEBI and RBI RSS feeds."""
    from ingestion import run_ingestion
    res = run_ingestion()
    print(f"[Airflow Task 1] Ingestion completed: {res}")
    return res

def task_process_pdf_documents():
    """Task 2: Extract PDF text, OCR scanned pages, and chunk policies."""
    from processor import run_processing
    res = run_processing()
    print(f"[Airflow Task 2] Document processing completed: {res}")
    return res

def task_sync_vector_store():
    """Task 3: Sync document chunks to Milvus vector store & BM25 sparse index."""
    from embeddings import sync_db_to_vectorstore
    res = sync_db_to_vectorstore()
    print(f"[Airflow Task 3] Vector store sync completed: {res}")
    return res

def task_run_agentic_pipeline():
    """Task 4: Execute 3-agent LangGraph pipeline to generate compliance tickets."""
    from agents import process_all_queued_circulars_with_agents
    results = process_all_queued_circulars_with_agents()
    print(f"[Airflow Task 4] Agentic pipeline processed {len(results)} circulars.")
    return len(results)

default_args = {
    'owner': 'bank_of_india_compliance',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'bank_of_india_compliance_pipeline',
    default_args=default_args,
    description='Automated 6-Hour SEBI & RBI Regulatory Monitoring and Policy Drift Pipeline',
    schedule_interval='0 */6 * * *',  # Runs automatically every 6 hours (00:00, 06:00, 12:00, 18:00)
    catchup=False,
    tags=['compliance', 'sebi', 'rbi', 'bank_of_india', '6hr_schedule']
) as dag:

    t1_ingest = PythonOperator(
        task_id='ingest_sebi_rbi_circulars',
        python_callable=task_ingest_sebi_rbi,
    )

    t2_process = PythonOperator(
        task_id='process_pdf_documents',
        python_callable=task_process_pdf_documents,
    )

    t3_vector_sync = PythonOperator(
        task_id='sync_vector_database',
        python_callable=task_sync_vector_store,
    )

    t4_agents = PythonOperator(
        task_id='run_ai_agents_pipeline',
        python_callable=task_run_agentic_pipeline,
    )

    # Task Execution Order
    t1_ingest >> t2_process >> t3_vector_sync >> t4_agents

"""
Apache Airflow DAG for Bank of India SEBI & RBI Compliance Copilot
Schedule: Every 6 hours ('0 */6 * * *')
"""

import os
import json
import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger("airflow.compliance_dag")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8001/api")

default_args = {
    'owner': 'bank_of_india_compliance',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

def check_backend_health():
    """Verify FastAPI backend REST API is responsive prior to running pipeline."""
    try:
        url = f"{API_BASE_URL}/tickets"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            logger.info(f"Backend API health check passed ({url} returned HTTP 200)")
            return True
        else:
            raise ValueError(f"Backend API returned HTTP {response.status_code}")
    except Exception as e:
        logger.error(f"Backend health check failed: {e}")
        raise

def trigger_compliance_pipeline():
    """Trigger SEBI & RBI Layer 1 to Layer 4 pipeline via FastAPI REST endpoint."""
    try:
        url = f"{API_BASE_URL}/pipeline/run"
        response = requests.post(url, timeout=120)
        if response.status_code == 200:
            logger.info("Compliance pipeline successfully triggered via Airflow DAG.")
            return response.json()
        else:
            raise ValueError(f"Pipeline endpoint returned HTTP {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Error triggering compliance pipeline: {e}")
        raise

def run_ragas_evaluation():
    """Run post-ingestion RAGAS framework benchmark metrics evaluation."""
    try:
        url = f"{API_BASE_URL}/evaluation/run"
        response = requests.post(url, timeout=180)
        if response.status_code == 200:
            data = response.json()
            metrics = data.get("metrics", {})
            logger.info(f"RAGAS Benchmark Evaluation Completed: {metrics}")
            return metrics
        else:
            logger.warning(f"RAGAS evaluation returned HTTP {response.status_code}")
    except Exception as e:
        logger.warning(f"RAGAS evaluation task notice: {e}")

try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator

    with DAG(
        dag_id='sebi_rbi_compliance_ingestion_dag',
        default_args=default_args,
        description='Automated 6-Hour Ingestion, Vector Synchronization, and Policy Drift Pipeline for Bank of India',
        schedule_interval='0 */6 * * *',  # Triggers every 6 hours (00:00, 06:00, 12:00, 18:00)
        start_date=datetime(2026, 1, 1),
        catchup=False,
        tags=['bank_of_india', 'compliance', 'sebi', 'rbi', 'rag'],
    ) as dag:

        health_check_task = PythonOperator(
            task_id='check_backend_health',
            python_callable=check_backend_health,
        )

        pipeline_trigger_task = PythonOperator(
            task_id='trigger_compliance_pipeline',
            python_callable=trigger_compliance_pipeline,
        )

        ragas_eval_task = PythonOperator(
            task_id='run_ragas_evaluation',
            python_callable=run_ragas_evaluation,
        )

        health_check_task >> pipeline_trigger_task >> ragas_eval_task

except ImportError:
    logger.info("Apache Airflow package not installed locally. Run 'pip install apache-airflow' to deploy DAG natively.")

if __name__ == "__main__":
    print("Testing 6-Hour Ingestion Task Callables directly:")
    print("Health Check Callable:", check_backend_health.__name__)
    print("Pipeline Trigger Callable:", trigger_compliance_pipeline.__name__)
    print("RAGAS Eval Callable:", run_ragas_evaluation.__name__)

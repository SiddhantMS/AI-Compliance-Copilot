import os
import sys
import json
import sqlite3
import pandas as pd
from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__))

from db import get_connection, init_db
from embeddings import search_similar
from agents import run_agent_pipeline_on_circular
from ingestion import run_ingestion
from processor import run_processing
from embeddings import sync_db_to_chroma

load_dotenv()

app = FastAPI(
    title="Compliance Copilot REST API",
    description="Backend API for SEBI & RBI AI Regulatory Monitoring and Policy Drift Detection",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

class ChatQuery(BaseModel):
    query: str
    regulator: Optional[str] = "ALL"

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": "Compliance Copilot (SEBI & RBI)",
        "version": "2.0.0",
        "docs": "/docs"
    }

@app.get("/api/tickets")
def get_tickets(
    regulator: Optional[str] = None,
    priority: Optional[str] = None
):
    """Retrieve compliance tickets from SQLite database strictly for SEBI and RBI."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM compliance_tickets WHERE regulator IN ('SEBI', 'RBI')"
    params = []
    
    if regulator and regulator != "ALL":
        query += " AND regulator = ?"
        params.append(str(regulator))
        
    if priority and priority != "ALL":
        query += " AND priority LIKE ?"
        params.append(f"%{str(priority)}%")

    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    tickets = []
    for r in rows:
        tickets.append({
            "ticket_id": r["ticket_id"],
            "circular_id": r["circular_id"],
            "regulator": r["regulator"],
            "domain": r["domain"],
            "drift_score": r["drift_score"],
            "priority": r["priority"],
            "affected_policies": json.loads(r["affected_policies"]) if r["affected_policies"] else [],
            "summary": r["summary"],
            "change_list": json.loads(r["change_list"]) if r["change_list"] else [],
            "status": r["status"],
            "created_at": r["created_at"]
        })

    return {"count": len(tickets), "tickets": tickets}

@app.get("/api/drift")
def get_drift_analytics():
    """Retrieve drift score analytics and distribution metrics for SEBI and RBI."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM compliance_tickets WHERE regulator IN ('SEBI', 'RBI')")
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return {
            "total_tickets": 0,
            "avg_drift": 0.0,
            "priority_counts": {"HIGH (P1)": 0, "MEDIUM (P2)": 0, "LOW (P3)": 0},
            "regulator_counts": {"SEBI": 0, "RBI": 0},
            "domain_scores": []
        }

    df = pd.DataFrame([dict(r) for r in rows])
    
    avg_drift = round(float(df["drift_score"].mean()), 4) if not df.empty else 0.0
    high_count = int(len(df[df["priority"].str.contains("HIGH", na=False)]))
    med_count = int(len(df[df["priority"].str.contains("MEDIUM", na=False)]))
    low_count = int(len(df[df["priority"].str.contains("LOW", na=False)]))

    sebi_count = int(len(df[df["regulator"] == "SEBI"]))
    rbi_count = int(len(df[df["regulator"] == "RBI"]))

    domain_scores = []
    for idx, row in df.iterrows():
        domain_scores.append({
            "ticket_id": row["ticket_id"],
            "domain": row["domain"],
            "regulator": row["regulator"],
            "drift_score": row["drift_score"],
            "priority": row["priority"]
        })

    return {
        "total_tickets": len(df),
        "avg_drift": avg_drift,
        "priority_counts": {
            "HIGH (P1)": high_count,
            "MEDIUM (P2)": med_count,
            "LOW (P3)": low_count
        },
        "regulator_counts": {
            "SEBI": sebi_count,
            "RBI": rbi_count
        },
        "domain_scores": domain_scores
    }

@app.get("/api/audit")
def get_audit_trail(limit: int = 100):
    """Retrieve RBI/SEBI inspectable audit log entries."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM compliance_audit ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()

    logs = [dict(r) for r in rows]
    return {"count": len(logs), "logs": logs}

@app.post("/api/chat")
def chat_ai(payload: ChatQuery):
    """RAG Chatbot query endpoint searching ChromaDB and synthesizing response."""
    user_query = payload.query.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    matched_chunks = search_similar(query_text=user_query, top_k=4)

    answer = "Based on Bank of India master policies and SEBI/RBI regulatory directions:\n\n"
    if matched_chunks:
        top_match = matched_chunks[0]
        answer += f"**Key Compliance Guidance**: {top_match.get('text')}\n\n"
        answer += f"**Relevant Internal Policy**: `{top_match.get('doc_name')}` (Cosine Similarity: {top_match.get('similarity')})"
    else:
        answer += "No exact matching policy chunk found in ChromaDB vector store."

    return {
        "query": user_query,
        "answer": answer,
        "sources": matched_chunks
    }

@app.post("/api/pipeline/run")
def trigger_pipeline(background_tasks: BackgroundTasks):
    """Trigger Layer 1 to Layer 4 pipeline execution for SEBI & RBI."""
    def run_full_pipeline():
        run_ingestion()
        run_processing()
        sync_db_to_chroma()

    background_tasks.add_task(run_full_pipeline)
    return {"status": "accepted", "message": "SEBI & RBI compliance pipeline triggered in background."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

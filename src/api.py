import os
import sys
import re
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
from embeddings import search_similar, sync_db_to_chroma
from agents import run_agent_pipeline_on_circular, process_all_queued_circulars_with_agents
from ingestion import run_ingestion
from processor import run_processing

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
    """Retrieve drift score analytics and distribution metrics for ALL circulars (tickets + archived)."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Fetch tickets
    cursor.execute("SELECT * FROM compliance_tickets WHERE regulator IN ('SEBI', 'RBI')")
    ticket_rows = cursor.fetchall()

    # 2. Fetch all calculated drift scores from audit logs
    cursor.execute("""
        SELECT circular_id, details, timestamp FROM compliance_audit 
        WHERE agent_name LIKE '%Policy Mapper%' AND action = 'Calculated Drift'
        ORDER BY id DESC
    """)
    audit_rows = cursor.fetchall()

    # 3. Fetch all queued circulars for title & regulator info
    cursor.execute("SELECT id, regulator, title FROM document_queue")
    circ_rows = cursor.fetchall()
    conn.close()

    circ_dict = {str(c["id"]): {"regulator": c["regulator"], "title": c["title"]} for c in circ_rows}

    domain_scores = []
    seen_circs = set()

    for r in audit_rows:
        circ_id = str(r["circular_id"])
        if circ_id in seen_circs:
            continue
        seen_circs.add(circ_id)

        details = r["details"]
        # Parse details: Drift Score: 0.6185, Priority: MEDIUM (P2), Matched Policies: [...]
        score_match = re.search(r'Drift Score:\s*([\d\.]+)', details)
        prio_match = re.search(r'Priority:\s*([^,\n]+)', details)

        drift_score = float(score_match.group(1)) if score_match else 0.0
        priority = prio_match.group(1).strip() if prio_match else "Archive"
        
        info = circ_dict.get(circ_id, {"regulator": "SEBI", "title": f"Circular #{circ_id}"})
        regulator = info["regulator"]
        title = info["title"]

        # Domain detection for display
        lower = title.lower()
        if "kyc" in lower or "aml" in lower:
            domain = "KYC/AML"
        elif "cyber" in lower or "security" in lower:
            domain = "Cyber Security"
        elif "grievance" in lower or "scores" in lower:
            domain = "Grievance Redressal"
        elif "lending" in lower or "loan" in lower or "penal" in lower:
            domain = "Lending"
        elif "deposit" in lower or "treasury" in lower:
            domain = "Deposits"
        else:
            domain = "General BFSI"

        domain_scores.append({
            "circular_id": circ_id,
            "title": title[:50] + ("..." if len(title) > 50 else ""),
            "domain": domain,
            "regulator": regulator,
            "drift_score": drift_score,
            "priority": priority
        })

    # Total metrics calculation
    all_scores = [d["drift_score"] for d in domain_scores]
    avg_drift = round(float(sum(all_scores) / len(all_scores)), 4) if all_scores else 0.0
    
    high_count = sum(1 for d in domain_scores if "HIGH" in d["priority"])
    med_count = sum(1 for d in domain_scores if "MEDIUM" in d["priority"])
    low_count = sum(1 for d in domain_scores if "LOW" in d["priority"])
    arch_count = sum(1 for d in domain_scores if "Archive" in d["priority"])

    sebi_count = sum(1 for d in domain_scores if d["regulator"] == "SEBI")
    rbi_count = sum(1 for d in domain_scores if d["regulator"] == "RBI")

    return {
        "total_evaluated": len(domain_scores),
        "total_tickets": len(ticket_rows),
        "avg_drift": avg_drift,
        "priority_counts": {
            "HIGH (P1)": high_count,
            "MEDIUM (P2)": med_count,
            "LOW (P3)": low_count,
            "Archive": arch_count
        },
        "regulator_counts": {
            "SEBI": sebi_count,
            "RBI": rbi_count
        },
        "domain_scores": domain_scores
    }

@app.get("/api/audit")
def get_audit_trail(limit: int = 200):
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
    """Trigger complete Layer 1 to Layer 4 pipeline execution for SEBI & RBI."""
    def run_full_pipeline():
        run_ingestion()
        run_processing()
        sync_db_to_chroma()
        process_all_queued_circulars_with_agents()  # Execute LangGraph agents!

    background_tasks.add_task(run_full_pipeline)
    return {"status": "accepted", "message": "SEBI & RBI compliance pipeline triggered in background."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

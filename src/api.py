import os
import sys
import re
import json
import logging
import sqlite3
import pandas as pd
from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate
import requests as _http

sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "data"))

from db import get_connection, init_db, log_audit
from embeddings import search_similar, sync_db_to_chroma, calculate_drift, get_chroma_client, embedder
from agents import run_agent_pipeline_on_circular, process_all_queued_circulars_with_agents
from ingestion import run_ingestion
from processor import run_processing, extract_text_from_pdf
from generate_sample_policies import generate_all_sample_bank_policies
from evaluation import run_ragas_evaluation

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

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1:latest")

def get_available_ollama_model():
    """Auto-detect the best available Ollama model. Returns the configured model if available, else first text model found."""
    import requests as _req
    try:
        resp = _req.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            # Filter out embedding-only models
            text_models = [m for m in models if "embed" not in m.lower()]
            if LLM_MODEL in text_models:
                return LLM_MODEL
            elif text_models:
                logger_api = logging.getLogger("api")
                logger_api.warning(f"Configured model '{LLM_MODEL}' not found. Using '{text_models[0]}' instead.")
                return text_models[0]
    except Exception:
        pass
    return LLM_MODEL  # fallback to configured even if check fails

CHAT_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["context", "chat_history", "question"],
    template="""You are a helpful, knowledgeable AI assistant. You are also an expert in Indian banking regulations (SEBI, RBI, IRDAI, PFRDA), compliance, finance, and general topics.

You have been given some regulatory document excerpts as extra context below. Use them ONLY if they are relevant to the question. If the question is general (like greetings, math, coding, history, etc.), just answer it naturally without mentioning the documents.

Regulatory Context (use only if relevant):
{context}

Conversation History:
{chat_history}

User: {question}

Instructions:
- Answer the question directly and conversationally.
- If it's a greeting like "hi" or "hello", respond warmly and introduce yourself briefly.
- If it's a compliance/regulatory question, use the context above and be specific.
- If it's a general question (coding, math, science, history, etc.), answer from your knowledge.
- NEVER say "I don't know" or refuse to answer. Always give a useful response.
- Keep answers concise unless the user asks for detail.
- Do NOT mention "context" or "documents" unless the user asks about sources.

Assistant:"""
)

class ChatQuery(BaseModel):
    query: str
    regulator: Optional[str] = "ALL"
    chat_history: Optional[List[dict]] = []

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
    
    cursor.execute("SELECT * FROM compliance_tickets WHERE regulator IN ('SEBI', 'RBI')")
    ticket_rows = cursor.fetchall()

    cursor.execute("""
        SELECT circular_id, details, timestamp FROM compliance_audit 
        WHERE agent_name LIKE '%Policy Mapper%' AND action = 'Calculated Drift'
        ORDER BY id DESC
    """)
    audit_rows = cursor.fetchall()

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
        score_match = re.search(r'Drift Score:\s*([\d\.]+)', details)
        prio_match = re.search(r'Priority:\s*([^,\n]+)', details)

        drift_score = float(score_match.group(1)) if score_match else 0.0
        priority = prio_match.group(1).strip() if prio_match else "Archive"
        
        info = circ_dict.get(circ_id, {"regulator": "SEBI", "title": f"Circular #{circ_id}"})
        regulator = info["regulator"]
        title = info["title"]

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

@app.get("/api/evaluation")
def get_evaluation():
    """Retrieve current RAGAS framework evaluation metrics."""
    return run_ragas_evaluation()

@app.post("/api/evaluation/run")
def trigger_evaluation():
    """Execute RAGAS evaluation benchmark over regulatory test set."""
    return run_ragas_evaluation()

@app.post("/api/chat")
def chat_ai(payload: ChatQuery):
    """RAG Chatbot: retrieves ChromaDB context and generates a real LLM answer via Ollama."""
    logger_chat = logging.getLogger("chat")
    user_query = payload.query.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    # Step 1: Retrieve relevant context chunks from ChromaDB
    matched_chunks = search_similar(query_text=user_query, top_k=5)

    # Step 2: Build COMPACT context string — truncate chunks to avoid context overflow
    # Full document text (~3000 tokens) was filling the 4096 token window, leaving no room for the answer.
    # Now each chunk is capped at 350 chars → ~450 tokens total for all 3 chunks.
    if matched_chunks:
        context_parts = []
        for i, m in enumerate(matched_chunks[:3], 1):  # max 3 chunks
            chunk_text = m.get('text', '').strip()
            snippet = chunk_text[:350] + ('...' if len(chunk_text) > 350 else '')
            context_parts.append(
                f"[{i}] {m.get('doc_name', 'Policy')}:\n{snippet}"
            )
        context_str = "\n\n".join(context_parts)
    else:
        context_str = "No documents retrieved."

    # Step 3: Build conversation history (last 4 turns)
    history_lines = []
    for turn in (payload.chat_history or [])[-4:]:
        q = turn.get('query', '').strip()
        a = turn.get('answer', '').strip()
        if q:
            history_lines.append(f"User: {q}")
        if a:
            # Truncate long history entries to save context window
            history_lines.append(f"Assistant: {a[:300]}{'...' if len(a) > 300 else ''}")
    history_str = "\n".join(history_lines) if history_lines else "None"

    # Step 4: Build a SHORT, token-efficient prompt
    prompt = f"""You are an AI assistant expert in Indian banking regulations (SEBI, RBI), compliance, and finance. Answer questions clearly, accurately, and helpfully.

Relevant Policy Context:
{context_str}

Conversation so far:
{history_str}

User: {user_query}
Assistant:"""

    # Step 5: Call Ollama — with num_ctx=8192 so the question is never truncated
    active_model = get_available_ollama_model()
    answer = ""
    try:
        logger_chat.info(f"Calling Ollama model '{active_model}' for query: {user_query[:60]}")
        resp = _http.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": active_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 800,  # always allow full answers
                    "num_ctx": 8192      # large enough to hold prompt + answer
                }
            },
            timeout=180
        )
        if resp.status_code == 200:
            answer = resp.json().get("response", "").strip()
            logger_chat.info(f"Ollama responded successfully ({len(answer)} chars)")
        elif resp.status_code == 404:
            raise ValueError(f"Model '{active_model}' not found in Ollama. Run: ollama pull {active_model}")
        else:
            raise ValueError(f"Ollama HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger_chat.error(f"Ollama call failed: {e}")
        answer = (
            f"⚠️ Could not reach the AI model ({active_model}). "
            f"Please ensure Ollama is running and the model is pulled.\n\n"
            f"Run in terminal:\n`ollama pull {active_model}`\n`ollama serve`"
        )

    return {
        "query": user_query,
        "answer": answer,
        "sources": matched_chunks,
        "model_used": active_model
    }

@app.post("/api/pipeline/run")
def trigger_pipeline(background_tasks: BackgroundTasks):
    """Trigger complete Layer 1 to Layer 4 pipeline execution for SEBI & RBI."""
    def run_full_pipeline():
        generate_all_sample_bank_policies("data/bank_policies")
        
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE document_queue SET status = 'pending'")
        conn.commit()
        conn.close()

        run_ingestion()
        run_processing()
        sync_db_to_chroma()
        process_all_queued_circulars_with_agents()

    background_tasks.add_task(run_full_pipeline)
    return {"status": "accepted", "message": "SEBI & RBI compliance pipeline triggered in background."}

@app.post("/api/audit-policy")
async def audit_internal_policy(
    policy_name: Optional[str] = Form("Internal Bank Policy"),
    organization_name: Optional[str] = Form("Bank of India"),
    policy_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Client Upload Endpoint: Compares uploaded internal organization policy against SEBI & RBI regulations."""
    extracted_text = ""

    if file:
        temp_path = f"temp_upload_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        if file.filename.lower().endswith(".pdf"):
            pdf_res = extract_text_from_pdf(temp_path)
            extracted_text = pdf_res[0] if isinstance(pdf_res, tuple) else pdf_res
        else:
            with open(temp_path, "r", encoding="utf-8", errors="ignore") as f:
                extracted_text = f.read()

        if os.path.exists(temp_path):
            os.remove(temp_path)

    elif policy_text:
        extracted_text = policy_text.strip()

    if not extracted_text:
        raise HTTPException(status_code=400, detail="Please upload a PDF/text file or provide policy text.")

    client = get_chroma_client()
    try:
        coll_sebi = client.get_collection(name="sebi_circulars")
    except Exception:
        sync_db_to_chroma()
        coll_sebi = client.get_collection(name="sebi_circulars")

    query_emb = embedder.get_embedding(extracted_text)
    
    results = None
    try:
        results = coll_sebi.query(query_embeddings=[query_emb], n_results=5)
    except Exception:
        results = None

    matched_regulations = []
    if results and results.get("documents") and len(results["documents"][0]) > 0:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if results.get("metadatas") else []
        dists = results.get("distances", [[]])[0]

        for idx in range(len(docs)):
            dist = dists[idx] if idx < len(dists) else 0.5
            similarity = max(0.0, min(1.0, 1.0 - dist if dist <= 1.0 else 1.0 / (1.0 + dist)))
            regulator = metas[idx].get("regulator", "SEBI/RBI") if idx < len(metas) else "SEBI/RBI"
            circ_id = metas[idx].get("circular_id", "N/A") if idx < len(metas) else "N/A"
            
            matched_regulations.append({
                "circular_id": circ_id,
                "regulator": regulator,
                "text": docs[idx][:250] + ("..." if len(docs[idx]) > 250 else ""),
                "similarity": round(float(similarity), 4)
            })

    drift_score = calculate_drift(extracted_text, matched_regulations)

    if drift_score >= 0.80:
        priority = "HIGH (P1)"
        risk_level = "High Policy Conflict"
    elif drift_score >= 0.60:
        priority = "MEDIUM (P2)"
        risk_level = "Moderate Gap - Policy Updates Required"
    elif drift_score >= 0.40:
        priority = "LOW (P3)"
        risk_level = "Minor Alignment Adjustments Suggested"
    else:
        priority = "Archive / Compliant"
        risk_level = "Fully Aligned with Active SEBI & RBI Guidelines"

    summary = (
        f"Internal Policy '{policy_name}' for {organization_name} evaluated against active SEBI & RBI regulatory directives. "
        f"Calculated Weighted Drift Score is {drift_score:.4f} ({priority}). "
        f"Overall Assessment: {risk_level}."
    )

    action_recommendations = {
        "p1_high": [
            "KYC V-CIP & Re-KYC: Enforce 2-yr re-KYC for high-risk accounts & 3-day CKYCR upload SLA.",
            "Cyber Incident SLA: Implement mandatory 6-hour cybersecurity incident reporting to CSIRT-Fin/RBI."
        ],
        "p2_medium": [
            "SCORES 2.0 Grievance Escalation: Integrate complaint tracking with SEBI 21-day SLAs.",
            "Treasury Kill Switches: Configure hardware/software order limit kill switches in trading terminals."
        ],
        "p3_low": [
            "Fair Lending Penal Charges: Separate loan non-compliance charges from principal capitalization.",
            "Dormant Account Sweeper: Automate monthly 10-year dormant account sweeps to DEA Fund."
        ]
    }

    action_items = [
        f"Review internal policy clauses against matched {matched_regulations[0]['regulator'] if matched_regulations else 'SEBI/RBI'} circular provisions.",
        "Formulate internal compliance task force to update mandatory operational controls.",
        "Submit revised policy draft to Executive Risk Committee for sign-off and file regulatory compliance confirmation."
    ]

    log_audit(
        "CLIENT_UPLOAD",
        "Client Upload Auditor",
        "Policy Drift Analysis",
        "Report Generated",
        f"Evaluated '{policy_name}' for {organization_name} -> Drift: {drift_score:.4f} ({priority})"
    )

    return {
        "status": "success",
        "organization_name": organization_name,
        "policy_name": policy_name,
        "drift_score": drift_score,
        "priority": priority,
        "risk_level": risk_level,
        "summary": summary,
        "matched_regulations": matched_regulations,
        "action_recommendations": action_recommendations,
        "action_items": action_items,
        "word_count": len(re.findall(r'\w+', extracted_text))
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=False)

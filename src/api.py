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
from embeddings import search_similar, sync_db_to_vectorstore, calculate_drift, embedder
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

@app.get("/api/health")
def api_health():
    return {"status": "online", "model": LLM_MODEL}

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1:latest")

def get_available_ollama_model():
    """Auto-detect available Ollama model, forcing llama3.1 / fast 8B models over 32b models."""
    import requests as _req
    target_model = os.getenv("LLM_MODEL", "llama3.1").strip()
    try:
        resp = _req.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            # Exclude embedding models and heavy 32b models
            fast_models = [m for m in models if "embed" not in m.lower() and "32b" not in m.lower()]
            
            for m in fast_models:
                if "llama3.1" in m.lower() or target_model.lower() in m.lower():
                    return m
            if fast_models:
                return fast_models[0]
    except Exception:
        pass
    return "llama3.1"

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

@app.post("/api/run-pipeline")
@app.post("/api/pipeline/run")
def trigger_pipeline(background_tasks: BackgroundTasks):
    """Trigger the complete Airflow compliance ingestion, processing, vector sync, and agentic pipeline."""
    def run_full_pipeline_job():
        logger_pipe = logging.getLogger("pipeline")
        logger_pipe.info("=== Airflow Pipeline Started via API Trigger ===")
        try:
            ingest_res = run_ingestion()
            logger_pipe.info(f"Task 1 Ingestion Result: {ingest_res}")
            
            proc_res = run_processing()
            logger_pipe.info(f"Task 2 Processing Result: {proc_res}")
            
            sync_res = sync_db_to_vectorstore()
            logger_pipe.info(f"Task 3 Vector Sync Result: {sync_res}")
            
            agent_res = process_all_queued_circulars_with_agents()
            logger_pipe.info(f"Task 4 Agentic Pipeline Completed: Processed {len(agent_res)} circulars.")
        except Exception as err:
            logger_pipe.error(f"Airflow Pipeline Execution Failed: {err}")

    background_tasks.add_task(run_full_pipeline_job)
    return {
        "status": "triggered",
        "message": "Airflow compliance pipeline started in background.",
        "tasks": [
            "1. SEBI & RBI Ingestion",
            "2. PDF & OCR Document Processing",
            "3. Milvus HNSW & BM25 Vector Store Sync",
            "4. LangGraph Multi-Agent Ticket Generation"
        ]
    }

@app.get("/api/tickets")
def get_tickets(
    regulator: Optional[str] = None,
    priority: Optional[str] = None
):
    """Retrieve compliance tickets from SQLite database strictly for SEBI and RBI."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT t.*, q.title AS circular_title, q.content AS circular_content, q.source_url_or_path AS circular_url
        FROM compliance_tickets t
        LEFT JOIN document_queue q ON CAST(t.circular_id AS TEXT) = CAST(q.id AS TEXT)
        WHERE t.regulator IN ('SEBI', 'RBI')
    """
    params = []
    
    if regulator and regulator != "ALL":
        query += " AND t.regulator = ?"
        params.append(str(regulator))
        
    if priority and priority != "ALL":
        query += " AND t.priority LIKE ?"
        params.append(f"%{str(priority)}%")

    query += " ORDER BY t.created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    tickets = []
    for r in rows:
        tickets.append({
            "ticket_id": r["ticket_id"],
            "circular_id": r["circular_id"],
            "circular_title": r["circular_title"] or f"{r['regulator']} Circular #{r['circular_id']}",
            "circular_content": r["circular_content"] or "",
            "circular_url": r["circular_url"] or "",
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

@app.get("/api/evaluation")
def get_evaluation():
    """Execute RAGAS evaluation benchmark over regulatory test set."""
    return run_ragas_evaluation()

@app.get("/api/patches")
def list_patches():
    """Retrieve all pending and approved policy patches."""
    from policy_patch import get_all_policy_patches
    return {"patches": get_all_policy_patches()}

class CreatePatchRequest(BaseModel):
    ticket_id: str
    policy_name: str
    original_text: str
    proposed_patch: str

@app.post("/api/patches/create")
def create_patch_route(req: CreatePatchRequest):
    """Create a proposed policy patch for human-in-the-loop review."""
    from policy_patch import create_policy_patch
    return create_policy_patch(req.ticket_id, req.policy_name, req.original_text, req.proposed_patch)

class ApprovePatchRequest(BaseModel):
    patch_id: str
    reviewer: Optional[str] = "Compliance Officer"
    updated_text: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
def login_route(req: LoginRequest):
    """Authenticate bank user and return signed JWT token."""
    from auth import authenticate_user, generate_jwt_token
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    token = generate_jwt_token(user)
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me")
def get_current_user_route(token: Optional[str] = Query(None)):
    """Validate JWT token and return current user profile."""
    from auth import decode_jwt_token
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    payload = decode_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token.")
    return {"status": "success", "user": payload}

FINANCE_COMPLIANCE_KEYWORDS = {
    "sebi", "rbi", "kyc", "vcip", "v-cip", "ckycr", "scores", "ombudsman",
    "cyber", "vapt", "mfa", "soc", "csirt", "incident", "backup", "ransomware",
    "penal", "penalty", "interest", "loan", "lending", "borrower", "credit",
    "unclaimed", "deposit", "dea", "algo", "kill switch", "treasury", "trading",
    "policy", "circular", "directive", "compliance", "audit", "drift", "ticket",
    "bank", "banking", "finance", "regulatory", "npa", "basel", "repo", "reverse repo",
    "crr", "slr", "neft", "rtgs", "upi", "imps", "account", "customer", "sop", "guideline"
}

def is_finance_or_compliance_query(query_text: str) -> bool:
    """Fast classifier: returns True if query pertains to SEBI/RBI regulations or banking policies."""
    text_clean = query_text.lower()
    words = set(re.findall(r'\w+', text_clean))
    if words & FINANCE_COMPLIANCE_KEYWORDS:
        return True
    for term in ["v-cip", "scores 2.0", "kill switch", "bank of india", "penal charge", "dormant account"]:
        if term in text_clean:
            return True
    return False

@app.post("/api/chat")
def chat_ai(payload: ChatQuery):
    """Smart Intent-Routed RAG Chatbot with Sub-Second Caching:
    - General/Unrelated queries: Direct-to-LLM (Zero RAG delay)
    - Compliance queries: RAG Vector Search -> LLM fallback if no match found.
    """
    logger_chat = logging.getLogger("chat")
    user_query = payload.query.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    # Check High-Speed Cache for repeat queries
    cache_key = f"chat_cache:{user_query.lower()}"
    try:
        from cache import get_cache, set_cache
        cached_resp = get_cache(cache_key)
        if cached_resp:
            logger_chat.info(f"Cache HIT for query '{user_query[:40]}'. Returning cached response in <5ms.")
            return cached_resp
    except Exception:
        pass

    is_compliance = is_finance_or_compliance_query(user_query)
    matched_chunks = []
    
    if is_compliance:
        logger_chat.info(f"Compliance intent detected for '{user_query[:50]}'. Running RAG vector search...")
        matched_chunks = search_similar(query_text=user_query, top_k=3)
    else:
        logger_chat.info(f"General/Unrelated query detected for '{user_query[:50]}'. Skipping RAG search -> Direct LLM route.")

    # Check top similarity score
    max_sim = max([m.get("similarity", 0.0) for m in matched_chunks], default=0.0)
    
    if matched_chunks and max_sim >= 0.10:
        context_parts = []
        for i, m in enumerate(matched_chunks[:3], 1):
            chunk_text = m.get('text', '').strip()
            snippet = chunk_text[:350] + ('...' if len(chunk_text) > 350 else '')
            context_parts.append(f"[{i}] {m.get('doc_name', 'Policy')}:\n{snippet}")
        context_str = "\n\n".join(context_parts)
    else:
        context_str = "No specific internal policy context found. Answer using general knowledge."

    # Build conversation history
    history_lines = []
    for turn in (payload.chat_history or [])[-4:]:
        q = turn.get('query', '').strip()
        a = turn.get('answer', '').strip()
        if q:
            history_lines.append(f"User: {q}")
        if a:
            history_lines.append(f"Assistant: {a[:300]}{'...' if len(a) > 300 else ''}")
    history_str = "\n".join(history_lines) if history_lines else "None"

    # Build prompt based on route
    if is_compliance and max_sim >= 0.10:
        prompt = f"""You are an AI assistant expert in Indian banking regulations (SEBI, RBI), compliance, and finance.
Answer the question accurately using the relevant policy context below where helpful.

Relevant Policy Context:
{context_str}

Conversation History:
{history_str}

User: {user_query}
Assistant:"""
    else:
        prompt = f"""You are a helpful, knowledgeable AI assistant. Answer general questions directly, concisely, and accurately.

Conversation History:
{history_str}

User: {user_query}
Assistant:"""

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
                "keep_alive": "24h",
                "options": {
                    "temperature": 0.2 if is_compliance else 0.4,
                    "num_predict": 400,
                    "num_ctx": 2048
                }
            },
            timeout=60
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

    result_dict = {
        "query": user_query,
        "answer": answer,
        "sources": matched_chunks,
        "model_used": active_model
    }

    try:
        from cache import set_cache
        if answer and not answer.startswith("⚠️"):
            set_cache(cache_key, result_dict, ttl_seconds=3600)
    except Exception:
        pass

    return result_dict

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
        sync_db_to_vectorstore()
        process_all_queued_circulars_with_agents()

    background_tasks.add_task(run_full_pipeline)
    log_audit("ALL", "FastAPI", "TriggerPipeline", "Pipeline Started", "Triggered SEBI & RBI compliance pipeline in background.")
    return {"status": "success", "message": "SEBI & RBI Compliance Pipeline started in background."}

@app.get("/api/circulars")
def get_available_circulars(regulator: Optional[str] = None):
    """Retrieve list of available SEBI & RBI Master Directions and Circulars for targeted comparison."""
    conn = get_connection()
    cursor = conn.cursor()
    if regulator and regulator != "ALL":
        cursor.execute("SELECT id, regulator, title, source_url_or_path FROM document_queue WHERE regulator = ? ORDER BY id DESC", (regulator,))
    else:
        cursor.execute("SELECT id, regulator, title, source_url_or_path FROM document_queue WHERE regulator IN ('SEBI', 'RBI') ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return {"circulars": [dict(r) for r in rows]}

@app.post("/api/audit-policy")
async def audit_policy(
    organization_name: str = Form("Bank of India"),
    policy_name: str = Form("Internal Policy"),
    target_regulator: str = Form("ALL"),
    target_circular_id: str = Form("ALL"),
    file: Optional[UploadFile] = File(None),
    policy_text: Optional[str] = Form(None)
):
    """Audit user policy against selected SEBI & RBI regulations or specific Master Directions."""
    extracted_text = ""

    upload_dir = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    if file:
        temp_path = os.path.join(upload_dir, file.filename)
        try:
            file_bytes = await file.read()
            with open(temp_path, "wb") as f:
                f.write(file_bytes)

            # Upload raw file directly to AWS S3 Bucket
            try:
                from s3_storage import upload_pdf_to_s3
                s3_uri = upload_pdf_to_s3(temp_path, f"uploads/{file.filename}")
                logger_api = logging.getLogger("api")
                logger_api.info(f"Raw PDF uploaded & stored in AWS S3: {s3_uri}")
            except Exception as s3_err:
                logger_api = logging.getLogger("api")
                logger_api.warning(f"S3 Upload Notice: {s3_err}")

            if file.filename.lower().endswith(".pdf"):
                pdf_res = extract_text_from_pdf(temp_path)
                extracted_text = pdf_res[0] if isinstance(pdf_res, tuple) else str(pdf_res)
            else:
                with open(temp_path, "r", encoding="utf-8", errors="ignore") as f:
                    extracted_text = f.read()
        except Exception as upload_err:
            logger_api = logging.getLogger("api")
            logger_api.error(f"Error reading uploaded file '{file.filename}': {upload_err}")
            raise HTTPException(status_code=500, detail=f"Failed to process file: {str(upload_err)}")
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    elif policy_text:
        extracted_text = policy_text.strip()

    if not extracted_text:
        raise HTTPException(status_code=400, detail="Please upload a PDF/text file or provide policy text.")

    # Retrieve matched policy chunks
    all_matched = search_similar(query_text=extracted_text, top_k=8)

    # Filter matched chunks based on target_regulator and target_circular_id
    matched_regulations = []
    if target_circular_id and target_circular_id != "ALL":
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT title, content, regulator FROM document_queue WHERE id = ?", (target_circular_id,))
        specific_circ = cursor.fetchone()
        conn.close()
        if specific_circ:
            matched_regulations = [{
                "doc_name": f"{specific_circ['regulator']} — {specific_circ['title']}",
                "regulator": specific_circ['regulator'],
                "domain": "Target Regulation",
                "text": specific_circ['content'],
                "similarity": 0.85
            }]
    elif target_regulator and target_regulator != "ALL":
        matched_regulations = [m for m in all_matched if m.get("regulator", "SEBI") == target_regulator or target_regulator in m.get("doc_name", "")]
        if not matched_regulations:
            matched_regulations = all_matched[:4]
    else:
        matched_regulations = all_matched[:5]

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
        f"Review internal policy clauses against matched {matched_regulations[0].get('regulator', 'SEBI/RBI') if matched_regulations else 'SEBI/RBI'} circular provisions.",
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

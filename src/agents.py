import os
import json
import logging
import uuid
from typing import TypedDict, Optional
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate

from db import get_connection, init_db, log_audit
from embeddings import search_similar, calculate_drift

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("agents")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1")

class ComplianceState(TypedDict):
    circular_id: str
    circular_text: str
    regulator: str
    domain: str
    doc_type: str
    matched_chunks: list
    drift_score: float
    priority: str
    affected_policies: list
    summary: str
    change_list: list
    ticket_id: str

# Agent 1 — Classifier (No LLM, No ChromaDB)
def agent_classifier(state: ComplianceState) -> ComplianceState:
    """Reads circular text. Detects regulator, domain, doc_type via keyword matching."""
    text = state.get("circular_text", "")
    regulator = state.get("regulator", "")
    
    if not regulator:
        if "sebi" in text.lower():
            regulator = "SEBI"
        elif "rbi" in text.lower() or "reserve bank" in text.lower():
            regulator = "RBI"
        elif "irdai" in text.lower():
            regulator = "IRDAI"
        elif "pfrda" in text.lower():
            regulator = "PFRDA"
        else:
            regulator = "SEBI"

    lower_text = text.lower()
    if "kyc" in lower_text or "aml" in lower_text or "beneficial ownership" in lower_text:
        domain = "KYC/AML"
    elif "cyber" in lower_text or "vapt" in lower_text or "soc" in lower_text or "mfa" in lower_text:
        domain = "Cyber Security"
    elif "scores" in lower_text or "grievance" in lower_text or "complaint" in lower_text:
        domain = "Grievance Redressal"
    elif "penal" in lower_text or "lending" in lower_text or "loan" in lower_text:
        domain = "Lending"
    elif "deposit" in lower_text or "treasury" in lower_text or "mtf" in lower_text:
        domain = "Deposits"
    else:
        domain = "General BFSI"

    if "master circular" in lower_text or "master direction" in lower_text:
        doc_type = "Master Circular"
    elif "guidelines" in lower_text:
        doc_type = "Guidelines"
    elif "framework" in lower_text:
        doc_type = "Framework"
    else:
        doc_type = "Circular"

    log_audit(
        state.get("circular_id", "0"),
        "Agent 1 (Classifier)",
        "Classification",
        "Classified",
        f"Regulator: {regulator}, Domain: {domain}, DocType: {doc_type}"
    )

    state["regulator"] = regulator
    state["domain"] = domain
    state["doc_type"] = doc_type
    return state

# Agent 2 — Policy Mapper (No LLM called)
def agent_policy_mapper(state: ComplianceState) -> ComplianceState:
    """Calls search_similar() and calculate_drift(). Outputs drift_score, priority, matched_chunks."""
    circ_text = state.get("circular_text", "")
    domain = state.get("domain", None)

    matched = search_similar(query_text=circ_text, domain=domain, top_k=5)
    drift_score = calculate_drift(circular_text=circ_text, matched_policy_chunks=matched)

    # Priority Thresholds
    if drift_score > 0.80:
        priority = "HIGH (P1)"
    elif drift_score >= 0.60:
        priority = "MEDIUM (P2)"
    elif drift_score >= 0.40:
        priority = "LOW (P3)"
    else:
        priority = "Archive"

    affected_policies = list(set([m.get("doc_name", "Bank Policy") for m in matched]))

    log_audit(
        state.get("circular_id", "0"),
        "Agent 2 (Policy Mapper)",
        "Mapping & Drift Calculation",
        "Calculated Drift",
        f"Drift Score: {drift_score:.4f}, Priority: {priority}, Matched Policies: {affected_policies}"
    )

    state["matched_chunks"] = matched
    state["drift_score"] = drift_score
    state["priority"] = priority
    state["affected_policies"] = affected_policies
    return state

# Conditional Edge Decision Router
def route_archive_gate(state: ComplianceState) -> str:
    """Route all circulars to agent_advisor so compliance tickets & drift scores are generated for every circular."""
    return "agent_advisor"

# Agent 3 — Advisor (ONE LLM Call to Ollama via LangChain)
def agent_advisor(state: ComplianceState) -> ComplianceState:
    """Invokes llama3.1:8b via Ollama to generate plain-English summary + action plan and write SQLite ticket."""
    circ_text = state.get("circular_text", "")
    regulator = state.get("regulator", "Regulatory Authority")
    domain = state.get("domain", "BFSI Domain")
    drift_score = state.get("drift_score", 0.5)
    priority = state.get("priority", "MEDIUM (P2)")
    affected_policies = state.get("affected_policies", [])

    matched_texts = "\n---\n".join([f"Policy [{m.get('doc_name')}]: {m.get('text')}" for m in state.get("matched_chunks", [])[:3]])

    prompt_template = PromptTemplate(
        input_variables=["regulator", "domain", "drift_score", "priority", "affected_policies", "circ_text", "matched_texts"],
        template="""You are a Senior Regulatory Compliance Advisor for an Indian Commercial Bank (Bank of India).
Analyze the following regulatory circular against internal bank policies and output a structured compliance assessment.

Regulator: {regulator}
Domain: {domain}
Drift Score: {drift_score}
Priority Level: {priority}
Affected Bank Policies: {affected_policies}

Regulatory Circular Text:
{circ_text}

Matched Bank Policy Context:
{matched_texts}

Provide your response in JSON format with EXACTLY two fields:
"summary": A 2-3 sentence plain-English summary of the regulatory change and its impact on Bank of India.
"change_list": A JSON list of 3 actionable compliance step items (e.g. ["Update KYC policy doc Section 2.1", "Conduct quarterly VAPT audit", "Submit compliance report within 30 days"]).

Return JSON only:"""
    )

    summary = ""
    change_list = []

    try:
        llm = OllamaLLM(model=LLM_MODEL, base_url=OLLAMA_BASE_URL, temperature=0.2)
        prompt = prompt_template.format(
            regulator=regulator,
            domain=domain,
            drift_score=drift_score,
            priority=priority,
            affected_policies=", ".join(affected_policies),
            circ_text=circ_text[:2000],
            matched_texts=matched_texts[:2000]
        )
        response = llm.invoke(prompt)
        
        parsed = None
        try:
            json_match = response[response.find("{"):response.rfind("}")+1]
            parsed = json.loads(json_match)
        except Exception:
            parsed = None

        if parsed and isinstance(parsed, dict):
            summary = parsed.get("summary", "")
            change_list = parsed.get("change_list", [])
        else:
            summary = str(response).strip()[:500]
            change_list = ["Review policy documentation", "Conduct compliance gap assessment", "Notify internal audit team"]
    except Exception as e:
        logger.warning(f"Ollama LLM call fallback: {e}")
        summary = f"Regulatory circular issued by {regulator} in domain {domain} requires policy alignment (Drift Score: {drift_score:.2f}). Immediate review of affected policies ({', '.join(affected_policies)}) recommended."
        change_list = [
            f"Review internal policy section matching {domain} regulations",
            f"Formulate compliance task force for {priority} priority remediation",
            "Update bank policy master documentation and submit regulatory confirmation"
        ]

    if not summary:
        summary = f"Circular requires Bank of India policy revision for {domain} under {priority} timeline."
    if not change_list:
        change_list = ["Conduct gap analysis", "Revise policy documentation", "Report to compliance committee"]

    ticket_id = f"TICK-{uuid.uuid4().hex[:8].upper()}"

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO compliance_tickets (
            ticket_id, circular_id, regulator, domain, drift_score, priority, affected_policies, summary, change_list, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
    """, (
        ticket_id,
        state.get("circular_id", "0"),
        regulator,
        domain,
        drift_score,
        priority,
        json.dumps(affected_policies),
        summary,
        json.dumps(change_list)
    ))
    conn.commit()
    conn.close()

    log_audit(
        state.get("circular_id", "0"),
        "Agent 3 (Advisor)",
        "Ticket Creation",
        "Generated Ticket",
        f"Ticket {ticket_id} created for {regulator} ({domain}). Priority: {priority}, Summary: {summary[:100]}..."
    )

    # Trigger Automated P1 Alerting for High Priority Tickets
    if "HIGH" in priority.upper() or "P1" in priority.upper():
        try:
            from alerting import trigger_p1_alert_pipeline
            alert_ticket_data = {
                "ticket_id": ticket_id,
                "regulator": regulator,
                "domain": domain,
                "drift_score": drift_score,
                "priority": priority,
                "summary": summary,
                "affected_policies": affected_policies
            }
            trigger_p1_alert_pipeline(alert_ticket_data)
        except Exception as alert_err:
            logger.warning(f"P1 Alert Dispatch Failed: {alert_err}")

    state["summary"] = summary
    state["change_list"] = change_list
    state["ticket_id"] = ticket_id
    return state

def build_compliance_graph():
    """Build LangGraph directed graph with 3 agent nodes, typed state, and 1 conditional edge."""
    workflow = StateGraph(ComplianceState)

    workflow.add_node("agent_classifier", agent_classifier)
    workflow.add_node("agent_policy_mapper", agent_policy_mapper)
    workflow.add_node("agent_advisor", agent_advisor)

    workflow.set_entry_point("agent_classifier")
    workflow.add_edge("agent_classifier", "agent_policy_mapper")

    # Conditional edge (Archive Gate)
    workflow.add_conditional_edges(
        "agent_policy_mapper",
        route_archive_gate,
        {
            "END": END,
            "agent_advisor": "agent_advisor"
        }
    )

    workflow.add_edge("agent_advisor", END)

    app = workflow.compile()
    return app

def run_agent_pipeline_on_circular(circular_id: str, circular_text: str, regulator: str = "SEBI") -> ComplianceState:
    """Execute LangGraph agent pipeline on a single circular."""
    init_db()
    graph = build_compliance_graph()

    initial_state: ComplianceState = {
        "circular_id": str(circular_id),
        "circular_text": circular_text,
        "regulator": regulator,
        "domain": "",
        "doc_type": "",
        "matched_chunks": [],
        "drift_score": 0.0,
        "priority": "",
        "affected_policies": [],
        "summary": "",
        "change_list": [],
        "ticket_id": ""
    }

    logger.info(f"=== Running Agent Pipeline on Circular ID {circular_id} ({regulator}) ===")
    final_state = graph.invoke(initial_state)
    logger.info(f"Pipeline Completed: Circular ID {circular_id} -> Priority: {final_state.get('priority')}, Ticket: {final_state.get('ticket_id', 'ARCHIVED')}")
    return final_state

def process_all_queued_circulars_with_agents() -> list[ComplianceState]:
    """Fetch all processed circulars from DB and run agent workflow on each."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, regulator, title, content FROM document_queue")
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        circ_id = str(r["id"])
        text = f"{r['title']}\n\n{r['content']}"
        res = run_agent_pipeline_on_circular(circular_id=circ_id, circular_text=text, regulator=r["regulator"])
        results.append(res)

    return results

if __name__ == "__main__":
    init_db()
    res = process_all_queued_circulars_with_agents()
    print(f"\nProcessed {len(res)} circulars through LangGraph Agent Pipeline.")

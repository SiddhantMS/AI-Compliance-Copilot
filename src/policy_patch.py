"""
AI COMPLIANCE COPILOT — POLICY PATCHING & HUMAN-IN-THE-LOOP ENGINE
Provides draft policy patching, compliance review workflows, and automated SOP updates.
"""

import sqlite3
import json
import logging
from datetime import datetime
from db import get_connection, log_audit

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("policy_patch")


def init_patch_db():
    """Ensure policy_patches table exists in SQLite compliance.db."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS policy_patches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patch_id TEXT UNIQUE NOT NULL,
            ticket_id TEXT NOT NULL,
            policy_name TEXT NOT NULL,
            original_text TEXT NOT NULL,
            proposed_patch TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
            reviewed_by TEXT DEFAULT 'Compliance Officer',
            created_at TEXT NOT NULL,
            approved_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def create_policy_patch(ticket_id: str, policy_name: str, original_text: str, proposed_patch: str) -> dict:
    """Create a new pending policy patch for human-in-the-loop review."""
    init_patch_db()
    patch_id = f"PATCH-{ticket_id.replace('TICK-', '')}"
    created_at = datetime.utcnow().isoformat()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO policy_patches (patch_id, ticket_id, policy_name, original_text, proposed_patch, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
        """, (patch_id, ticket_id, policy_name, original_text, proposed_patch, created_at))
        conn.commit()
        conn.close()

        log_audit(
            ticket_id,
            "Policy Patch Engine",
            "Create Patch",
            "Patch Pending",
            f"Created policy patch '{patch_id}' for '{policy_name}'"
        )
        return {"status": "success", "patch_id": patch_id, "policy_name": policy_name}
    except Exception as e:
        conn.close()
        logger.error(f"Error creating policy patch: {e}")
        return {"status": "error", "message": str(e)}


def get_all_policy_patches() -> list:
    """Retrieve all pending and approved policy patches."""
    init_patch_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM policy_patches ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def approve_policy_patch(patch_id: str, reviewer: str = "Compliance Officer", updated_text: str = None) -> dict:
    """Approve and apply a policy patch into official bank SOPs."""
    init_patch_db()
    approved_at = datetime.utcnow().isoformat()

    conn = get_connection()
    cursor = conn.cursor()

    if updated_text:
        cursor.execute("""
            UPDATE policy_patches
            SET status = 'APPROVED', proposed_patch = ?, reviewed_by = ?, approved_at = ?
            WHERE patch_id = ?
        """, (updated_text, reviewer, approved_at, patch_id))
    else:
        cursor.execute("""
            UPDATE policy_patches
            SET status = 'APPROVED', reviewed_by = ?, approved_at = ?
            WHERE patch_id = ?
        """, (reviewer, approved_at, patch_id))

    conn.commit()
    conn.close()

    log_audit(
        patch_id,
        reviewer,
        "Approve Patch",
        "Policy Updated",
        f"Approved policy patch '{patch_id}'. Official bank policy updated."
    )
    return {"status": "success", "patch_id": patch_id, "approved_at": approved_at}

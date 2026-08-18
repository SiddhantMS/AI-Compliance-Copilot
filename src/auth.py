"""
AI COMPLIANCE COPILOT — ROLE-BASED ACCESS CONTROL (RBAC) & AUTH MODULE
Provides JWT authentication, password hashing, and role permissions.
"""

import os
import time
import hashlib
import jwt
import logging
from typing import Optional, Dict
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("auth")

JWT_SECRET = os.getenv("JWT_SECRET", "bank_of_india_compliance_copilot_secret_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 86400  # 24 hours

# Pre-configured Bank Users for Demonstration
USERS_DB = {
    "officer@bankofindia.co.in": {
        "user_id": "USER-001",
        "name": "Senior Compliance Officer",
        "email": "officer@bankofindia.co.in",
        "role": "compliance_officer",
        "password_hash": hashlib.sha256("Officer2026!".encode()).hexdigest(),
        "department": "Regulatory Risk & Governance"
    },
    "auditor@bankofindia.co.in": {
        "user_id": "USER-002",
        "name": "RBI/SEBI External Auditor",
        "email": "auditor@bankofindia.co.in",
        "role": "auditor",
        "password_hash": hashlib.sha256("Auditor2026!".encode()).hexdigest(),
        "department": "Internal & External Audit"
    },
    "admin@bankofindia.co.in": {
        "user_id": "USER-003",
        "name": "System Administrator",
        "email": "admin@bankofindia.co.in",
        "role": "admin",
        "password_hash": hashlib.sha256("Admin2026!".encode()).hexdigest(),
        "department": "IT Compliance Infrastructure"
    }
}


def hash_password(password: str) -> str:
    """Hash a plaintext password with SHA-256."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def authenticate_user(email: str, password_raw: str) -> Optional[Dict]:
    """Verify user credentials. Returns user dict if valid, else None."""
    email_clean = email.strip().lower()
    user = USERS_DB.get(email_clean)
    if not user:
        return None
    if user["password_hash"] == hash_password(password_raw):
        return {
            "user_id": user["user_id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "department": user["department"]
        }
    return None


def generate_jwt_token(user_info: Dict) -> str:
    """Generate a signed JWT token valid for 24 hours."""
    payload = {
        "sub": user_info["user_id"],
        "name": user_info["name"],
        "email": user_info["email"],
        "role": user_info["role"],
        "department": user_info["department"],
        "exp": int(time.time()) + JWT_EXPIRATION_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[Dict]:
    """Decode and validate a JWT token. Returns payload dict if valid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token signature has expired.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None

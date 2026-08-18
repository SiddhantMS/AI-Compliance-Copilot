"""
AI COMPLIANCE COPILOT — AUTOMATED ALERTING MODULE
Automated Slack & Email Notifications for High-Priority (P1) Compliance Drift Tickets
"""

import os
import json
import logging
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

from db import log_audit

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("alerting")

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "").strip()
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "compliance-officer@bankofindia.co.in").strip()


def send_slack_p1_alert(ticket: dict) -> bool:
    """Send a rich Slack alert card for a P1 High Priority Compliance Ticket."""
    if not SLACK_WEBHOOK_URL:
        logger.info(f"[Alerting] Slack Webhook URL not configured. Simulating Slack alert for Ticket '{ticket.get('ticket_id')}'.")
        return False

    ticket_id = ticket.get("ticket_id", "N/A")
    regulator = ticket.get("regulator", "SEBI/RBI")
    domain = ticket.get("domain", "General BFSI")
    drift_score = ticket.get("drift_score", 0.0)
    summary = ticket.get("summary", "")
    affected_policies = ticket.get("affected_policies", [])
    if isinstance(affected_policies, str):
        try:
            affected_policies = json.loads(affected_policies)
        except Exception:
            affected_policies = [affected_policies]

    slack_payload = {
        "text": f"🚨 *HIGH PRIORITY COMPLIANCE ALERT (P1)* — {regulator} Drift Score: {drift_score:.4f}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 P1 COMPLIANCE DRIFT DETECTED — {ticket_id}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Regulator:* {regulator}"},
                    {"type": "mrkdwn", "text": f"*Domain:* {domain}"},
                    {"type": "mrkdwn", "text": f"*Drift Score:* `{drift_score:.4f}`"},
                    {"type": "mrkdwn", "text": "*Priority:* `HIGH (P1)`"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Executive Summary:*\n{summary[:300]}..."
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Affected Internal Policies:*\n• " + "\n• ".join(affected_policies[:3])
                }
            },
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": "🏛️ *Bank of India Automated AI Compliance Copilot* | Resolution Required within 24 Hours."}
                ]
            }
        ]
    }

    try:
        resp = requests.post(SLACK_WEBHOOK_URL, json=slack_payload, timeout=5)
        if resp.status_code == 200:
            logger.info(f"Slack P1 alert sent successfully for Ticket '{ticket_id}'.")
            return True
        else:
            logger.warning(f"Slack webhook returned status code {resp.status_code}")
            return False
    except Exception as e:
        logger.error(f"Failed to send Slack P1 alert: {e}")
        return False


def send_email_p1_alert(ticket: dict) -> bool:
    """Send an SMTP Email alert for a P1 High Priority Compliance Ticket."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.info(f"[Alerting] SMTP credentials not set. Simulating Email alert for Ticket '{ticket.get('ticket_id')}'.")
        return False

    ticket_id = ticket.get("ticket_id", "N/A")
    regulator = ticket.get("regulator", "SEBI/RBI")
    drift_score = ticket.get("drift_score", 0.0)

    subject = f"[P1 HIGH ALERT] Regulatory Non-Compliance Detected - {ticket_id} ({regulator})"
    body = f"""
    OFFICIAL COMPLIANCE ALERT — BANK OF INDIA AI COMPLIANCE COPILOT
    ---------------------------------------------------------------
    Ticket ID:     {ticket_id}
    Regulator:     {regulator}
    Domain:        {ticket.get('domain')}
    Drift Score:   {drift_score:.4f} (Threshold >= 0.80 HIGH)
    
    Executive Summary:
    {ticket.get('summary')}
    
    Required Action:
    1. Convene Emergency Compliance Review Task Force.
    2. Review Affected Policies: {', '.join(ticket.get('affected_policies', []))}
    3. Update Internal SOPs within 24 Hours.
    """

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = ALERT_EMAIL_TO
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        logger.info(f"Email P1 alert sent successfully to '{ALERT_EMAIL_TO}'.")
        return True
    except Exception as e:
        logger.error(f"Failed to send Email P1 alert: {e}")
        return False


def trigger_p1_alert_pipeline(ticket: dict) -> dict:
    """Main alert dispatcher called when a P1 ticket is created."""
    ticket_id = ticket.get("ticket_id", "N/A")
    logger.info(f"Dispatching P1 Alerts for Ticket '{ticket_id}'...")

    slack_sent = send_slack_p1_alert(ticket)
    email_sent = send_email_p1_alert(ticket)

    log_audit(
        ticket_id,
        "Automated Alerting Engine",
        "P1 Alert Triggered",
        "Dispatched",
        f"Slack: {'Sent' if slack_sent else 'Simulated'}, Email: {'Sent' if email_sent else 'Simulated'}"
    )

    return {
        "status": "completed",
        "ticket_id": ticket_id,
        "slack_alert": slack_sent,
        "email_alert": email_sent
    }

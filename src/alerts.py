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

logger = logging.getLogger("alerts")

def get_alert_config() -> dict:
    """Read current alert configuration from environment variables."""
    return {
        "channel": os.getenv("ALERT_CHANNEL", "none").lower(),
        "slack_webhook_url": os.getenv("SLACK_WEBHOOK_URL", ""),
        "smtp_server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
        "smtp_port": int(os.getenv("SMTP_PORT", "587")),
        "smtp_user": os.getenv("SMTP_USER", ""),
        "smtp_password": os.getenv("SMTP_PASSWORD", ""),
        "alert_recipients": os.getenv("ALERT_RECIPIENTS", "")
    }

def send_slack_alert(ticket_data: dict, config: dict) -> bool:
    """Send formatted Slack message via Incoming Webhook for P1 High Risk ticket."""
    webhook_url = config.get("slack_webhook_url", "").strip()
    if not webhook_url:
        logger.warning("Slack alert skipped: SLACK_WEBHOOK_URL is not set.")
        return False

    ticket_id = ticket_data.get("ticket_id", "TICK-UNKNOWN")
    circular_id = ticket_data.get("circular_id", "N/A")
    regulator = ticket_data.get("regulator", "SEBI/RBI")
    drift_score = ticket_data.get("drift_score", 0.0)
    affected = ticket_data.get("affected_policies", [])
    if isinstance(affected, list):
        affected_str = ", ".join(affected)
    else:
        affected_str = str(affected)

    summary = ticket_data.get("summary", "High priority policy drift detected.")

    payload = {
        "text": f"🚨 *HIGH PRIORITY COMPLIANCE ALERT (P1)* — {regulator}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 HIGH PRIORITY COMPLIANCE TICKET: {ticket_id}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Regulator:*\n{regulator}"},
                    {"type": "mrkdwn", "text": f"*Circular ID:*\n{circular_id}"},
                    {"type": "mrkdwn", "text": f"*Drift Score:*\n`{drift_score:.4f}`"},
                    {"type": "mrkdwn", "text": f"*Affected Policy:*\n{affected_str}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Summary:*\n{summary}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Bank of India Compliance Copilot | Ticket #{ticket_id}"
                    }
                ]
            }
        ]
    }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=10)
        if resp.status_code == 200:
            logger.info(f"Slack alert successfully dispatched for ticket {ticket_id}")
            log_audit(circular_id, "AlertSystem", "SlackAlert", "Dispatched", f"Posted P1 alert for ticket {ticket_id} to Slack")
            return True
        else:
            logger.error(f"Slack webhook error {resp.status_code}: {resp.text}")
            log_audit(circular_id, "AlertSystem", "SlackAlert", "Failed", f"Slack HTTP {resp.status_code}: {resp.text[:100]}")
            return False
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")
        log_audit(circular_id, "AlertSystem", "SlackAlert", "Error", f"Slack exception: {str(e)[:100]}")
        return False

def send_email_alert(ticket_data: dict, config: dict) -> bool:
    """Send HTML compliance alert email via SMTP for P1 High Risk ticket."""
    smtp_server = config.get("smtp_server")
    smtp_port = config.get("smtp_port")
    smtp_user = config.get("smtp_user")
    smtp_password = config.get("smtp_password")
    recipients = [r.strip() for r in config.get("alert_recipients", "").split(",") if r.strip()]

    if not smtp_user or not recipients:
        logger.warning("Email alert skipped: SMTP_USER or ALERT_RECIPIENTS not configured.")
        return False

    ticket_id = ticket_data.get("ticket_id", "TICK-UNKNOWN")
    circular_id = ticket_data.get("circular_id", "N/A")
    regulator = ticket_data.get("regulator", "SEBI/RBI")
    drift_score = ticket_data.get("drift_score", 0.0)
    summary = ticket_data.get("summary", "High priority policy drift detected.")

    subject = f"[HIGH PRIORITY COMPLIANCE ALERT] Ticket #{ticket_id} ({regulator})"
    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0C1B33;">
        <h2 style="color: #DC2626;">🚨 High Priority Compliance Alert (P1)</h2>
        <p>A critical regulatory policy drift has been detected requiring immediate action.</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; border-color: #CBD5E1;">
          <tr><td><strong>Ticket ID</strong></td><td>{ticket_id}</td></tr>
          <tr><td><strong>Regulator</strong></td><td>{regulator}</td></tr>
          <tr><td><strong>Circular ID</strong></td><td>{circular_id}</td></tr>
          <tr><td><strong>Drift Score</strong></td><td>{drift_score:.4f}</td></tr>
          <tr><td><strong>Summary</strong></td><td>{summary}</td></tr>
        </table>
        <p>Log in to the Bank of India Compliance Copilot to review and reassign this ticket.</p>
      </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, recipients, msg.as_string())

        logger.info(f"Email alert sent to {recipients} for ticket {ticket_id}")
        log_audit(circular_id, "AlertSystem", "EmailAlert", "Dispatched", f"Email alert sent to {len(recipients)} recipients for ticket {ticket_id}")
        return True
    except Exception as e:
        logger.error(f"Email alert failed: {e}")
        log_audit(circular_id, "AlertSystem", "EmailAlert", "Error", f"Email alert exception: {str(e)[:100]}")
        return False

def dispatch_ticket_alert(ticket_data: dict) -> bool:
    """Dispatch alert according to configured ALERT_CHANNEL (slack, email, or none)."""
    priority = ticket_data.get("priority", "")
    if "HIGH" not in priority and "P1" not in priority:
        # Only P1 tickets trigger alerts
        return False

    config = get_alert_config()
    channel = config.get("channel", "none")

    if channel == "slack":
        return send_slack_alert(ticket_data, config)
    elif channel == "email":
        return send_email_alert(ticket_data, config)
    elif channel == "all":
        slack_ok = send_slack_alert(ticket_data, config)
        email_ok = send_email_alert(ticket_data, config)
        return slack_ok or email_ok
    else:
        logger.info(f"Alert dispatch skipped (ALERT_CHANNEL={channel}).")
        return False

# NetShield AI — Security notifications (console, Slack, email)
# Developed by Krish | SKK Projects
import smtplib
from email.message import EmailMessage

import httpx

from app.config import settings


def notify(alert) -> None:
    """Sends a message for High/Critical alerts on every configured channel."""
    if alert.severity not in ("High", "Critical"):
        return
    text = (f"[NetShield AI] {alert.severity} alert #{alert.id}: {alert.title} "
            f"| {alert.src_ip} -> {alert.dst_ip}:{alert.dst_port} | risk {alert.risk_score}/100")
    print(text)  # console is always on

    if settings.SLACK_WEBHOOK_URL:
        try:
            httpx.post(settings.SLACK_WEBHOOK_URL, json={"text": text}, timeout=5)
        except httpx.HTTPError as exc:
            print(f"[notifier] Slack failed: {exc}")

    if settings.SMTP_HOST and settings.ALERT_EMAIL_TO:
        try:
            msg = EmailMessage()
            msg["Subject"] = f"NetShield AI {alert.severity} alert: {alert.title}"
            msg["From"] = settings.SMTP_USER
            msg["To"] = settings.ALERT_EMAIL_TO
            msg.set_content(text)
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
                smtp.starttls()
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
        except Exception as exc:  # never let email problems crash detection
            print(f"[notifier] Email failed: {exc}")

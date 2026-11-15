# audit.py
import json
from sqlalchemy.orm import Session
from app.models import AuditLog

def log_audit_event(
    db: Session,
    actor_user_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str = "SUCCESS",
    details: dict | None = None
):
    log = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        status=status,
        details=json.dumps(details) if details else None
    )
    db.add(log)
    db.commit()
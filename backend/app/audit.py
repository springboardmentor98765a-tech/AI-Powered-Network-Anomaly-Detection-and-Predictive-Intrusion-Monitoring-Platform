from typing import Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def log_action(
    db: Session,
    action: str,
    status: str,
    actor_user_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    """Record an important activity in the audit_logs table."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        status=status,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    db.commit()
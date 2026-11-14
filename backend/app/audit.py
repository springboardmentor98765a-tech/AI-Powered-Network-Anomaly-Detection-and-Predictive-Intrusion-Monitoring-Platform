from sqlalchemy.orm import Session

from .models import AuditLog


def log_event(db: Session, actor_id: int | None, action: str, status: str,
              target_type: str | None = None, target_id: int | None = None,
              details: str | None = None) -> None:
    """Append an audit record. Never pass passwords, tokens or other secrets in `details`."""
    db.add(AuditLog(actor_user_id=actor_id, action=action, status=status,
                    target_type=target_type, target_id=target_id, details=details))
    db.commit()

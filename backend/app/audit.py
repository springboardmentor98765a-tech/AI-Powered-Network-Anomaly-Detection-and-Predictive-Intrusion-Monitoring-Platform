import json
from sqlalchemy.orm import Session
from .models import AuditLog


def audit(db: Session, actor_id: int | None, action: str, target_type: str,
          target_id: int | None = None, status: str = "success", details: dict | None = None):
    safe_details = json.dumps(details or {}, ensure_ascii=True)
    db.add(AuditLog(actor_user_id=actor_id, action=action, target_type=target_type,
                    target_id=target_id, status=status, details=safe_details))

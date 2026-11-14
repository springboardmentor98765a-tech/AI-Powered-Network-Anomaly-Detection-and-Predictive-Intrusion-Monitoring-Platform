# NetShield AI — Audit logging (who did what, and when)
# Developed by Krish | SKK Projects
from fastapi import Request
from sqlalchemy.orm import Session

from app import models


def log_action(db: Session, user: models.User | None, action: str, details: str = "",
               request: Request | None = None) -> None:
    db.add(models.AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "anonymous",
        action=action, details=details,
        ip_address=request.client.host if request and request.client else "",
    ))
    db.commit()


from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_event(
    db: Session,
    actor_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    status: str = "success",
    details: str | None = None,
) -> None:
    """Never pass passwords, tokens or secrets in `details`."""
    db.add(
        AuditLog(
            actor_user_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            status=status,
            details=details[:255] if details else None,
        )
    )
    db.commit()


def query_logs(
    db: Session,
    user_id: int | None = None,
    action: str | None = None,
    status: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[AuditLog]:
    stmt = select(AuditLog)
    if user_id is not None:
        stmt = stmt.where(AuditLog.actor_user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if status:
        stmt = stmt.where(AuditLog.status == status)
    if from_date:
        stmt = stmt.where(AuditLog.timestamp >= from_date)
    if to_date:
        stmt = stmt.where(AuditLog.timestamp <= to_date)
    stmt = stmt.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt))
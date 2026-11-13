from datetime import datetime, timezone
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query
)
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import AuditLog
from app.schemas.audit import AuditLogResponse
from app.api.deps import require_roles


router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"]
)


@router.get("", response_model=list[AuditLogResponse])
def get_audit_logs(
    actor_user_id: int | None = Query(default=None, gt=0),
    action: str | None = Query(default=None, max_length=100),
    status: Literal["SUCCESS", "FAILED"] | None = None,
    target_type: str | None = Query(default=None, max_length=50),
    target_id: str | None = Query(default=None, max_length=64),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    admin=Depends(require_roles("Administrator"))
):
    """Retrieve and filter audit logs. Administrator only."""

    # Ensure date filters include timezone information.
    if start_date is not None and start_date.tzinfo is None:
        raise HTTPException(
            status_code=400,
            detail="Start date must include timezone information."
        )

    if end_date is not None and end_date.tzinfo is None:
        raise HTTPException(
            status_code=400,
            detail="End date must include timezone information."
        )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be later than end date."
        )

    query = (
        select(AuditLog)
        .options(selectinload(AuditLog.actor))
    )

    # Filter by the user who performed the action.
    if actor_user_id is not None:
        query = query.where(
            AuditLog.actor_user_id == actor_user_id
        )

    # Search action names.
    if action and action.strip():
        query = query.where(
            AuditLog.action.ilike(f"%{action.strip()}%")
        )

    # Filter by success or failure.
    if status:
        query = query.where(
            AuditLog.status == status
        )

    # Filter by target type.
    if target_type:
        query = query.where(
            AuditLog.target_type.ilike(
                f"%{target_type.strip()}%"
            )
        )

    # Filter by target record ID.
    if target_id:
        query = query.where(
            AuditLog.target_id == target_id.strip()
        )

    # Filter by date range.
    if start_date:
        query = query.where(
            AuditLog.timestamp >= start_date.astimezone(timezone.utc)
        )

    if end_date:
        query = query.where(
            AuditLog.timestamp <= end_date.astimezone(timezone.utc)
        )

    # Show newest events first.
    query = query.order_by(
        AuditLog.timestamp.desc(),
        AuditLog.id.desc()
    )

    logs = db.scalars(
        query.offset(offset).limit(limit)
    ).all()

    return [
        {
            "id": log.id,
            "actor_user_id": log.actor_user_id,
            "actor_name": log.actor.name if log.actor else None,
            "actor_username": (
                log.actor.username if log.actor else None
            ),
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "status": log.status,
            "timestamp": log.timestamp,
            "details": log.details
        }
        for log in logs
    ]
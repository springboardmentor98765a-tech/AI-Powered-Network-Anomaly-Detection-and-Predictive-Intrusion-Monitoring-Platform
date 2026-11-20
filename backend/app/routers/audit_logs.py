from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import AuditLog, User
from app.schemas import AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    action: Optional[str] = None,
    status: Optional[str] = Query(default=None, pattern=r"^(success|failure)$"),
    actor_user_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(require_roles("administrator", "team_lead")),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action.upper())
    if status:
        query = query.filter(AuditLog.status == status)
    if actor_user_id is not None:
        query = query.filter(AuditLog.actor_user_id == actor_user_id)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)

    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
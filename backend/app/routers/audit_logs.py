from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import require_roles
from app.models.user import User
from app.schemas.audit_log import AuditLogOut
from app.services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


# Read-only on purpose: there is no PATCH or DELETE for audit logs
@router.get("", response_model=list[AuditLogOut])
def list_logs(
    user_id: int | None = None,
    action: str | None = None,
    status: str | None = Query(None, pattern="^(success|failure)$"),
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    return audit_service.query_logs(db, user_id, action, status, from_date, to_date, skip, limit)
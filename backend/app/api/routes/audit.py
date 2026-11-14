from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogResponse


router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("/", response_model=list[AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    audit_logs = db.scalars(
        select(AuditLog).order_by(AuditLog.id.desc())
    ).all()

    return audit_logs
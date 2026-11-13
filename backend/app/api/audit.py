from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.audit import AuditLog, AuditAction, AuditStatus
from app.schemas.audit import AuditLogResponse, AuditStatsResponse
from app.api.deps import require_roles

router = APIRouter(prefix="/audit", tags=["Audit Logging"])

@router.get("", response_model=list[AuditLogResponse])
def get_audit_logs(
    actor_username: str | None = None,
    action: str | None = None,
    status: str | None = None,
    target_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.TEAM_LEAD])),
    db: Session = Depends(get_db),
):
    """
    Search and filter platform security audit logs.
    Restricted to Administrator and Team Lead / Supervisor roles.
    Records are read-only and immutable.
    """
    query = db.query(AuditLog)

    if actor_username:
        query = query.filter(AuditLog.actor_username.ilike(f"%{actor_username.strip()}%"))

    if action:
        query = query.filter(AuditLog.action == action)

    if status:
        query = query.filter(AuditLog.status == status)

    if target_type:
        query = query.filter(AuditLog.target_type == target_type)

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(AuditLog.created_at >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(AuditLog.created_at <= end_dt)
        except ValueError:
            pass

    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return logs

@router.get("/stats", response_model=AuditStatsResponse)
def get_audit_stats(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.TEAM_LEAD])),
    db: Session = Depends(get_db),
):
    """
    Retrieve aggregated audit metrics for security oversight.
    """
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_logs = db.query(func.count(AuditLog.id)).scalar() or 0

    successful_logins_24h = (
        db.query(func.count(AuditLog.id))
        .filter(
            AuditLog.action == AuditAction.LOGIN_SUCCESS,
            AuditLog.created_at >= one_day_ago,
        )
        .scalar()
        or 0
    )

    failed_logins_24h = (
        db.query(func.count(AuditLog.id))
        .filter(
            AuditLog.action == AuditAction.LOGIN_FAILED,
            AuditLog.created_at >= one_day_ago,
        )
        .scalar()
        or 0
    )

    total_actions_today = (
        db.query(func.count(AuditLog.id))
        .filter(AuditLog.created_at >= today_start)
        .scalar()
        or 0
    )

    active_users = (
        db.query(AuditLog.actor_username, func.count(AuditLog.id).label("count"))
        .group_by(AuditLog.actor_username)
        .order_by(func.count(AuditLog.id).desc())
        .limit(5)
        .all()
    )

    return AuditStatsResponse(
        total_logs=total_logs,
        successful_logins_24h=successful_logins_24h,
        failed_logins_24h=failed_logins_24h,
        total_actions_today=total_actions_today,
        most_active_users=[{"username": u[0], "count": u[1]} for u in active_users],
    )

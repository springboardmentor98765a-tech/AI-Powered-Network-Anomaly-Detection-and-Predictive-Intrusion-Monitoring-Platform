
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Team, AuditLog
from app.utils.permissions import admin_only


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_only)
):
    total_users = db.query(User).count()

    active_users = db.query(User).filter(
        User.is_active == True
    ).count()

    total_teams = db.query(Team).count()

    total_audit_events = db.query(AuditLog).count()

    recent_logs = db.query(AuditLog).order_by(
        AuditLog.timestamp.desc()
    ).limit(5).all()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_teams": total_teams,
        "total_audit_events": total_audit_events,
        "recent_activity": [
            {
                "id": log.id,
                "action": log.action,
                "status": log.status,
                "timestamp": log.timestamp,
                "actor_user_id": log.actor_user_id
            }
            for log in recent_logs
        ]
    }

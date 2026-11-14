from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuditLog, Team, User, utcnow
from .permissions import (ADMIN, LEAD, ROLE_LABELS, actions_for, nav_for, primary_role)
from .security import get_current_user

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")
router = APIRouter()

FMT = "%d %b %Y, %H:%M UTC"


def _fmt(dt):
    return dt.strftime(FMT) if dt else None


def build_dashboard(user: User, db: Session) -> dict:
    """Everything the dashboard shows, decided server-side from the user's DB roles."""
    roles = {r.role_name for r in user.roles}
    role = primary_role(roles)
    is_admin = ADMIN in roles
    can_see_members = bool(roles & {ADMIN, LEAD})

    # Admins see every team; everyone else only the teams they belong to.
    teams = (db.scalars(select(Team).order_by(Team.team_name)).all()
             if is_admin else sorted(user.teams, key=lambda t: t.team_name))
    team_rows = [{
        "name": t.team_name,
        "description": t.description or "",
        "member_count": len(t.members),
        # Analysts only get the headcount, not the roster.
        "members": [{"name": m.name, "status": m.status} for m in t.members] if can_see_members else [],
    } for t in teams]

    stats = events = None
    if is_admin:
        since = utcnow() - timedelta(hours=24)
        count = lambda q: db.scalar(q) or 0  # noqa: E731
        stats = {
            "total_users": count(select(func.count(User.id))),
            "active_users": count(select(func.count(User.id)).where(User.status == "active")),
            "teams": count(select(func.count(Team.id))),
            "failed_logins_24h": count(
                select(func.count(AuditLog.id)).where(
                    AuditLog.action == "login", AuditLog.status == "failure",
                    AuditLog.timestamp >= since)),
        }
        rows = db.execute(
            select(AuditLog, User.email)
            .outerjoin(User, User.id == AuditLog.actor_user_id)
            .order_by(AuditLog.timestamp.desc()).limit(8)).all()
        events = [{"time": _fmt(a.timestamp), "actor": email or "unknown",
                   "action": a.action, "status": a.status} for a, email in rows]

    return {
        "active": "/dashboard",
        "nav": nav_for(roles),
        "user": {"name": user.name, "email": user.email, "status": user.status,
                 "member_since": _fmt(user.created_at),
                 "last_login": _fmt(user.last_login_at) or "First sign-in"},
        "role_label": ROLE_LABELS.get(role, "No role assigned"),
        "roles": [ROLE_LABELS.get(r, r) for r in sorted(roles)],
        "actions": actions_for(roles),
        "can_see_members": can_see_members,
        "teams": team_rows,
        "stats": stats,
        "events": events,
    }


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return templates.TemplateResponse(request, "dashboard.html", build_dashboard(user, db))


@router.get("/api/dashboard")
def dashboard_api(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_dashboard(user, db)

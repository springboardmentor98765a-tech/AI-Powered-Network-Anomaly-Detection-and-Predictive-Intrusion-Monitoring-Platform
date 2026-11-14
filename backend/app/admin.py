from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import log_event
from .dashboard import templates
from .database import get_db
from .models import AuditLog, Role, Team, User
from .permissions import ADMIN, LEAD, ROLE_ACTIONS, ROLE_LABELS, nav_for, primary_role
from .security import get_current_user, hash_password

router = APIRouter()


def _role_names(user: User) -> set[str]:
    return {role.role_name for role in user.roles}


def _page_context(user: User, active: str, **values):
    roles = _role_names(user)
    return {
        "user": user,
        "role_label": ROLE_LABELS.get(primary_role(roles), "No role assigned"),
        "nav": nav_for(roles),
        "active": active,
        **values,
    }


def _require_admin(user: User) -> None:
    if ADMIN not in _role_names(user):
        raise HTTPException(status_code=403, detail="Administrator access required")


def _require_team_access(user: User, team: Team) -> None:
    roles = _role_names(user)
    if ADMIN in roles:
        return
    if LEAD not in roles or team not in user.teams:
        raise HTTPException(status_code=403, detail="You cannot manage this team")


@router.get("/admin/users", response_class=HTMLResponse)
def users_page(request: Request, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    _require_admin(user)
    users = db.scalars(select(User).order_by(User.name)).all()
    roles = db.scalars(select(Role).order_by(Role.role_name)).all()
    return templates.TemplateResponse(
        request, "users.html",
        _page_context(user, "/admin/users", users=users, roles=roles, error=None),
    )


@router.post("/admin/users")
def create_user(request: Request, name: str = Form(...), email: str = Form(...),
                password: str = Form(...), role_id: int = Form(...),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    normalized_email = email.strip().lower()
    role = db.get(Role, role_id)
    existing = db.scalar(select(User).where(User.email == normalized_email))
    if not name.strip() or not normalized_email or len(password) < 8 or role is None or existing:
        users = db.scalars(select(User).order_by(User.name)).all()
        roles = db.scalars(select(Role).order_by(Role.role_name)).all()
        error = "Provide a name, a unique email, a password of at least 8 characters, and a valid role."
        return templates.TemplateResponse(
            request, "users.html",
            _page_context(user, "/admin/users", users=users, roles=roles, error=error),
            status_code=400,
        )
    created = User(name=name.strip(), email=normalized_email,
                   password_hash=hash_password(password), status="active")
    created.roles.append(role)
    db.add(created)
    db.commit()
    db.refresh(created)
    log_event(db, user.id, "user.create", "success", "user", created.id)
    return RedirectResponse("/admin/users", status_code=303)


@router.post("/admin/users/{user_id}/update")
def update_user(user_id: int, name: str = Form(...), email: str = Form(...),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    normalized_email = email.strip().lower()
    duplicate = db.scalar(select(User).where(User.email == normalized_email, User.id != user_id))
    if not name.strip() or not normalized_email or duplicate:
        raise HTTPException(status_code=400, detail="Name and a unique email are required")
    target.name = name.strip()
    target.email = normalized_email
    db.commit()
    log_event(db, user.id, "user.update", "success", "user", target.id)
    return RedirectResponse("/admin/users", status_code=303)


@router.post("/admin/users/{user_id}/status")
def set_user_status(user_id: int, status: str = Form(...),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if status not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="Status must be active or inactive")
    if target.id == user.id and status == "inactive":
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if status == "inactive" and ADMIN in _role_names(target):
        active_admins = db.scalars(select(User).where(User.status == "active")).all()
        if sum(ADMIN in _role_names(candidate) for candidate in active_admins) <= 1:
            raise HTTPException(status_code=400, detail="The last active administrator cannot be deactivated")
    target.status = status
    db.commit()
    log_event(db, user.id, "user.status", "success", "user", target.id, status)
    return RedirectResponse("/admin/users", status_code=303)


@router.get("/admin/roles", response_class=HTMLResponse)
def roles_page(request: Request, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    _require_admin(user)
    roles = db.scalars(select(Role).order_by(Role.role_name)).all()
    users = db.scalars(select(User).order_by(User.name)).all()
    return templates.TemplateResponse(
        request, "roles.html",
        _page_context(user, "/admin/roles", roles=roles, users=users,
                      role_actions=ROLE_ACTIONS, error=None),
    )


@router.post("/admin/roles/assign")
def assign_role(user_id: int = Form(...), role_id: int = Form(...), operation: str = Form(...),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    target, role = db.get(User, user_id), db.get(Role, role_id)
    if target is None or role is None or operation not in {"assign", "remove"}:
        raise HTTPException(status_code=400, detail="Choose a valid user, role, and operation")
    has_role = role in target.roles
    if operation == "assign" and not has_role:
        target.roles.append(role)
    elif operation == "remove" and has_role:
        if role.role_name == ADMIN and target.status == "active":
            admins = db.scalars(select(User).where(User.status == "active")).all()
            if sum(ADMIN in _role_names(candidate) for candidate in admins) <= 1:
                raise HTTPException(status_code=400, detail="The last active administrator role cannot be removed")
        target.roles.remove(role)
    db.commit()
    log_event(db, user.id, f"role.{operation}", "success", "user", target.id, role.role_name)
    return RedirectResponse("/admin/roles", status_code=303)


@router.get("/teams", response_class=HTMLResponse)
def teams_page(request: Request, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    roles = _role_names(user)
    if not roles & {ADMIN, LEAD}:
        raise HTTPException(status_code=403, detail="Team management access required")
    teams = (db.scalars(select(Team).order_by(Team.team_name)).all()
             if ADMIN in roles else sorted(user.teams, key=lambda team: team.team_name))
    candidates = db.scalars(select(User).where(User.status == "active").order_by(User.name)).all()
    return templates.TemplateResponse(
        request, "teams.html",
        _page_context(user, "/teams", teams=teams, candidates=candidates,
                      is_admin=ADMIN in roles, error=None),
    )


@router.post("/teams")
def create_team(name: str = Form(...), description: str = Form(""),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    team_name = name.strip()
    if not team_name:
        raise HTTPException(status_code=400, detail="Team name is required")
    if db.scalar(select(Team).where(Team.team_name == team_name)):
        raise HTTPException(status_code=400, detail="A team with that name already exists")
    team = Team(team_name=team_name, description=description.strip() or None)
    db.add(team)
    db.commit()
    db.refresh(team)
    log_event(db, user.id, "team.create", "success", "team", team.id)
    return RedirectResponse("/teams", status_code=303)


@router.post("/teams/{team_id}/members")
def add_team_member(team_id: int, user_id: int = Form(...),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team, member = db.get(Team, team_id), db.get(User, user_id)
    if team is None or member is None or member.status != "active":
        raise HTTPException(status_code=400, detail="Choose an existing team and active user")
    _require_team_access(user, team)
    if member not in team.members:
        team.members.append(member)
        db.commit()
        log_event(db, user.id, "team.member.add", "success", "team", team.id,
                  f"user_id={member.id}")
    return RedirectResponse("/teams", status_code=303)


@router.post("/teams/{team_id}/members/{user_id}/remove")
def remove_team_member(team_id: int, user_id: int, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    team, member = db.get(Team, team_id), db.get(User, user_id)
    if team is None or member is None:
        raise HTTPException(status_code=404, detail="Team or user not found")
    _require_team_access(user, team)
    if member in team.members:
        team.members.remove(member)
        db.commit()
        log_event(db, user.id, "team.member.remove", "success", "team", team.id,
                  f"user_id={member.id}")
    return RedirectResponse("/teams", status_code=303)


@router.get("/admin/audit-logs", response_class=HTMLResponse)
def audit_logs_page(request: Request, action: str = "", status: str = "",
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    query = select(AuditLog, User.email).outerjoin(User, User.id == AuditLog.actor_user_id)
    if action.strip():
        query = query.where(AuditLog.action == action.strip())
    if status in {"success", "failure"}:
        query = query.where(AuditLog.status == status)
    rows = db.execute(query.order_by(AuditLog.timestamp.desc()).limit(200)).all()
    actions = db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action)).all()
    events = [{
        "time": row.timestamp.strftime("%d %b %Y, %H:%M UTC"),
        "actor": email or "unknown",
        "action": row.action,
        "status": row.status,
        "target": f"{row.target_type or ''} {row.target_id or ''}".strip() or "—",
        "details": row.details or "",
    } for row, email in rows]
    return templates.TemplateResponse(
        request, "audit_logs.html",
        _page_context(user, "/admin/audit-logs", events=events, actions=actions,
                      selected_action=action, selected_status=status),
    )

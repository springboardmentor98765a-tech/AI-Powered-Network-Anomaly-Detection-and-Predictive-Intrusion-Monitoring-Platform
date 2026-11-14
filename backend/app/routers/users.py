# NetShield AI — User, team and audit log management
# Developed by Krish | SKK Projects
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.auth import get_current_user, hash_password, require_role
from app.database import get_db

router = APIRouter(prefix="/api", tags=["Users & Teams"])


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_role("analyst"))):
    return db.query(models.User).order_by(models.User.id).all()


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(body: schemas.UserCreate, request: Request, db: Session = Depends(get_db),
                admin: models.User = Depends(require_role("admin"))):
    exists = db.query(models.User).filter(
        (models.User.username == body.username) | (models.User.email == body.email)).first()
    if exists:
        raise HTTPException(400, "Username or email already exists")
    user = models.User(username=body.username, email=body.email, full_name=body.full_name,
                       role=body.role, team_id=body.team_id, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, admin, "user_created", f"{user.username} ({user.role})", request)
    return user


@router.patch("/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, body: schemas.UserUpdate, request: Request, db: Session = Depends(get_db),
                admin: models.User = Depends(require_role("admin"))):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    changes = body.model_dump(exclude_unset=True)
    if user.id == admin.id and (changes.get("is_active") is False or changes.get("role", "admin") != "admin"):
        raise HTTPException(400, "You cannot disable or demote your own account")
    if "password" in changes:
        user.hashed_password = hash_password(changes.pop("password"))
    for key, value in changes.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    log_action(db, admin, "user_updated", f"{user.username}: {sorted(changes)}", request)
    return user


@router.get("/teams", response_model=list[schemas.TeamOut])
def list_teams(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Team).order_by(models.Team.name).all()


@router.post("/teams", response_model=schemas.TeamOut, status_code=201)
def create_team(body: schemas.TeamCreate, request: Request, db: Session = Depends(get_db),
                admin: models.User = Depends(require_role("admin"))):
    if db.query(models.Team).filter(models.Team.name == body.name).first():
        raise HTTPException(400, "Team already exists")
    team = models.Team(name=body.name, description=body.description)
    db.add(team)
    db.commit()
    db.refresh(team)
    log_action(db, admin, "team_created", team.name, request)
    return team


@router.get("/audit-logs", response_model=list[schemas.AuditOut])
def audit_logs(limit: int = 200, db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(min(limit, 1000)).all()

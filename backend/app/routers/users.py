from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Role
from ..schemas import UserCreate, UserUpdate, StatusUpdate, RoleUpdate, UserOut, UserList
from ..security import hash_password, password_valid
from ..dependencies import require_permission
from ..audit import audit

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/", status_code=201, response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db),
                actor: User = Depends(require_permission("users.create"))):
    if not password_valid(payload.password):
        raise HTTPException(status_code=422, detail="Password must contain 8 characters with uppercase, lowercase, and a digit")
    if db.query(User).filter(or_(User.email == payload.email.lower(), User.username == payload.username)).first():
        raise HTTPException(status_code=409, detail="Email or username already exists")
    role = db.query(Role).filter(Role.role_name == payload.role).first()
    if not role:
        raise HTTPException(status_code=422, detail="Invalid role")
    user = User(name=payload.name.strip(), username=payload.username, email=payload.email.lower(),
                password_hash=hash_password(payload.password), is_active=payload.is_active, role=role)
    db.add(user)
    db.flush()
    audit(db, actor.id, "user.create", "user", user.id, "success", {"username": user.username, "role": role.role_name})
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=UserList)
def list_users(search: str = "", role: str = "", status: str = "",
               page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               db: Session = Depends(get_db), actor: User = Depends(require_permission("users.view"))):
    query = db.query(User)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(User.name.ilike(like), User.username.ilike(like), User.email.ilike(like)))
    if role:
        query = query.join(Role).filter(Role.role_name == role)
    if status:
        query = query.filter(User.is_active == (status.lower() == "active"))
    total = query.count()
    items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_permission("users.view"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db),
                actor: User = Depends(require_permission("users.update"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "email" in data:
        data["email"] = data["email"].lower()
    if data.get("email") and db.query(User).filter(User.id != user_id, User.email == data["email"]).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    if data.get("username") and db.query(User).filter(User.id != user_id, User.username == data["username"]).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    for key, value in data.items():
        setattr(user, key, value)
    audit(db, actor.id, "user.profile_update", "user", user.id, "success", data)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/status", response_model=UserOut)
def update_status(user_id: int, payload: StatusUpdate, db: Session = Depends(get_db),
                  actor: User = Depends(require_permission("users.status"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == actor.id and not payload.is_active:
        raise HTTPException(status_code=409, detail="You cannot deactivate your own account")
    if not payload.is_active and user.role.role_name == "Administrator":
        active_admins = db.query(User).join(Role).filter(User.is_active == True, Role.role_name == "Administrator").count()
        if active_admins <= 1:
            raise HTTPException(status_code=409, detail="Cannot deactivate the last active administrator")
    user.is_active = payload.is_active
    action = "user.activate" if payload.is_active else "user.deactivate"
    audit(db, actor.id, action, "user", user.id, "success")
    db.commit()
    return user


@router.patch("/{user_id}/role", response_model=UserOut)
def update_role(user_id: int, payload: RoleUpdate, db: Session = Depends(get_db),
                actor: User = Depends(require_permission("users.role"))):
    user = db.query(User).filter(User.id == user_id).first()
    role = db.query(Role).filter(Role.role_name == payload.role).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not role:
        raise HTTPException(status_code=422, detail="Invalid role")
    old_role = user.role.role_name
    if user.id == actor.id and role.role_name != "Administrator":
        raise HTTPException(status_code=409, detail="You cannot remove your own administrator role")
    if old_role == "Administrator" and role.role_name != "Administrator":
        active_admins = db.query(User).join(Role).filter(User.is_active == True, Role.role_name == "Administrator").count()
        if active_admins <= 1:
            raise HTTPException(status_code=409, detail="Cannot remove the last active administrator")
    user.role = role
    audit(db, actor.id, "user.role_change", "user", user.id, "success", {"from": old_role, "to": role.role_name})
    db.commit()
    return user

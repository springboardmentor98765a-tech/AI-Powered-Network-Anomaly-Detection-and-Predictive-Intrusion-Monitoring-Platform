from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Role
from app.schemas import UserCreate, UserResponse, UserStatusUpdate, RoleAssignRequest
from app.security import hash_password
from app.api.dependencies import require_roles
from app.api.audit import log_audit_event

router = APIRouter(prefix="/api/users", tags=["User Management"])

@router.get("/", response_model=list[UserResponse])
def get_users(current_user: User = Depends(require_roles(["Administrator", "Team Lead"])), db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/", response_model=UserResponse)
def create_user(body: UserCreate, current_user: User = Depends(require_roles(["Administrator"])), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = hash_password(body.password)
    user = User(name=body.name, email=body.email, password_hash=hashed_pwd, status="active")
    
    # Assign roles
    roles = db.query(Role).filter(Role.role_name.in_(body.role_names)).all()
    if not roles:
        raise HTTPException(status_code=400, detail="Invalid roles specified")
    user.roles = roles

    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(db, actor_user_id=current_user.id, action="USER_CREATED", target_type="USER", target_id=user.id, status="SUCCESS", details={"email": user.email})
    return user

@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(user_id: int, body: UserStatusUpdate, current_user: User = Depends(require_roles(["Administrator"])), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if body.status not in ["active", "inactive"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    user.status = body.status
    db.commit()
    db.refresh(user)

    log_audit_event(db, actor_user_id=current_user.id, action="USER_STATUS_UPDATED", target_type="USER", target_id=user.id, status="SUCCESS", details={"status": user.status})
    return user

@router.post("/{user_id}/roles")
def assign_role_to_user(user_id: int, body: RoleAssignRequest, current_user: User = Depends(require_roles(["Administrator"])), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    role = db.query(Role).filter(Role.role_name == body.role_name).first()
    if not user or not role:
        raise HTTPException(status_code=404, detail="User or Role not found")
    
    if role not in user.roles:
        user.roles.append(role)
        db.commit()

    log_audit_event(db, actor_user_id=current_user.id, action="ROLE_ASSIGNED", target_type="USER", target_id=user.id, status="SUCCESS", details={"role": role.role_name})
    return {"message": f"Role '{role.role_name}' assigned successfully"}

@router.delete("/{user_id}/roles")
def remove_role_from_user(user_id: int, body: RoleAssignRequest, current_user: User = Depends(require_roles(["Administrator"])), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    role = db.query(Role).filter(Role.role_name == body.role_name).first()
    if not user or not role:
        raise HTTPException(status_code=404, detail="User or Role not found")
    
    # Prevent removing the last role if it would leave the user roleless (optional safety guard)
    if len(user.roles) <= 1 and role in user.roles:
        raise HTTPException(status_code=400, detail="Cannot remove the user's only remaining role")

    if role in user.roles:
        user.roles.remove(role)
        db.commit()

    log_audit_event(db, actor_user_id=current_user.id, action="ROLE_REMOVED", target_type="USER", target_id=user.id, status="SUCCESS", details={"role": role.role_name})
    return {"message": f"Role '{role.role_name}' removed successfully"}

@router.delete("/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(require_roles(["Administrator"])), db: Session = Depends(get_db)):
    # Prevent admin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Administrators cannot delete their own active account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    log_audit_event(db, actor_user_id=current_user.id, action="USER_DELETED", target_type="USER", target_id=user_id, status="SUCCESS", details={"email": user.email})
    return {"message": f"User account ID {user_id} deleted successfully"}
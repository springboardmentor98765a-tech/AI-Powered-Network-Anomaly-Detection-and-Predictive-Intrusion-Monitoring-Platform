from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.team import Team
from app.models.audit import AuditAction, AuditStatus
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserStatusUpdate,
    PasswordResetAdmin,
)
from app.api.deps import (
    get_current_user,
    require_roles,
    get_client_ip,
    log_audit,
)

router = APIRouter(prefix="/users", tags=["User Management"])

@router.get("", response_model=list[UserResponse])
def list_users(
    role: str | None = None,
    team_id: int | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List platform users.
    - Administrators: can view all accounts.
    - Team Leads: can view members of their team.
    - Security Analysts: can view fellow team members.
    """
    query = db.query(User)

    if current_user.role == UserRole.ADMIN:
        # Full view
        pass
    elif current_user.role == UserRole.TEAM_LEAD:
        # Team lead can view all users in their teams
        led_team_ids = [t.id for t in current_user.led_teams]
        if current_user.team_id:
            led_team_ids.append(current_user.team_id)
        query = query.filter(User.team_id.in_(led_team_ids))
    else:
        # Analyst can only view their own team
        if current_user.team_id:
            query = query.filter(User.team_id == current_user.team_id)
        else:
            query = query.filter(User.id == current_user.id)

    if role:
        query = query.filter(User.role == role)
    if team_id:
        query = query.filter(User.team_id == team_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (User.username.ilike(s)) | (User.email.ilike(s)) | (User.full_name.ilike(s))
        )

    users = query.order_by(User.created_at.desc()).all()

    return [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            team_id=u.team_id,
            team_name=u.team.name if u.team else None,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
        for u in users
    ]

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Create a new user account. Restricted to Administrators.
    """
    ip = get_client_ip(request)

    # Check username uniqueness
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username already exists.",
        )

    # Check email uniqueness
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Validate role
    if user_in.role not in UserRole.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{user_in.role}'. Allowed: {UserRole.ALL}",
        )

    # Validate team_id if provided
    if user_in.team_id:
        team = db.query(Team).filter(Team.id == user_in.team_id).first()
        if not team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Team with ID {user_in.team_id} does not exist.",
            )

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
        is_active=True,
        team_id=user_in.team_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(
        db=db,
        action=AuditAction.USER_CREATE,
        target_type="USER",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(new_user.id),
        details={
            "created_username": new_user.username,
            "created_email": new_user.email,
            "assigned_role": new_user.role,
            "team_id": new_user.team_id,
        },
        ip_address=ip,
    )

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        team_id=new_user.team_id,
        team_name=new_user.team.name if new_user.team else None,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
    )

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get specific user profile.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Permission check
    if current_user.role == UserRole.ANALYST and current_user.id != target.id:
        if current_user.team_id != target.team_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot view details of analysts outside your team.",
            )

    return UserResponse(
        id=target.id,
        username=target.username,
        email=target.email,
        full_name=target.full_name,
        role=target.role,
        is_active=target.is_active,
        team_id=target.team_id,
        team_name=target.team.name if target.team else None,
        created_at=target.created_at,
        updated_at=target.updated_at,
    )

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Update user profile or role. Restricted to Administrator.
    """
    ip = get_client_ip(request)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    changes = {}

    if user_in.email and user_in.email != target.email:
        exist = db.query(User).filter(User.email == user_in.email).first()
        if exist and exist.id != target.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already used by another account.",
            )
        changes["email"] = {"old": target.email, "new": user_in.email}
        target.email = user_in.email

    if user_in.full_name:
        changes["full_name"] = {"old": target.full_name, "new": user_in.full_name}
        target.full_name = user_in.full_name

    if user_in.role and user_in.role != target.role:
        if user_in.role not in UserRole.ALL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{user_in.role}'.",
            )
        changes["role"] = {"old": target.role, "new": user_in.role}
        target.role = user_in.role

    if user_in.team_id is not None:
        if user_in.team_id == 0:
            target.team_id = None
            changes["team_id"] = "removed"
        else:
            team = db.query(Team).filter(Team.id == user_in.team_id).first()
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found.",
                )
            changes["team_id"] = {"old": target.team_id, "new": user_in.team_id}
            target.team_id = user_in.team_id

    if user_in.is_active is not None and user_in.is_active != target.is_active:
        if target.id == current_user.id and not user_in.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot deactivate their own account.",
            )
        changes["is_active"] = {"old": target.is_active, "new": user_in.is_active}
        target.is_active = user_in.is_active

    db.commit()
    db.refresh(target)

    action = AuditAction.USER_ROLE_CHANGE if "role" in changes else AuditAction.USER_UPDATE
    log_audit(
        db=db,
        action=action,
        target_type="USER",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(target.id),
        details={"changes": changes},
        ip_address=ip,
    )

    return UserResponse(
        id=target.id,
        username=target.username,
        email=target.email,
        full_name=target.full_name,
        role=target.role,
        is_active=target.is_active,
        team_id=target.team_id,
        team_name=target.team.name if target.team else None,
        created_at=target.created_at,
        updated_at=target.updated_at,
    )

@router.patch("/{user_id}/status")
def toggle_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Activate or deactivate an account. Restricted to Administrator.
    """
    ip = get_client_ip(request)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    if target.id == current_user.id and not status_in.is_active:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own administrative account.",
        )

    target.is_active = status_in.is_active
    db.commit()

    log_audit(
        db=db,
        action=AuditAction.USER_STATUS_CHANGE,
        target_type="USER",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(target.id),
        details={"is_active": target.is_active, "username": target.username},
        ip_address=ip,
    )

    return {
        "message": f"User '{target.username}' has been {'activated' if target.is_active else 'deactivated'}."
    }

@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: PasswordResetAdmin,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Administrator resets a user's password.
    """
    ip = get_client_ip(request)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    target.hashed_password = hash_password(data.new_password)
    db.commit()

    log_audit(
        db=db,
        action=AuditAction.PASSWORD_RESET,
        target_type="USER",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(target.id),
        details={"username": target.username, "reset_by": current_user.username},
        ip_address=ip,
    )

    return {"message": f"Password for '{target.username}' reset successfully."}

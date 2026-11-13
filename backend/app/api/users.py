from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import User, Role, AuditLog
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserRoleUpdate,
    UserStatusUpdate,
    UserResponse
)
from app.core.security import hash_password
from app.api.deps import require_roles


router = APIRouter(
    prefix="/users",
    tags=["User Management"]
)


def serialize_user(user: User):
    """Convert a User database object into an API response."""

    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "status": user.status,
        "roles": sorted(role.role_name for role in user.roles),
        "last_login_at": user.last_login_at
    }


def get_user_or_404(db: Session, user_id: int):
    user = db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return user


def active_admin_count(db: Session):
    return db.scalar(
        select(func.count(User.id))
        .join(User.roles)
        .where(
            Role.role_name == "Administrator",
            User.status == "active"
        )
    ) or 0


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("Administrator"))
):
    """Create a user account. Administrator only."""

    username = data.username.strip().lower()
    email = str(data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(
            or_(
                func.lower(User.username) == username,
                func.lower(User.email) == email
            )
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="A user with this username or email already exists."
        )

    role_ids = set(data.role_ids)

    if len(role_ids) != len(data.role_ids):
        raise HTTPException(
            status_code=400,
            detail="Duplicate role IDs are not allowed."
        )

    roles = db.scalars(
        select(Role).where(Role.id.in_(role_ids))
    ).all()

    if len(roles) != len(role_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more selected roles are invalid."
        )

    user = User(
        name=data.name.strip(),
        username=username,
        email=email,
        password_hash=hash_password(data.password),
        status="active",
        roles=list(roles)
    )

    db.add(user)
    db.flush()

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="USER_CREATED",
            target_type="User",
            target_id=str(user.id),
            status="SUCCESS",
            details={
                "assigned_roles": [role.role_name for role in roles]
            }
        )
    )

    db.commit()
    db.refresh(user)

    return serialize_user(user)


@router.get("", response_model=list[UserResponse])
def list_users(
    search: str | None = Query(default=None, max_length=100),
    account_status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    actor=Depends(require_roles("Administrator"))
):
    """List users with optional filters. Administrator only."""

    query = select(User).options(selectinload(User.roles))

    if search:
        term = f"%{search.strip()}%"

        query = query.where(
            or_(
                User.name.ilike(term),
                User.username.ilike(term),
                User.email.ilike(term)
            )
        )

    if account_status:
        if account_status not in ("active", "inactive"):
            raise HTTPException(
                status_code=400,
                detail="Invalid account status."
            )

        query = query.where(User.status == account_status)

    users = db.scalars(
        query.order_by(User.id).offset(offset).limit(limit)
    ).all()

    return [serialize_user(user) for user in users]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("Administrator"))
):
    """Retrieve an individual user. Administrator only."""

    user = get_user_or_404(db, user_id)

    return serialize_user(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("Administrator"))
):
    """Update basic user information. Administrator only."""

    user = get_user_or_404(db, user_id)

    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No fields supplied for update."
        )

    for field, value in changes.items():
        if value is None:
            raise HTTPException(
                status_code=400,
                detail=f"{field} cannot be empty."
            )

        if field == "name":
            value = value.strip()

            if not value:
                raise HTTPException(
                    status_code=400,
                    detail="Name cannot be empty."
                )

        if field in ("username", "email"):
            value = str(value).strip().lower()

            duplicate = db.scalar(
                select(User).where(
                    func.lower(getattr(User, field)) == value,
                    User.id != user_id
                )
            )

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail=f"This {field} is already in use."
                )

        setattr(user, field, value)

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="USER_UPDATED",
            target_type="User",
            target_id=str(user.id),
            status="SUCCESS",
            details={"changed_fields": list(changes.keys())}
        )
    )

    db.commit()
    db.refresh(user)

    return serialize_user(user)


@router.put("/{user_id}/roles", response_model=UserResponse)
def update_user_roles(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("Administrator"))
):
    """Assign or replace user roles. Administrator only."""

    user = get_user_or_404(db, user_id)

    if user.id == actor.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot modify your own roles."
        )

    role_ids = set(data.role_ids)

    if len(role_ids) != len(data.role_ids):
        raise HTTPException(
            status_code=400,
            detail="Duplicate role IDs are not allowed."
        )

    new_roles = db.scalars(
        select(Role).where(Role.id.in_(role_ids))
    ).all()

    if len(new_roles) != len(role_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more selected roles are invalid."
        )

    currently_admin = any(
        role.role_name == "Administrator"
        for role in user.roles
    )

    will_be_admin = any(
        role.role_name == "Administrator"
        for role in new_roles
    )

    if (
        user.status == "active"
        and currently_admin
        and not will_be_admin
        and active_admin_count(db) <= 1
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot remove the last active administrator."
        )

    user.roles = list(new_roles)

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="USER_ROLES_UPDATED",
            target_type="User",
            target_id=str(user.id),
            status="SUCCESS",
            details={
                "assigned_roles": [
                    role.role_name for role in new_roles
                ]
            }
        )
    )

    db.commit()
    db.refresh(user)

    return serialize_user(user)


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("Administrator"))
):
    """Activate or deactivate an account. Administrator only."""

    user = get_user_or_404(db, user_id)

    if user.id == actor.id and data.status == "inactive":
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account."
        )

    is_admin = any(
        role.role_name == "Administrator"
        for role in user.roles
    )

    if (
        user.status == "active"
        and data.status == "inactive"
        and is_admin
        and active_admin_count(db) <= 1
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate the last active administrator."
        )

    user.status = data.status

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="USER_STATUS_UPDATED",
            target_type="User",
            target_id=str(user.id),
            status="SUCCESS",
            details={"new_status": data.status}
        )
    )

    db.commit()
    db.refresh(user)

    return serialize_user(user)
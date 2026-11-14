
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.database import get_db
from app.models.user import User
from app.models.role import Role
from app.schemas.auth import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token
from app.services.audit import create_audit_log


router = APIRouter(prefix="/auth", tags=["Authentication"])

# Allow a maximum of 5 login attempts per minute per client IP.
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    # Capture the client's IP address for audit records.
    ip_address = request.client.host if request.client else None

    # Normalize email to avoid case and whitespace mismatches.
    normalized_email = str(login_data.email).strip().lower()

    user = db.scalar(
        select(User).where(User.email == normalized_email)
    )

    # Record failed login if the account does not exist
    # or the password is incorrect.
    if user is None or not verify_password(
        login_data.password, user.hashed_password
    ):
        create_audit_log(
            db=db,
            action="LOGIN_FAILED",
            entity_type="USER",
            user_id=user.id if user else None,
            entity_id=str(user.id) if user else normalized_email,
            description="Failed login attempt",
            ip_address=ip_address
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Block inactive accounts.
    if not user.is_active:
        create_audit_log(
            db=db,
            action="LOGIN_BLOCKED",
            entity_type="USER",
            user_id=user.id,
            entity_id=str(user.id),
            description="Login blocked because account is inactive",
            ip_address=ip_address
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive"
        )

    # Resolve the user's current role from the database.
    role = db.get(Role, user.role_id)

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account does not have a valid role"
        )

    # Record successful login.
    create_audit_log(
        db=db,
        action="LOGIN_SUCCESS",
        entity_type="USER",
        user_id=user.id,
        entity_id=str(user.id),
        description=f"User {user.email} logged in successfully",
        ip_address=ip_address
    )

    # Include role claims for the frontend dashboard.
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role_id": user.role_id,
            "role_name": role.name
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

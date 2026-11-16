
import jwt

from fastapi import Request
from app.utils.rate_limit import limiter

from app.schemas.auth import PasswordChangeRequest
from app.utils.security import hash_password, verify_password

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, UserResponse
from app.services.auth_service import login_user
from app.utils.dependencies import get_current_user, bearer_scheme
from app.utils.security import SECRET_KEY, ALGORITHM
from app.models import AuthSession, AuditLog, User


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# LOGIN API
@router.post("/login")
@limiter.limit("5/minute")
def login(
    request: Request,
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    result = login_user(
        db,
        data.identifier,
        data.password
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password"
        )

    user = result["user"]

    return {
        "message": "Login successful",
        "access_token": result["access_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email
        }
    }


# PROFILE API
@router.get("/me", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


# LOGOUT API
@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    credentials=Depends(bearer_scheme),
    db: Session = Depends(get_db)
):

    token = credentials.credentials

    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )

    jti = payload["jti"]

    session = db.query(AuthSession).filter(
        AuthSession.token_jti == jti,
        AuthSession.user_id == current_user.id
    ).first()

    if session and session.revoked_at is None:

        session.revoked_at = datetime.now(timezone.utc)

        log = AuditLog(
            actor_user_id=current_user.id,
            action="LOGOUT",
            target_type="USER",
            target_id=current_user.id,
            status="SUCCESS"
        )

        db.add(log)
        db.commit()

    return {
        "message": "Logout successful"
    }



# CHANGE PASSWORD API
@router.post("/change-password")
def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # Verify current password
    if not verify_password(
        data.current_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    # Prevent reusing the same password
    if verify_password(
        data.new_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="New password must be different"
        )

    # Hash and update new password
    current_user.password_hash = hash_password(data.new_password)

    # Revoke all existing sessions
    sessions = db.query(AuthSession).filter(
        AuthSession.user_id == current_user.id,
        AuthSession.revoked_at.is_(None)
    ).all()

    now = datetime.now(timezone.utc)

    for session in sessions:
        session.revoked_at = now

    # Record audit event
    log = AuditLog(
        actor_user_id=current_user.id,
        action="PASSWORD_CHANGED",
        target_type="USER",
        target_id=current_user.id,
        status="SUCCESS"
    )

    db.add(log)
    db.commit()

    return {
        "message": "Password changed successfully. Please log in again."
    }



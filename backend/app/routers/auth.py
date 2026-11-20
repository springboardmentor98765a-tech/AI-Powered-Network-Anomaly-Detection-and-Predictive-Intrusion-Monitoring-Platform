from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, Field
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.audit import log_action
from app.config import settings
from app.database import get_db
from app.dependencies import (
    get_current_user,
    get_token_payload,
    cleanup_expired_revoked_tokens,
)
from app.models import User, RevokedToken
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

# One generic message for every kind of login failure
LOGIN_ERROR = "Invalid username/email or password."
GOOGLE_ERROR = "Google sign-in failed. Contact your administrator if you need access."

# "Remember me" keeps the token valid for 7 days instead of the default
REMEMBER_MINUTES = 7 * 24 * 60

# A real bcrypt hash used to waste the same time when the user doesn't exist
# (prevents attackers from guessing which usernames exist by measuring response time)
DUMMY_HASH = "$2b$12$N.yaAPGVB.7RMNTW/L6K6.7jSEbZIW1ww2CaQE.022av6JMebZI."


class LoginIn(LoginRequest):
    remember: bool = False


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=10, max_length=5000)
    remember: bool = False


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)


def find_user(db: Session, identifier: str):
    """Find a user by email OR username (case-insensitive)."""
    identifier = identifier.strip().lower()
    return (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == identifier,
                func.lower(User.username) == identifier,
            )
        )
        .first()
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = find_user(db, data.identifier)

    if user is None:
        verify_password(data.password, DUMMY_HASH)  # equalize timing
        log_action(db, "LOGIN", "failure", details="Unknown identifier")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=LOGIN_ERROR)

    password_ok = verify_password(data.password, user.password_hash)

    if not password_ok or user.status != "active":
        reason = "Wrong password" if not password_ok else "Inactive account"
        log_action(db, "LOGIN", "failure", actor_user_id=user.id, details=reason)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=LOGIN_ERROR)

    role_names = [role.role_name for role in user.roles]
    token, _jti, expires_at = create_access_token(
        user.id, role_names, REMEMBER_MINUTES if data.remember else None
    )

    log_action(db, "LOGIN", "success", actor_user_id=user.id, target_type="user", target_id=user.id)

    return TokenResponse(access_token=token, expires_at=expires_at, roles=role_names)


@router.post("/google", response_model=TokenResponse)
def google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    # 1. Verify the token really came from Google (signature, audience, expiry)
    try:
        info = google_id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        # The exact reason goes only into the audit log, never to the user
        log_action(db, "LOGIN", "failure",
                   details=f"Google: invalid token ({str(exc)[:150]})")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GOOGLE_ERROR)

    email = (info.get("email") or "").lower()
    if not email or not info.get("email_verified"):
        log_action(db, "LOGIN", "failure", details="Google: email not verified")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GOOGLE_ERROR)

    # 2. The account must already exist (created by an administrator) and be active
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if user is None or user.status != "active":
        reason = "Google: no matching account" if user is None else "Google: inactive account"
        log_action(db, "LOGIN", "failure", actor_user_id=user.id if user else None, details=reason)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GOOGLE_ERROR)

    # 3. Issue the same JWT as a normal login
    role_names = [role.role_name for role in user.roles]
    token, _jti, expires_at = create_access_token(
        user.id, role_names, REMEMBER_MINUTES if data.remember else None
    )
    log_action(db, "LOGIN", "success", actor_user_id=user.id, target_type="user",
               target_id=user.id, details="Google sign-in")

    return TokenResponse(access_token=token, expires_at=expires_at, roles=role_names)


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = find_user(db, data.identifier)

    # Record the request so an administrator can see it in the Audit Logs
    if user:
        log_action(db, "PASSWORD_RESET_REQUEST", "success", actor_user_id=user.id,
                   target_type="user", target_id=user.id,
                   details="User asked an administrator to reset the password")
    else:
        log_action(db, "PASSWORD_RESET_REQUEST", "failure", details="Unknown identifier")

    # Same answer either way, so attackers can't discover which accounts exist
    return {
        "message": "If an account matches, an administrator has been notified "
                   "and will reset your password."
    }


@router.post("/logout")
def logout(
    payload: dict = Depends(get_token_payload),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Remove old revoked tokens that have already expired (keeps the table small)
    cleanup_expired_revoked_tokens(db)

    # Save this token's unique ID so it is rejected from now on
    db.add(
        RevokedToken(
            jti=payload["jti"],
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        )
    )
    db.commit()

    log_action(db, "LOGOUT", "success", actor_user_id=current_user.id,
               target_type="user", target_id=current_user.id)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
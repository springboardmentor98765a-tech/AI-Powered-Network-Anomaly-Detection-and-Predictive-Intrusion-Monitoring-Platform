from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, hash_password, create_access_token, decode_access_token
from app.models.user import User
from app.models.token_blocklist import TokenBlocklist
from app.models.audit import AuditAction, AuditStatus
from app.schemas.auth import LoginRequest, TokenResponse, LogoutResponse
from app.schemas.user import UserResponse, PasswordChange
from app.api.deps import (
    get_db,
    get_current_user,
    get_current_user_token,
    get_client_ip,
    log_audit,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate Security Analyst, Team Lead, or Administrator.
    - Validates email or username.
    - Compares hashed password.
    - Employs non-revealing error messages on failure.
    - Records audit logs for both successes and failures.
    """
    ip = get_client_ip(request)
    identifier = login_data.username_or_email.strip()

    # Find user by username or email
    user = (
        db.query(User)
        .filter((User.username == identifier) | (User.email == identifier))
        .first()
    )

    # Generic non-revealing error
    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials. Please verify your username/email and password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not user:
        # Record failed attempt for unknown user
        log_audit(
            db=db,
            action=AuditAction.LOGIN_FAILED,
            target_type="AUTH",
            status=AuditStatus.FAILED,
            actor_username=identifier,
            details={"reason": "User not found or credentials mismatch"},
            ip_address=ip,
        )
        raise generic_error

    if not verify_password(login_data.password, user.hashed_password):
        # Record failed attempt for existing user
        log_audit(
            db=db,
            action=AuditAction.LOGIN_FAILED,
            target_type="AUTH",
            status=AuditStatus.FAILED,
            actor_id=user.id,
            actor_username=user.username,
            target_id=str(user.id),
            details={"reason": "Invalid password"},
            ip_address=ip,
        )
        raise generic_error

    if not user.is_active:
        log_audit(
            db=db,
            action=AuditAction.LOGIN_FAILED,
            target_type="AUTH",
            status=AuditStatus.FAILED,
            actor_id=user.id,
            actor_username=user.username,
            target_id=str(user.id),
            details={"reason": "Account is deactivated"},
            ip_address=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your system administrator.",
        )

    # Issue signed JWT token
    token, jti = create_access_token(subject=user.id, role=user.role)

    # Record successful login in audit log
    log_audit(
        db=db,
        action=AuditAction.LOGIN_SUCCESS,
        target_type="AUTH",
        status=AuditStatus.SUCCESS,
        actor_id=user.id,
        actor_username=user.username,
        target_id=str(user.id),
        details={"role": user.role},
        ip_address=ip,
    )

    user_resp = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        team_id=user.team_id,
        team_name=user.team.name if user.team else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )

    return TokenResponse(access_token=token, token_type="bearer", user=user_resp)

@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    auth_data: tuple[User, str, str] = Depends(get_current_user_token),
    db: Session = Depends(get_db),
):
    """
    Logs out the user and revokes the active JWT token by recording its JTI in the token blocklist.
    """
    user, token, jti = auth_data
    ip = get_client_ip(request)

    # Calculate token expiration
    payload = decode_access_token(token)
    exp_timestamp = payload.get("exp") if payload else None
    if exp_timestamp:
        expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=8)

    # Save to revoked token table
    revoked = TokenBlocklist(jti=jti, expires_at=expires_at)
    db.add(revoked)
    db.commit()

    # Record audit log
    log_audit(
        db=db,
        action=AuditAction.LOGOUT,
        target_type="AUTH",
        status=AuditStatus.SUCCESS,
        actor_id=user.id,
        actor_username=user.username,
        target_id=str(user.id),
        details={"message": "User logged out; token revoked"},
        ip_address=ip,
    )

    return LogoutResponse(message="Logged out successfully. Token is now revoked.")

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the profile and role details of the currently authenticated analyst.
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        team_id=current_user.team_id,
        team_name=current_user.team.name if current_user.team else None,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )

@router.post("/change-password")
def change_password(
    data: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows any authenticated user to securely update their own password.
    """
    ip = get_client_ip(request)

    if not verify_password(data.current_password, current_user.hashed_password):
        log_audit(
            db=db,
            action=AuditAction.PASSWORD_CHANGE,
            target_type="USER",
            status=AuditStatus.FAILED,
            actor_id=current_user.id,
            actor_username=current_user.username,
            target_id=str(current_user.id),
            details={"error": "Current password incorrect"},
            ip_address=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()

    log_audit(
        db=db,
        action=AuditAction.PASSWORD_CHANGE,
        target_type="USER",
        status=AuditStatus.SUCCESS,
        actor_id=current_user.id,
        actor_username=current_user.username,
        target_id=str(current_user.id),
        details={"message": "Password changed successfully"},
        ip_address=ip,
    )

    return {"message": "Password updated successfully."}

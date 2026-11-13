import json
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.models.token_blocklist import TokenBlocklist
from app.models.audit import AuditLog, AuditStatus

security_scheme = HTTPBearer(auto_error=False)

def get_client_ip(request: Request) -> str:
    """Extracts client IP address safely, checking X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def log_audit(
    db: Session,
    action: str,
    target_type: str,
    status: str = AuditStatus.SUCCESS,
    actor_id: int | None = None,
    actor_username: str = "ANONYMOUS",
    target_id: str | None = None,
    details: dict | str | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """
    Records an immutable audit log entry.
    Ensures no passwords, tokens, or sensitive values are recorded.
    """
    if isinstance(details, dict):
        sanitized = {k: v for k, v in details.items() if "password" not in k.lower() and "token" not in k.lower()}
        details_str = json.dumps(sanitized)
    else:
        details_str = str(details) if details else None

    audit_entry = AuditLog(
        actor_id=actor_id,
        actor_username=actor_username or "ANONYMOUS",
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        status=status,
        details=details_str,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry

def get_current_user_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> tuple[User, str, str]:
    """
    Validates the bearer token, checks token revocation, and fetches active user.
    Returns (user, token, jti).
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    if jti:
        revoked = db.query(TokenBlocklist).filter(TokenBlocklist.jti == jti).first()
        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact an administrator.",
        )

    return user, token, jti

def get_current_user(
    auth_data: tuple[User, str, str] = Depends(get_current_user_token)
) -> User:
    return auth_data[0]

def require_roles(allowed_roles: list[str]):
    """
    Enforces Role-Based Access Control (RBAC).
    Checks if the current authenticated user's role is in the allowed_roles list.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires one of {allowed_roles}. Current role: '{current_user.role}'."
            )
        return current_user
    return role_checker

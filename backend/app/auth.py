# NetShield AI — Authentication (JWT) and role-based access control (RBAC)
# Developed by Krish | SKK Projects
"""
Login flow, like a school ID card:
  1. User sends username + password.
  2. We check the password against its stored bcrypt 'hash' (we never store real passwords).
  3. We give back a signed JWT token = a digital ID card with the user's name and role.
  4. Every later request shows this token; we read the role to decide what they may do.
"""
import time
from collections import defaultdict, deque
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.database import get_db, utcnow

bearer = HTTPBearer(auto_error=False)
ROLE_LEVEL = {"viewer": 1, "analyst": 2, "admin": 3}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user: models.User) -> str:
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": utcnow() + timedelta(minutes=settings.TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> models.User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    try:
        payload = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(models.User).filter(models.User.username == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    return user


def require_role(minimum: str):
    """Usage: Depends(require_role('analyst')) -> analysts and admins allowed, viewers blocked."""
    def checker(user: models.User = Depends(get_current_user)) -> models.User:
        if ROLE_LEVEL.get(user.role, 0) < ROLE_LEVEL[minimum]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires {minimum} role or higher")
        return user
    return checker


# ---------- Simple rate limiter (part of the 'API gateway' idea): max 10 logins / minute / IP
_login_attempts: dict[str, deque] = defaultdict(deque)


def rate_limit_login(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now, window = time.time(), _login_attempts[ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= 10:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many login attempts, wait a minute")
    window.append(now)

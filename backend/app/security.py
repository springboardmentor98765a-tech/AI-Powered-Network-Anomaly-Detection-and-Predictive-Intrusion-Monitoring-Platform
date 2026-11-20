import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError

from app.config import settings


# ---------- Password hashing ----------

def hash_password(plain_password: str) -> str:
    """Turn a plain password into a bcrypt hash (safe to store in the database)."""
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check whether a plain password matches a stored hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


# ---------- JWT tokens ----------

def create_access_token(
    user_id: int,
    roles: list[str],
    expires_minutes: int | None = None,
) -> tuple[str, str, datetime]:
    """
    Create a signed JWT.
    Returns (token, jti, expiry_time).
    """
    jti = uuid.uuid4().hex  # unique ID for this token (used for logout)
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {
        "sub": str(user_id),   # who the token belongs to
        "roles": roles,        # what roles they have
        "jti": jti,            # unique token ID
        "exp": expire,         # when the token expires
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti, expire


def decode_access_token(token: str) -> dict | None:
    """Verify the signature and expiry. Returns the payload, or None if invalid."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
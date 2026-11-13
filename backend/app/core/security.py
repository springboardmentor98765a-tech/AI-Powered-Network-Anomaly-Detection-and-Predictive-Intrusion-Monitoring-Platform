from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import settings


# Password hashing configuration
password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a password before storing it in the database."""
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Check whether the entered password matches the stored hash."""
    return password_hasher.verify(password, password_hash)


def create_access_token(user_id: int):
    """Generate a signed JWT and its associated session information."""

    now = datetime.now(timezone.utc)

    expires_at = now + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    token_id = str(uuid4())

    payload = {
        "sub": str(user_id),
        "jti": token_id,
        "iat": now,
        "exp": expires_at
    }

    token = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm="HS256"
    )

    return token, token_id, expires_at


def decode_access_token(token: str):
    """Verify and decode a JWT."""

    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=["HS256"],
        options={
            "require": ["sub", "jti", "iat", "exp"]
        }
    )
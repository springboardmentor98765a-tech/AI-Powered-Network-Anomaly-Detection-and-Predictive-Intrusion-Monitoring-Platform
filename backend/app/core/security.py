
from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from app.db.database import settings


# Password hashing using Argon2
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password
    )


# JWT configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


# Generate JWT access token
def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None
) -> str:

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# Verify and decode JWT access token
def decode_access_token(token: str) -> dict | None:

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM]
        )

        return payload

    except InvalidTokenError:
        return None

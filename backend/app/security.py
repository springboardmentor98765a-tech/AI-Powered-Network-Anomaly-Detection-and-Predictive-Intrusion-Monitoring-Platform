import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt, JWTError
from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def password_valid(password: str) -> bool:
    return len(password) >= 8 and any(c.islower() for c in password) and any(c.isupper() for c in password) and any(c.isdigit() for c in password)


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    claims = {"sub": str(user_id), "role": role, "exp": expire, "jti": str(uuid.uuid4()), "iat": datetime.now(timezone.utc)}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str):
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None

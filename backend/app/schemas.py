from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Authentication ----------

class LoginRequest(BaseModel):
    # Can be an email OR a username
    identifier: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    roles: list[str]


# ---------- Users ----------

def _check_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isupper() for c in value):
        raise ValueError("Password must contain an uppercase letter")
    if not any(c.islower() for c in value):
        raise ValueError("Password must contain a lowercase letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("Password must contain a number")
    return value


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(max_length=128)
    role: str = "security_analyst"  # default role

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        return _check_password_strength(v)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    status: Optional[str] = Field(default=None, pattern=r"^(active|inactive)$")


class UserRolesUpdate(BaseModel):
    roles: list[str] = Field(min_length=1)


class RoleOut(BaseModel):
    id: int
    role_name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    name: str
    username: str
    email: EmailStr
    status: str
    created_at: datetime
    roles: list[RoleOut] = []

    model_config = {"from_attributes": True}


class ChangePassword(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        return _check_password_strength(v)


class AdminPasswordReset(BaseModel):
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        return _check_password_strength(v)


# ---------- Teams ----------

class TeamCreate(BaseModel):
    team_name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


class TeamOut(BaseModel):
    id: int
    team_name: str
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberAdd(BaseModel):
    user_id: int


# ---------- Audit logs ----------

class AuditLogOut(BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    status: str
    details: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
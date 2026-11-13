from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    username: str = Field(
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_.-]+$"
    )
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role_ids: list[int] = Field(min_length=1)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_.-]+$"
    )
    email: EmailStr | None = None


class UserRoleUpdate(BaseModel):
    role_ids: list[int] = Field(min_length=1)


class UserStatusUpdate(BaseModel):
    status: Literal["active", "inactive"]


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: str
    status: str
    roles: list[str]
    last_login_at: datetime | None
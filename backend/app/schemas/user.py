
from typing import Literal

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

import re



USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{3,30}$")  # no "@" allowed, on purpose


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    role_id: int

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not USERNAME_PATTERN.match(v):
            raise ValueError("Username may only contain letters, digits, '.', '_' and '-'")
        return v


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    email: EmailStr
    status: str
    created_at: datetime
    updated_at: datetime
    role: RoleOut

class UserStatusUpdate(BaseModel):
    status: Literal["active", "inactive"]


class UserRoleUpdate(BaseModel):
    role_id: int
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleOut(BaseModel):
    id: int
    role_name: str
    description: str
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str
    is_active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    username: Optional[str] = Field(default=None, min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    email: Optional[EmailStr] = None


class StatusUpdate(BaseModel):
    is_active: bool


class RoleUpdate(BaseModel):
    role: str


class UserOut(BaseModel):
    id: int
    name: str
    username: str
    email: str
    is_active: bool
    role: RoleOut
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: UserOut


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TeamCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class TeamUpdate(BaseModel):
    team_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class MemberOut(BaseModel):
    id: int
    name: str
    username: str
    email: str
    role: str
    is_active: bool
    assigned_at: datetime


class TeamOut(BaseModel):
    id: int
    team_name: str
    description: Optional[str]
    created_at: datetime
    member_count: int = 0


class TeamDetail(TeamOut):
    members: list[MemberOut] = []


class MemberAdd(BaseModel):
    user_id: int


class AuditOut(BaseModel):
    id: int
    actor_user_id: Optional[int]
    action: str
    target_type: str
    target_id: Optional[int]
    status: str
    timestamp: datetime
    details: Optional[str]
    model_config = ConfigDict(from_attributes=True)


class UserList(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int

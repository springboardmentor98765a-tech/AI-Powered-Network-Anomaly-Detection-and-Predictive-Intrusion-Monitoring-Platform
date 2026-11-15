from pydantic import BaseModel, EmailStr
from datetime import datetime

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_name: str = "Analyst"

# --- Role & User Schemas ---
class RoleResponse(BaseModel):
    id: int
    role_name: str
    description: str | None = None

    class Config:
        orm_mode = True

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_names: list[str] = ["Security Analyst"]

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    status: str
    created_at: datetime
    roles: list[RoleResponse] = []

    class Config:
        orm_mode = True

class UserStatusUpdate(BaseModel):
    status: str  # 'active' or 'inactive'

class RoleAssignRequest(BaseModel):
    role_name: str

# --- Team Schemas ---
class TeamCreate(BaseModel):
    team_name: str
    description: str | None = None

class TeamMemberAdd(BaseModel):
    user_id: int

class TeamResponse(BaseModel):
    id: int
    team_name: str
    description: str | None = None
    created_at: datetime
    members: list[UserResponse] = []

    class Config:
        orm_mode = True
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("Security Analyst")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    team_id: int | None = None

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: str | None = None
    team_id: int | None = None
    is_active: bool | None = None

class UserStatusUpdate(BaseModel):
    is_active: bool

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

class PasswordResetAdmin(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

class UserSimpleResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    team_id: int | None = None

    class Config:
        from_attributes = True

class UserResponse(UserSimpleResponse):
    created_at: datetime
    updated_at: datetime
    team_name: str | None = None

    class Config:
        from_attributes = True

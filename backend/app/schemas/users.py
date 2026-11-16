
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional


# Create user request
class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    roles: list[str] = Field(
        default_factory=lambda: ["Security Analyst"]
    )


# Update user profile
class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None


# Update user roles
class RoleUpdate(BaseModel):
    roles: list[str] = Field(min_length=1)


# Activate or deactivate user
class UserStatusUpdate(BaseModel):
    is_active: bool


# Reset user password
class PasswordReset(BaseModel):
    new_password: str = Field(min_length=12, max_length=128)


# User response
class UserResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    is_active: bool
    roles: list[str]

    model_config = ConfigDict(from_attributes=True)


from pydantic import BaseModel, EmailStr, Field
from typing import Optional


# Login request
class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


# Token response
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# User profile response
class UserResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    is_active: bool

    class Config:
        from_attributes = True


# Password change request

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


from pydantic import BaseModel, EmailStr, Field, ConfigDict
from .models import Role

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = Role.SECURITY_ANALYST
    organization_name: str | None = Field(default=None, max_length=180)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: Role
    organization_name: str | None
    is_active: bool
    is_verified: bool
    model_config = ConfigDict(from_attributes=True)

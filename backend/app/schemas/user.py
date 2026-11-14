
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Information required when creating a user
class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role_id: int = Field(gt=0)


# Information returned by the API
class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    is_active: bool
    role_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    role_id: int = Field(gt=0)
    is_active: bool

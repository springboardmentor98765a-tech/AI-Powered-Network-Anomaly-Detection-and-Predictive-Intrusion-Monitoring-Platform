
from pydantic import BaseModel, EmailStr


# Information submitted during login
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Information returned after successful login
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

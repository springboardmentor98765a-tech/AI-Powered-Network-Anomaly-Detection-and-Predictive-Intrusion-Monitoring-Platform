from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.user import UserSimpleResponse

class TeamBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None

class TeamCreate(TeamBase):
    lead_id: int | None = None

class TeamUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    lead_id: int | None = None

class TeamMemberAdd(BaseModel):
    user_id: int

class TeamResponse(TeamBase):
    id: int
    lead_id: int | None = None
    lead_name: str | None = None
    members: list[UserSimpleResponse] = []
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

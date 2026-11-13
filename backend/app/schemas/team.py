from datetime import datetime

from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    team_lead_id: int | None = Field(default=None, gt=0)


class TeamUpdate(BaseModel):
    team_name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    team_lead_id: int | None = Field(default=None, gt=0)


class TeamMemberAdd(BaseModel):
    user_id: int = Field(gt=0)


class TeamLeadResponse(BaseModel):
    id: int
    name: str
    username: str


class TeamMemberResponse(BaseModel):
    user_id: int
    name: str
    username: str
    email: str
    roles: list[str]
    assigned_at: datetime


class TeamResponse(BaseModel):
    id: int
    team_name: str
    description: str | None
    created_at: datetime
    created_by_id: int | None
    team_lead: TeamLeadResponse | None
    members: list[TeamMemberResponse]
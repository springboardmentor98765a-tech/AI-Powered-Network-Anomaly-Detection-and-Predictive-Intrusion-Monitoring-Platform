
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TeamCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    team_name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    lead_user_id: int | None = None


class TeamUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Send only what you want to change
    team_name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class TeamLeadUpdate(BaseModel):
    lead_user_id: int | None  # null removes the lead


class MemberAdd(BaseModel):
    user_id: int


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    status: str  # no email on purpose


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserBrief
    assigned_at: datetime


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    lead: UserBrief | None


class TeamDetail(TeamOut):
    members: list[MemberOut]
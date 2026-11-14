
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TeamMemberCreate(BaseModel):
    user_id: int = Field(gt=0)
    team_id: int = Field(gt=0)


class TeamMemberResponse(BaseModel):
    id: int
    user_id: int
    team_id: int
    joined_at: datetime

    # Additional user details for the frontend
    user_full_name: str | None = None
    user_email: str | None = None

    model_config = ConfigDict(from_attributes=True)

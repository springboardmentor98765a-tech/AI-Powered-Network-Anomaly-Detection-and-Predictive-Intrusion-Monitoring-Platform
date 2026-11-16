
from pydantic import BaseModel, Field
from typing import Optional


# Create team
class TeamCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


# Update team
class TeamUpdate(BaseModel):
    team_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


# Assign member to team
class TeamMemberCreate(BaseModel):
    user_id: int = Field(gt=0)


# Team response
class TeamResponse(BaseModel):
    id: int
    team_name: str
    description: Optional[str] = None
    created_by: Optional[int] = None

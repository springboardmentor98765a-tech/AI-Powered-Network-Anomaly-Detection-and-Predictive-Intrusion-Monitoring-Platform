from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None


class TeamUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    is_active: bool


class TeamResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
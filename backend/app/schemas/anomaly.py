import ipaddress
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class SuspiciousActivityReportCreate(BaseModel):
    team_id: int = Field(gt=0)
    activity_type: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=5, max_length=180)
    description: str = Field(min_length=10, max_length=3000)
    source_ip: str | None = Field(default=None, max_length=45)
    destination_ip: str | None = Field(default=None, max_length=45)
    evidence: dict[str, Any] | None = None

    @field_validator("source_ip", "destination_ip")
    @classmethod
    def validate_ip_address(cls, value):
        if value is None or not value.strip():
            return None
        try:
            return str(ipaddress.ip_address(value.strip()))
        except ValueError as exc:
            raise ValueError("A valid IPv4 or IPv6 address is required.") from exc

    @field_validator("activity_type", "title", "description")
    @classmethod
    def strip_text(cls, value):
        return value.strip()


class SuspiciousActivityReportReview(BaseModel):
    decision: Literal["ACTION_TAKEN", "DISMISSED"]
    review_note: str = Field(min_length=3, max_length=1500)

    @field_validator("review_note")
    @classmethod
    def strip_note(cls, value):
        return value.strip()


class SecurityClearanceUpdate(BaseModel):
    level: int = Field(ge=1, le=4)

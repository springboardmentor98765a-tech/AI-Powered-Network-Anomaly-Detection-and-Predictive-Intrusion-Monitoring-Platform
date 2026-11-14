
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class TeamMember(Base):
    __tablename__ = "team_members"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "team_id",
            name="uq_user_team"
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

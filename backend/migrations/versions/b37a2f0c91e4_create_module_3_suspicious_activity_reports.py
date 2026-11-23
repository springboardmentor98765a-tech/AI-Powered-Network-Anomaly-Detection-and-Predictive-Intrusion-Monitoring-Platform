"""Create Module 3 suspicious activity reports.

Revision ID: b37a2f0c91e4
Revises: 9aad58a0af08
Create Date: 2026-11-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b37a2f0c91e4"
down_revision: Union[str, Sequence[str], None] = "9aad58a0af08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suspicious_activity_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("reported_by_user_id", sa.Integer(), nullable=True),
        sa.Column("activity_type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source_ip", sa.String(length=45), nullable=True),
        sa.Column("destination_ip", sa.String(length=45), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING', 'ACTION_TAKEN', 'DISMISSED')",
            name="check_suspicious_report_status",
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reported_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_suspicious_activity_reports_id",
        "suspicious_activity_reports",
        ["id"],
    )
    op.create_index(
        "ix_suspicious_activity_reports_team_id",
        "suspicious_activity_reports",
        ["team_id"],
    )
    op.create_index(
        "ix_suspicious_activity_reports_reported_by_user_id",
        "suspicious_activity_reports",
        ["reported_by_user_id"],
    )
    op.create_index(
        "ix_suspicious_activity_reports_activity_type",
        "suspicious_activity_reports",
        ["activity_type"],
    )
    op.create_index(
        "ix_suspicious_activity_reports_status",
        "suspicious_activity_reports",
        ["status"],
    )
    op.create_index(
        "ix_suspicious_activity_reports_created_at",
        "suspicious_activity_reports",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_suspicious_activity_reports_created_at", table_name="suspicious_activity_reports")
    op.drop_index("ix_suspicious_activity_reports_status", table_name="suspicious_activity_reports")
    op.drop_index("ix_suspicious_activity_reports_activity_type", table_name="suspicious_activity_reports")
    op.drop_index("ix_suspicious_activity_reports_reported_by_user_id", table_name="suspicious_activity_reports")
    op.drop_index("ix_suspicious_activity_reports_team_id", table_name="suspicious_activity_reports")
    op.drop_index("ix_suspicious_activity_reports_id", table_name="suspicious_activity_reports")
    op.drop_table("suspicious_activity_reports")

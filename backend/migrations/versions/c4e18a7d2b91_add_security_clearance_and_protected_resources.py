"""Add independent data-clearance levels and protected demo resources.

Revision ID: c4e18a7d2b91
Revises: b37a2f0c91e4
Create Date: 2026-11-23
"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e18a7d2b91"
down_revision: Union[str, Sequence[str], None] = "b37a2f0c91e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("security_clearance_level", sa.Integer(), nullable=False, server_default="2"),
    )
    op.create_check_constraint(
        "check_user_security_clearance_level",
        "users",
        "security_clearance_level BETWEEN 1 AND 4",
    )

    op.create_table(
        "protected_data_resources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resource_key", sa.String(length=80), nullable=False, unique=True),
        sa.Column("resource_name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("classification_level", sa.Integer(), nullable=False),
        sa.Column("demo_content", sa.Text(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "classification_level BETWEEN 1 AND 4",
            name="check_resource_classification_level",
        ),
    )
    op.create_index(
        "ix_protected_data_resources_classification_level",
        "protected_data_resources",
        ["classification_level"],
    )

    resources = sa.table(
        "protected_data_resources",
        sa.column("id", sa.Integer()),
        sa.column("resource_key", sa.String()),
        sa.column("resource_name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("classification_level", sa.Integer()),
        sa.column("demo_content", sa.Text()),
        sa.column("is_demo", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(resources, [
        {
            "resource_key": "DEMO-PUBLIC-OVERVIEW",
            "resource_name": "[DEMO] Public Network Overview",
            "description": "Sample resource demonstrating Public (Level 1) access.",
            "classification_level": 1,
            "demo_content": "DEMO CONTENT: Public network overview. This sample is provided only to demonstrate clearance checks.",
            "is_demo": True,
            "created_at": now,
        },
        {
            "resource_key": "DEMO-INTERNAL-RUNBOOK",
            "resource_name": "[DEMO] Internal Network Operations Runbook",
            "description": "Sample resource demonstrating Internal (Level 2) access.",
            "classification_level": 2,
            "demo_content": "DEMO CONTENT: Internal network operations runbook. This is fictional training content, not an operational credential or secret.",
            "is_demo": True,
            "created_at": now,
        },
        {
            "resource_key": "DEMO-CONFIDENTIAL-CASE",
            "resource_name": "[DEMO] Confidential Incident Case File",
            "description": "Sample resource demonstrating Confidential (Level 3) access.",
            "classification_level": 3,
            "demo_content": "DEMO CONTENT: Confidential incident case file. Fictional sample used only to verify that Level 2 users are denied access.",
            "is_demo": True,
            "created_at": now,
        },
        {
            "resource_key": "DEMO-RESTRICTED-ARCHITECTURE",
            "resource_name": "[DEMO] Restricted Security Architecture Blueprint",
            "description": "Sample resource demonstrating Restricted (Level 4) access.",
            "classification_level": 4,
            "demo_content": "DEMO CONTENT: Restricted architecture blueprint. Fictional sample used only to verify high-clearance enforcement.",
            "is_demo": True,
            "created_at": now,
        },
    ])
    # Explicitly synchronize the serial sequence after seeding demo rows.
    op.execute(
        "SELECT setval(pg_get_serial_sequence('protected_data_resources', 'id'), "
        "(SELECT MAX(id) FROM protected_data_resources))"
    )


def downgrade() -> None:
    op.drop_index(
        "ix_protected_data_resources_classification_level",
        table_name="protected_data_resources",
    )
    op.drop_table("protected_data_resources")
    op.drop_constraint(
        "check_user_security_clearance_level", "users", type_="check"
    )
    op.drop_column("users", "security_clearance_level")

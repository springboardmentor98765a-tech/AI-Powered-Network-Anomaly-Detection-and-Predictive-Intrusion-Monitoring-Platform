# NetShield AI — Database connection
# Developed by Krish | SKK Projects
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings
from sqlalchemy import inspect, text
connect_args = {"check_same_thread": False, "timeout": 30} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def utcnow() -> datetime:
    """Current UTC time without timezone info (stored the same way in every database)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def migrate_user_registration_columns():
    """Add registration columns without deleting existing user records."""

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        return

    existing = {
        column["name"]
        for column in inspector.get_columns("users")
    }

    migrations = {
        "requested_role":
            "ALTER TABLE users ADD COLUMN requested_role VARCHAR(20)",

        "approval_status":
            "ALTER TABLE users ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'",
    }

    with engine.begin() as connection:
        for column, statement in migrations.items():
            if column not in existing:
                connection.execute(text(statement))

def get_db():
    """FastAPI dependency: opens a DB session for one request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

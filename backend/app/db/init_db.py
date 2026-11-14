
from app.db.database import engine, Base

# Import all models so SQLAlchemy can identify their tables
from app.models import (
    Role,
    User,
    Team,
    TeamMember,
    AuditLog,
)


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("NetShield AI database tables created successfully!")


if __name__ == "__main__":
    create_tables()

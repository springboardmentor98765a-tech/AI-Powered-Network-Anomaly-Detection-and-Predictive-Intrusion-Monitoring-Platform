
from sqlalchemy import select

import app.models  # noqa: F401  (registers the tables)
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.role import Role
from app.models.user import User

ROLES = [
    ("admin", "Manages users, roles, teams and views audit logs"),
    ("security_analyst", "Monitors network activity and investigates alerts"),
    ("team_lead", "Oversees a team of analysts"),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Safe to run many times: only creates what is missing
        for name, description in ROLES:
            if not db.scalar(select(Role).where(Role.role_name == name)):
                db.add(Role(role_name=name, description=description))
        db.commit()

        admin_role = db.scalar(select(Role).where(Role.role_name == "admin"))
        email = settings.FIRST_ADMIN_EMAIL.lower()
        username = settings.FIRST_ADMIN_USERNAME.lower()
        if not db.scalar(select(User).where(User.email == email)):
            db.add(
                User(
                    name="Administrator",
                    username=username,
                    email=email,
                    password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
                    role_id=admin_role.id,
                )
            )
            db.commit()
            print(f"Created first admin: {email} / {username}")
        else:
            print("Admin already exists, nothing to do")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
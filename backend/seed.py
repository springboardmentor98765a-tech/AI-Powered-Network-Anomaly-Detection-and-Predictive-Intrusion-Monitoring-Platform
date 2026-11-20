from app.database import SessionLocal, Base, engine
from app import models  # noqa: F401
from app.models import Role, User
from app.security import hash_password

# ---------- CHANGE THESE before running ----------
ADMIN_NAME = "Akanksha"
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "ChangeMe@12345"
# -------------------------------------------------

ROLES = [
    ("administrator", "Manages users, roles, teams and platform settings"),
    ("security_analyst", "Monitors network activity, reviews alerts and investigates suspicious events"),
    ("team_lead", "Oversees team activity, assigned analysts and team-level dashboards"),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Create the 3 roles (skip if they already exist)
        for role_name, description in ROLES:
            exists = db.query(Role).filter(Role.role_name == role_name).first()
            if not exists:
                db.add(Role(role_name=role_name, description=description))
                print(f"Created role: {role_name}")
        db.commit()

        # 2. Create the first administrator (skip if already there)
        admin = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if admin:
            print("Admin user already exists. Nothing to do.")
            return

        admin_role = db.query(Role).filter(Role.role_name == "administrator").first()
        admin = User(
            name=ADMIN_NAME,
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            status="active",
        )
        admin.roles.append(admin_role)
        db.add(admin)
        db.commit()
        print(f"Created administrator: {ADMIN_USERNAME} / {ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
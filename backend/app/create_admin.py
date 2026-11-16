
from getpass import getpass

from app.database import Base, engine, SessionLocal
from app.models import User, Role, UserRole
from app.utils.security import hash_password

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # Create the three default roles
    role_names = {
        "Administrator": "Manage users, roles, teams and settings",
        "Security Analyst": "Monitor network activity and investigate alerts",
        "Team Lead": "Supervise assigned analysts and teams"
    }

    for name, description in role_names.items():
        role = db.query(Role).filter(
            Role.role_name == name
        ).first()

        if not role:
            db.add(Role(
                role_name=name,
                description=description
            ))

    db.commit()

    print("\nCREATE FIRST ADMINISTRATOR\n")

    full_name = input("Full name: ").strip()
    username = input("Username: ").strip()
    email = input("Email: ").strip().lower()

    if not full_name or not username or not email:
        raise ValueError("All fields are required")

    existing = db.query(User).filter(
        (User.username == username) |
        (User.email == email)
    ).first()

    if existing:
        raise ValueError("Username or email already exists")

    password = getpass("Password (minimum 12 characters): ")
    confirm = getpass("Confirm password: ")

    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")

    if password != confirm:
        raise ValueError("Passwords do not match")

    # Create administrator
    admin = User(
        full_name=full_name,
        username=username,
        email=email,
        password_hash=hash_password(password),
        is_active=True
    )

    db.add(admin)
    db.flush()

    # Assign Administrator role
    admin_role = db.query(Role).filter(
        Role.role_name == "Administrator"
    ).first()

    db.add(UserRole(
        user_id=admin.id,
        role_id=admin_role.id
    ))

    db.commit()

    print("\nAdministrator created successfully!")
    print("Username:", username)
    print("Email:", email)

except Exception as e:
    db.rollback()
    print("\nError:", e)

finally:
    db.close()

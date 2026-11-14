
from getpass import getpass

from sqlalchemy import select

from app.db.database import SessionLocal
from app.models.role import Role
from app.models.user import User
from app.core.security import hash_password


def create_admin():
    print("\n--- NetShield AI Admin Setup ---")

    full_name = input("Enter admin full name: ").strip()
    email = input("Enter admin email: ").strip().lower()

    if not full_name or not email:
        print("Name and email cannot be empty.")
        return

    password = getpass("Enter admin password: ")
    confirm_password = getpass("Confirm admin password: ")

    if len(password) < 8:
        print("Password must contain at least 8 characters.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    with SessionLocal() as db:
        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user:
            print("An account with this email already exists.")
            return

        admin_role = db.scalar(
            select(Role).where(Role.name == "Admin")
        )

        if admin_role is None:
            print("Admin role not found. Run seed_roles first.")
            return

        admin = User(
            full_name=full_name,
            email=email,
            hashed_password=hash_password(password),
            role_id=admin_role.id,
            is_active=True
        )

        db.add(admin)
        db.commit()

        print("\nAdministrator account created successfully!")


if __name__ == "__main__":
    create_admin()

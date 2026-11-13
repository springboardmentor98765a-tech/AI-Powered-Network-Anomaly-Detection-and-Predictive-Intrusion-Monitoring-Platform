from getpass import getpass

from sqlalchemy import select, or_

from app.db.session import SessionLocal
from app.models import User, Role
from app.core.security import hash_password


def create_admin():
    print("\n=== NetShield AI: Initial Admin Setup ===\n")

    name = input("Full name: ").strip()
    username = input("Username: ").strip().lower()
    email = input("Email: ").strip().lower()

    password = getpass("Password (minimum 12 characters): ")
    confirm_password = getpass("Confirm password: ")

    if not all([name, username, email]):
        print("All fields are required.")
        return

    if len(password) < 12:
        print("Password must contain at least 12 characters.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    db = SessionLocal()

    try:
        existing_user = db.scalar(
            select(User).where(
                or_(
                    User.username == username,
                    User.email == email
                )
            )
        )

        if existing_user:
            print("A user with that username or email already exists.")
            return

        admin_role = db.scalar(
            select(Role).where(
                Role.role_name == "Administrator"
            )
        )

        if admin_role is None:
            raise RuntimeError("Administrator role is missing.")

        admin = User(
            name=name,
            username=username,
            email=email,
            password_hash=hash_password(password),
            status="active",
            roles=[admin_role]
        )

        db.add(admin)
        db.commit()

        print("\nAdministrator account created successfully!")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
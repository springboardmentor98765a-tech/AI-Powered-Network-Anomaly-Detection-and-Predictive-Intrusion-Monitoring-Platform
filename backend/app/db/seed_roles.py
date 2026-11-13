from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Role


DEFAULT_ROLES = [
    {
        "role_name": "Administrator",
        "description": "Manage users, roles, teams and platform settings."
    },
    {
        "role_name": "Security Analyst",
        "description": "Monitor network activity and investigate suspicious events."
    },
    {
        "role_name": "Team Lead / Supervisor",
        "description": "Oversee assigned analysts and monitor team activities."
    }
]


def seed_roles():
    db = SessionLocal()

    try:
        existing_roles = set(
            db.scalars(select(Role.role_name)).all()
        )

        new_roles = [
            Role(
                role_name=role["role_name"],
                description=role["description"]
            )
            for role in DEFAULT_ROLES
            if role["role_name"] not in existing_roles
        ]

        if not new_roles:
            print("All default roles already exist.")
            return

        db.add_all(new_roles)
        db.commit()

        print("Default roles added successfully!")

        for role in new_roles:
            print(f"- {role.role_name}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()
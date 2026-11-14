
from sqlalchemy import select

from app.db.database import SessionLocal
from app.models.role import Role


def seed_roles():
    default_roles = [
        {
            "name": "Admin",
            "description": "Manages users, teams and system settings."
        },
        {
            "name": "Analyst",
            "description": "Monitors network activity and investigates security alerts."
        },
        {
            "name": "Viewer",
            "description": "Views dashboards and reports with read-only access."
        }
    ]

    with SessionLocal() as db:
        for role_data in default_roles:
            existing_role = db.scalar(
                select(Role).where(
                    Role.name == role_data["name"]
                )
            )

            if existing_role is None:
                new_role = Role(**role_data)
                db.add(new_role)
                print(f"Created role: {role_data['name']}")
            else:
                print(f"Role already exists: {role_data['name']}")

        db.commit()

    print("Default roles setup completed!")


if __name__ == "__main__":
    seed_roles()

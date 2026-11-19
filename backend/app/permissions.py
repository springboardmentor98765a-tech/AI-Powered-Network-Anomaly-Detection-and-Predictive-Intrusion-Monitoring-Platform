PERMISSIONS = {
    "Administrator": {
        "users.create", "users.view", "users.update", "users.status", "users.role",
        "teams.manage", "teams.view", "audit.view", "profile.view", "profile.password",
    },
    "Security Analyst": {"dashboard.view", "profile.view", "profile.password", "teams.view_assigned"},
    "Team Lead / Supervisor": {"dashboard.view", "teams.view_assigned", "profile.view", "profile.password"},
}


def has_permission(role_name: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(role_name, set())

# Which actions each role is allowed to perform.
# This is the "permission matrix" shown on the Role and Permission page.

ROLE_PERMISSIONS = {
    "administrator": [
        "Manage users (create, update, activate/deactivate)",
        "Assign roles",
        "Create and manage teams",
        "View audit logs",
        "Manage platform settings",
    ],
    "security_analyst": [
        "View network activity",
        "Review alerts",
        "Investigate suspicious events",
        "View own profile and teams",
    ],
    "team_lead": [
        "View team activity and team dashboards",
        "Oversee assigned analysts",
        "Add or remove members in teams",
        "Assign and review incidents",
        "View audit logs",
    ],
}
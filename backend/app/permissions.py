"""Single source of truth for what each role sees on the dashboard."""
ADMIN = "administrator"
LEAD = "team_lead"
ANALYST = "security_analyst"

ROLE_PRIORITY = [ADMIN, LEAD, ANALYST]  # highest first
ROLE_LABELS = {ADMIN: "Administrator", LEAD: "Team Lead / Supervisor", ANALYST: "Security Analyst"}

# Hrefs that exist today. Add a path here when you build that page and it becomes clickable.
IMPLEMENTED = {
    "/dashboard", "/admin/users", "/admin/roles", "/teams",
    "/admin/audit-logs", "/monitoring/activity", "/monitoring/alerts",
}

NAV_ITEMS = [
    {"label": "Dashboard",           "href": "/dashboard",             "roles": {ADMIN, LEAD, ANALYST}},
    {"label": "User Management",     "href": "/admin/users",           "roles": {ADMIN}},
    {"label": "Roles & Permissions", "href": "/admin/roles",           "roles": {ADMIN}},
    {"label": "Team Management",     "href": "/teams",                 "roles": {ADMIN, LEAD}},
    {"label": "Audit Logs",          "href": "/admin/audit-logs",      "roles": {ADMIN}},
    {"label": "Network Activity",    "href": "/monitoring/activity",   "roles": {ANALYST}},
    {"label": "Alerts",              "href": "/monitoring/alerts",     "roles": {ANALYST}},
]

ROLE_ACTIONS = {
    ADMIN: ["Create, update and deactivate user accounts", "Assign roles",
            "Create and manage teams", "View audit logs"],
    LEAD: ["View members of your teams", "Update details of your teams",
           "Review team activity and assigned incidents"],
    ANALYST: ["View network activity", "Review alerts", "Investigate suspicious events"],
}


def primary_role(role_names: set[str]) -> str | None:
    return next((r for r in ROLE_PRIORITY if r in role_names), None)


def nav_for(role_names: set[str]) -> list[dict]:
    return [
        {"label": i["label"], "href": i["href"], "ready": i["href"] in IMPLEMENTED}
        for i in NAV_ITEMS if i["roles"] & role_names
    ]


def actions_for(role_names: set[str]) -> list[str]:
    return [a for r in ROLE_PRIORITY if r in role_names for a in ROLE_ACTIONS[r]]

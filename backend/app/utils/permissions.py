
from fastapi import Depends, HTTPException, status

from app.models import User
from app.utils.dependencies import get_current_user


# Check whether the logged-in user has an allowed role
def require_roles(*allowed_roles):

    def role_checker(
        current_user: User = Depends(get_current_user)
    ):

        # Get roles assigned to the user from the database
        user_roles = [
            user_role.role.role_name
            for user_role in current_user.user_roles
        ]

        # Check whether at least one role is allowed
        if not any(role in allowed_roles for role in user_roles):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )

        return current_user

    return role_checker


# Reusable permission checks
admin_only = require_roles("Administrator")

analyst_only = require_roles("Security Analyst")

team_lead_only = require_roles("Team Lead / Supervisor")


# Allow administrators and team leads
admin_or_team_lead = require_roles(
    "Administrator",
    "Team Lead / Supervisor"
)

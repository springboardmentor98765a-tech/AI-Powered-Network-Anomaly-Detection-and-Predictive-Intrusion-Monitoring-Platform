
import time

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.services import user_service

# ---- Login throttle (in memory) ----
MAX_FAILED_ATTEMPTS = 5
WINDOW_SECONDS = 5 * 60

# email -> list of timestamps of recent failed attempts
_failed_attempts: dict[str, list[float]] = {}

# Used so unknown emails cost the same time as known ones (see authenticate_user)
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _recent_failures(email: str) -> list[float]:
    cutoff = time.time() - WINDOW_SECONDS
    recent = [t for t in _failed_attempts.get(email, []) if t > cutoff]
    if recent:
        _failed_attempts[email] = recent
    else:
        _failed_attempts.pop(email, None)  # keeps the dict from growing forever
    return recent


def is_locked_out(email: str) -> bool:
    return len(_recent_failures(email.lower())) >= MAX_FAILED_ATTEMPTS


def record_failure(email: str) -> None:
    _failed_attempts.setdefault(email.lower(), []).append(time.time())


def clear_failures(email: str) -> None:
    _failed_attempts.pop(email.lower(), None)


# ---- Authentication ----
def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    """Returns the user if credentials are valid and the account is active, else None.
    The caller cannot tell WHY it failed, on purpose."""
    user = user_service.get_user_by_login(db, identifier) 

    if user is None:
        verify_password(password, _DUMMY_HASH)  # burn the same time as a real check
        return None

    if not verify_password(password, user.password_hash):
        return None

    if user.status != "active":
        return None

    return user
from sqlalchemy import func, or_, select 
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password   # was: hash_password only
from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserCreate


class DuplicateEmailError(Exception):
    pass


class DuplicateUsernameError(Exception):
    pass


class RoleNotFoundError(Exception):
    pass


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.lower()))


def get_user_by_login(db: Session, identifier: str) -> User | None:
    """Login accepts email or username. Usernames can't contain '@', so there's no ambiguity."""
    identifier = identifier.strip()
    if "@" in identifier:
        return get_user_by_email(db, identifier)
    return get_user_by_username(db, identifier)


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, data: UserCreate) -> User:
    if db.get(Role, data.role_id) is None:
        raise RoleNotFoundError()

    if get_user_by_email(db, data.email):
        raise DuplicateEmailError()
    if get_user_by_username(db, data.username):
        raise DuplicateUsernameError()

    user = User(
        name=data.name,
        username=data.username.lower(),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role_id=data.role_id,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Race condition: the DB unique constraint caught a duplicate our check missed
        db.rollback()
        if get_user_by_email(db, data.email):
            raise DuplicateEmailError()
        raise DuplicateUsernameError()
    db.refresh(user)
    return user

class WrongPasswordError(Exception):
    pass


def list_users(db: Session, skip: int = 0, limit: int = 50) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id).offset(skip).limit(limit)))


def set_status(db: Session, user: User, new_status: str) -> User:
    user.status = new_status
    db.commit()  # updated_at refreshes automatically via onupdate
    db.refresh(user)
    return user


def set_role(db: Session, user: User, role_id: int) -> User:
    if db.get(Role, role_id) is None:
        raise RoleNotFoundError()
    user.role_id = role_id
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, old_password: str, new_password: str) -> None:
    if not verify_password(old_password, user.password_hash):
        raise WrongPasswordError()
    user.password_hash = hash_password(new_password)
    db.commit()

def search_active_users(db: Session, q: str | None, limit: int = 20) -> list[User]:
    stmt = select(User).where(User.status == "active")
    if q:
        q = q.lower()
        stmt = stmt.where(or_(
            User.username.contains(q, autoescape=True),
            func.lower(User.name).contains(q, autoescape=True),
        ))
    return list(db.scalars(stmt.order_by(User.name).limit(limit)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.role import Role
from app.models.user import User

PASSWORD = "Password@123"


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    for name in ("admin", "security_analyst", "team_lead"):
        db.add(Role(role_name=name))
    db.commit()
    yield db
    db.close()
    engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)  # not used as a context manager, so startup create_all is skipped
    app.dependency_overrides.clear()


def make_user(db, username, role_name, status="active"):
    role = db.query(Role).filter_by(role_name=role_name).one()
    user = User(
        name=username,
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(PASSWORD),
        role_id=role.id,
        status=status,
    )
    db.add(user)
    db.commit()
    return user


def auth_header(client, username):
    r = client.post("/auth/login", data={"username": username, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
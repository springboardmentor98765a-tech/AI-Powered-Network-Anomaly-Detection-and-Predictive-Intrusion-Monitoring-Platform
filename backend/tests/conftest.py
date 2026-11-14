
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.models import Role, User
from app.core.security import hash_password, create_access_token


test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    autocommit=False
)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=test_engine)

    db = TestingSessionLocal()

    admin_role = Role(
        id=1,
        name="Admin",
        description="Administrator"
    )

    analyst_role = Role(
        id=2,
        name="Analyst",
        description="Security Analyst"
    )

    viewer_role = Role(
        id=3,
        name="Viewer",
        description="Read-only user"
    )

    db.add_all([admin_role, analyst_role, viewer_role])
    db.flush()

    admin_user = User(
        id=1,
        full_name="Test Admin",
        email="admin@test.com",
        hashed_password=hash_password("TestAdmin123"),
        role_id=1,
        is_active=True
    )

    analyst_user = User(
        id=2,
        full_name="Test Analyst",
        email="analyst@test.com",
        hashed_password=hash_password("TestAnalyst123"),
        role_id=2,
        is_active=True
    )

    viewer_user = User(
        id=4,
        full_name="Test Viewer",
        email="viewer@test.com",
        hashed_password=hash_password("TestViewer123"),
        role_id=3,
        is_active=True
    )

    db.add_all([admin_user, analyst_user, viewer_user])
    db.commit()
    db.close()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def admin_headers():
    token = create_access_token({"sub": "1"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def analyst_headers():
    token = create_access_token({"sub": "2"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers():
    token = create_access_token({"sub": "4"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_admin_headers(client):
    db = TestingSessionLocal()

    second_admin = User(
        id=3,
        full_name="Second Test Admin",
        email="secondadmin@test.com",
        hashed_password=hash_password("SecondAdmin123"),
        role_id=1,
        is_active=True
    )

    db.add(second_admin)
    db.commit()
    db.close()

    token = create_access_token({"sub": "3"})

    return {"Authorization": f"Bearer {token}"}

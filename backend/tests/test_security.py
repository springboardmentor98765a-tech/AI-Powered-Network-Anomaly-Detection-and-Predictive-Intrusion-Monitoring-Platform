from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)


def test_password_hashing():
    password = "TestPassword123"

    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword123", hashed)


def test_jwt_token_creation():
    token = create_access_token({"sub": "1"})

    assert token is not None

    decoded = decode_access_token(token)

    assert decoded is not None
    assert decoded["sub"] == "1"


def test_invalid_jwt_token():
    decoded = decode_access_token("invalid.token.value")

    assert decoded is None
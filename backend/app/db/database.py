
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# Load database settings from the .env file

class Settings(BaseSettings):
    database_url: str
    secret_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )



settings = Settings()


# Create the connection engine
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True
)


# Create database sessions
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)


# Base class for all database models
class Base(DeclarativeBase):
    pass


# Provide a database session to API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

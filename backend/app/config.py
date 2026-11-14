# NetShield AI — Settings (all values can be changed with environment variables)
# Developed by Krish | SKK Projects
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    # Database: SQLite for easy local runs, PostgreSQL when running in Docker
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'netshield.db'}")

    # JWT security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
    ALGORITHM: str = "HS256"
    TOKEN_EXPIRE_MINUTES: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", "480"))

    # Where trained ML models are saved
    MODEL_DIR: Path = Path(os.getenv("MODEL_DIR", str(BASE_DIR / "models")))

    # Live traffic simulator (acts like a network sensor)
    SIMULATOR_ENABLED: bool = os.getenv("SIMULATOR_ENABLED", "true").lower() == "true"
    SIMULATOR_INTERVAL: float = float(os.getenv("SIMULATOR_INTERVAL", "4"))

    # Frontend URL allowed to call this API (CORS)
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")

    # Optional notification channels (leave empty to only log to console)
    SLACK_WEBHOOK_URL: str = os.getenv("SLACK_WEBHOOK_URL", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    ALERT_EMAIL_TO: str = os.getenv("ALERT_EMAIL_TO", "")


settings = Settings()
settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)

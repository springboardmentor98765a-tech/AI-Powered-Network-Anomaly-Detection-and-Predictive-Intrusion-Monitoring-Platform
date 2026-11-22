# NetShield AI — Settings (all values can be changed with environment variables)
# Developed by Krish | SKK Projects
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()

    # Database: SQLite for easy local runs, PostgreSQL when running in Docker
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'netshield.db'}")

    # JWT security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-development")
    ALGORITHM: str = "HS256"
    TOKEN_EXPIRE_MINUTES: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", "480"))

    # Where trained ML models are saved
    MODEL_DIR: Path = Path(os.getenv("MODEL_DIR", str(BASE_DIR / "models")))

    # Live traffic simulator (acts like a network sensor)
    SIMULATOR_ENABLED: bool = os.getenv("SIMULATOR_ENABLED", "true").lower() == "true"
    SIMULATOR_INTERVAL: float = float(os.getenv("SIMULATOR_INTERVAL", "4"))

    # Optional metadata-only tshark sensor. It is disabled by default because
    # packet capture needs explicit authorization and local OS permissions.
    LIVE_SENSOR_ENABLED: bool = os.getenv("LIVE_SENSOR_ENABLED", "false").lower() == "true"
    LIVE_SENSOR_INTERFACE: str = os.getenv("LIVE_SENSOR_INTERFACE", "en0")
    LIVE_SENSOR_IDLE_SECONDS: float = float(os.getenv("LIVE_SENSOR_IDLE_SECONDS", "5"))

    # Development can demonstrate the app with seeded accounts. Production
    # operators must opt in explicitly; no default credentials are created.
    DEMO_SEED_ENABLED: bool = os.getenv(
        "DEMO_SEED_ENABLED", "true" if ENVIRONMENT == "development" else "false"
    ).lower() == "true"

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
settings.CORS_ORIGINS = [origin.strip() for origin in settings.CORS_ORIGINS if origin.strip()]
if "*" in settings.CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS cannot contain '*' while credentialed requests are enabled.")
if settings.ENVIRONMENT == "production" and (
    not os.getenv("SECRET_KEY")
    or settings.SECRET_KEY == "change-this-secret-key-in-development"
):
    raise RuntimeError("SECRET_KEY must be set to a strong value in production.")
settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    google_client_id: str = ""
    google_client_secret: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

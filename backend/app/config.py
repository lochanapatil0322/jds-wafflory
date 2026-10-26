from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 480  # 8 hours
    ENVIRONMENT: str = "development"
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    DATABASE_URL: str = "sqlite:///./wafflory.db"


settings = Settings()
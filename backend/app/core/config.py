import secrets
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # --- App ---
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: list[str] = Field(default=["http://localhost:5173"])

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str

    # --- Banco ---
    DATABASE_URL: str

    # --- Auth JWT ---
    JWT_SECRET_KEY: str = Field(default_factory=lambda: secrets.token_hex(32))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Biometria (LGPD) ---
    FACIAL_ENCRYPTION_KEY: str  # base64 de 32 bytes AES-256
    FACIAL_SIMILARITY_THRESHOLD: float = 0.75

    # --- NTP (Portaria 671/2021) ---
    NTP_SERVER: str = "a.ntp.br"
    NTP_SYNC_INTERVAL_SECONDS: int = 300  # resync a cada 5 min

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Sentry ---
    SENTRY_DSN: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()  # type: ignore[call-arg]

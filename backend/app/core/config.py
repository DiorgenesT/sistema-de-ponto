import json
import secrets
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, EnvSettingsSource, PydanticBaseSettingsSource, SettingsConfigDict


class _FlexibleEnvSource(EnvSettingsSource):
    """EnvSettingsSource que aceita listas tanto em JSON quanto separadas por vírgula."""

    def decode_complex_value(self, field_name: str, field: Any, value: Any) -> Any:
        if isinstance(value, str) and not value.lstrip().startswith(("[", "{")):
            # Tenta como CSV antes de tentar JSON
            try:
                return [v.strip() for v in value.split(",") if v.strip()]
            except Exception:
                pass
        return super().decode_complex_value(field_name, field, value)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            _FlexibleEnvSource(settings_cls),
            dotenv_settings,
            file_secret_settings,
        )

    # --- App ---
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: list[str] = Field(default=["http://localhost:5173"])

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
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

    # --- Email (notificações) ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@empresa.com"
    SMTP_USE_TLS: bool = True
    # Alternativa: SendGrid API Key (se definida, usa SendGrid em vez de SMTP)
    SENDGRID_API_KEY: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def email_configured(self) -> bool:
        return bool(self.SENDGRID_API_KEY or self.SMTP_HOST)


settings = Settings()  # type: ignore[call-arg]

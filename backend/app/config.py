from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration, read from environment variables (or backend/.env in development)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = Field("development", description="development | test | production")

    # Privileged Postgres connection string. Server-side only: it bypasses row-level security.
    # Supabase: Project Settings → Database → Connection string (use the pooler URI for Render).
    database_url: str

    # Supabase project URL; used to fetch the JWKS for verifying access tokens (asymmetric keys).
    supabase_url: str | None = None
    # Legacy HS256 JWT secret. If set, tokens are verified with it instead of JWKS.
    supabase_jwt_secret: str | None = None
    supabase_jwt_audience: str = "authenticated"

    # Comma-separated list of allowed browser origins, e.g. "https://pathforge.vercel.app,http://localhost:3000"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    db_pool_min: int = 1
    db_pool_max: int = 10

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str) and not v.strip().startswith("["):
            return [o.strip().rstrip("/") for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _require_auth_config(self):
        if not self.supabase_jwt_secret and not self.supabase_url:
            raise ValueError("Set SUPABASE_URL (JWKS verification) or SUPABASE_JWT_SECRET (HS256).")
        return self

    @property
    def jwks_url(self) -> str | None:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json" if self.supabase_url else None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

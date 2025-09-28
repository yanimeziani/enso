"""Configuration helpers for the Enso backend."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from pydantic import BaseModel, field_validator


DEFAULT_DATABASE_URL = "sqlite:///./enso.db"
DEFAULT_AI_MODEL_URL = "http://127.0.0.1:11434"
ALLOWED_AI_MODES = {"local", "remote", "stub", "auto"}


class Settings(BaseModel):
    database_url: str = DEFAULT_DATABASE_URL
    api_debug: bool = False
    sync_page_size: int = 100
    ai_enabled: bool = False
    ai_mode: str = "stub"
    ai_model_url: str | None = DEFAULT_AI_MODEL_URL
    ai_timeout_seconds: float = 8.0

    @field_validator("api_debug", mode="before")
    @classmethod
    def _parse_bool(cls, value: Optional[str] | bool) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        return value.lower() in {"1", "true", "yes", "on"}

    @field_validator("sync_page_size")
    @classmethod
    def _ensure_positive(cls, value: int) -> int:
        if value < 1:
            raise ValueError("sync_page_size must be positive")
        return value

    @field_validator("ai_enabled", mode="before")
    @classmethod
    def _parse_ai_enabled(cls, value: Optional[str] | bool) -> bool:
        return cls._parse_bool(value)  # reuse boolean coercion

    @field_validator("ai_mode")
    @classmethod
    def _validate_mode(cls, value: str) -> str:
        candidate = value.lower()
        if candidate not in ALLOWED_AI_MODES:
            allowed = ", ".join(sorted(ALLOWED_AI_MODES))
            raise ValueError(f"ai_mode must be one of: {allowed}")
        return candidate

    @field_validator("ai_timeout_seconds")
    @classmethod
    def _ensure_timeout_positive(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("ai_timeout_seconds must be positive")
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        api_debug=os.getenv("API_DEBUG"),
        sync_page_size=int(os.getenv("SYNC_PAGE_SIZE", "100")),
        ai_enabled=os.getenv("AI_ENABLED", "false"),
        ai_mode=os.getenv("AI_MODE", "stub"),
        ai_model_url=os.getenv("AI_MODEL_URL", DEFAULT_AI_MODEL_URL),
        ai_timeout_seconds=float(os.getenv("AI_TIMEOUT_SECONDS", "8.0")),
    )


__all__ = ["Settings", "get_settings"]

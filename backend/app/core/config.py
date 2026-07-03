"""Configuracion central de la aplicacion (variables de entorno)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM
    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-5"
    llm_temperature: float = 0.2
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    # Para endpoints compatibles (DeepSeek, Together, Groq, Ollama, etc.):
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_version: str = "default"

    # DB
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/blueprint"
    langgraph_pg_dsn: str = "postgresql://postgres:postgres@localhost:5432/blueprint"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # App
    app_env: str = "development"  # development | staging | production
    cors_origins: str = "http://localhost:3000"

    # Observabilidad (LangSmith) — todo por env, sin acoplar a los agentes
    langsmith_tracing: bool = False
    langsmith_api_key: str | None = None
    langsmith_project: str = "validation-blueprint-dev"
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_hide_inputs: bool = False  # privacidad: oculta prompts en la nube
    langsmith_hide_outputs: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

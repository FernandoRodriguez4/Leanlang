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

    # Investigador (Tavily) — solo configuracion, no activa ninguna ruta de
    # codigo nueva en esta fase (ver docs/plan-agente-investigador-tavily.md).
    tavily_api_key: str | None = None
    research_enabled: bool = True
    research_max_queries: int = 5
    research_results_per_query: int = 5

    # DB
    database_url: str = "postgresql+psycopg://postgres:admin@localhost:5432/blueprint"
    langgraph_pg_dsn: str = "postgresql://postgres:admin@localhost:5432/blueprint"
    # Pool de conexiones SQLAlchemy (Fase 2, ver docs/audits/phase2_rag_architecture_improvements.md).
    # El checkpointer de LangGraph (PostgresSaver) usa su propia conexion unica
    # (psycopg.Connection.connect, no un pool) — es independiente de este pool.
    # Este dimensionamiento cubre solo el CRUD de negocio (auth/projects/blueprints)
    # y la escritura de la proyeccion derivada `blueprints.state`, ambos de vida corta.
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # App
    app_env: str = "development"  # development | staging | production
    cors_origins: str = "http://localhost:3000"

    # Orquestacion (grafo)
    max_revisions: int = 2  # cuantas veces el critico puede devolver al Experiment Design
    messages_window: int = 20  # ventana de trazas conservadas en `messages` (poda por conteo)

    # Fase 2 — validacion temporal de la proyeccion derivada (`blueprints.state`)
    # contra el checkpointer (fuente de verdad). Solo para el periodo de validacion
    # previo a confiar definitivamente en la proyeccion; no es un mecanismo
    # permanente (ver docs/audits/backend_architecture_evolution_validation.md, Punto 2).
    shadow_read_enabled: bool = False

    # Fase 3 — contrato del futuro Knowledge Service (ver
    # docs/audits/phase3_architecture_changes.md). Estos valores no activan
    # ninguna ruta de codigo nueva en esta fase: `semantic_search` es unicamente
    # un `Protocol` sin implementacion (app/catalog/service.py). Se definen aqui
    # para que la Fase 4 solo tenga que consumirlos, sin tocar el mecanismo de
    # configuracion. Sin valor de dimension de vector: depende del proveedor de
    # embeddings, aun no seleccionado.
    embedding_provider: str | None = None
    embedding_model: str | None = None
    rag_top_k: int = 5
    rag_score_threshold: float = 0.0

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

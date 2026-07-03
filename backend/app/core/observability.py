"""Observabilidad con LangSmith — desacoplada de la logica de negocio.

Filosofia (ver plan):
- El tracing se activa SOLO por variables de entorno; los agentes no se tocan.
- LangGraph + LangSmith trazan grafo, nodos y llamadas LLM automaticamente.
- Aqui solo: (1) configuramos LangSmith al arrancar y (2) construimos la metadata
  estandar que se inyecta via RunnableConfig al llamar a graph.stream(...).

Toda la metadata se pasa EXPLICITA por el `config`, asi cruza sin problema el
worker thread donde corre graph.stream (no depende de contextvars).
"""
from __future__ import annotations

import os
import uuid
from copy import deepcopy
from typing import Any

from app.core.config import settings

GRAPH_NAME = "validation_blueprint"


def tracing_enabled() -> bool:
    """True solo si el ambiente lo activa y hay API key."""
    return bool(settings.langsmith_tracing and settings.langsmith_api_key)


def configure_langsmith() -> None:
    """Fija las variables de entorno de LangSmith al arrancar la app.

    Idempotente y seguro: si el tracing esta desactivado, lo deja explicitamente en
    'false' para no enviar nada. Se llama una vez en el lifespan de FastAPI.
    """
    if not tracing_enabled():
        os.environ["LANGSMITH_TRACING"] = "false"
        print("[observability] LangSmith tracing DESACTIVADO.", flush=True)
        return

    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key or ""
    os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
    os.environ["LANGSMITH_ENDPOINT"] = settings.langsmith_endpoint
    if settings.langsmith_hide_inputs:
        os.environ["LANGSMITH_HIDE_INPUTS"] = "true"
    if settings.langsmith_hide_outputs:
        os.environ["LANGSMITH_HIDE_OUTPUTS"] = "true"
    print(f"[observability] LangSmith tracing ACTIVO (proyecto: {settings.langsmith_project}).", flush=True)


def build_run_config(
    thread_id: str,
    *,
    user_id: str | uuid.UUID,
    project_id: str | uuid.UUID,
    blueprint_id: str | uuid.UUID,
    phase: str | None = None,
    base: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Construye el RunnableConfig para una corrida del grafo.

    Mantiene el `thread_id` (lo usa el checkpointer) y le ANADE metadata/tags/run_name
    para LangSmith. Si el tracing esta off, devuelve solo el config minimo.

    Notas de diseno:
    - `session_id = thread_id`: agrupa los multiples runs que genera el interrupt/resume.
    - `sprint_id` no existe en el dominio -> se mapea a `blueprint_id` (la version).
    - `hypothesis_id` no aplica a nivel de corrida (una corrida tiene ~12) -> se omite.
    - `agent_name`/`phase_name` por nodo ya los pone LangGraph con el nombre del nodo.
    """
    config: dict[str, Any] = deepcopy(base) if base else {}
    config.setdefault("configurable", {})["thread_id"] = thread_id

    if not tracing_enabled():
        return config

    # user_id/project_id/blueprint_id llegan como uuid.UUID (ORM nativo) o str;
    # se normalizan a str aqui, exclusivamente para metadata/tags de LangSmith.
    user_id = str(user_id) if user_id is not None else None
    project_id = str(project_id) if project_id is not None else None
    blueprint_id = str(blueprint_id) if blueprint_id is not None else None

    phase_clean = phase.strip() if isinstance(phase, str) else None
    phase_clean = phase_clean or None  # "" → None

    config["run_name"] = f"{GRAPH_NAME}/{phase_clean}" if phase_clean else GRAPH_NAME
    _tags: list[str] = [settings.app_env, GRAPH_NAME]
    if phase_clean:
        _tags.append(f"phase:{phase_clean}")
        if phase_clean.startswith("resume:"):
            _tags.append("resume")
        elif phase_clean == "full_run":
            _tags.append("full_run")
    if project_id and project_id.strip():
        _tags.append(f"project:{project_id.strip()}")
    if blueprint_id and blueprint_id.strip():
        _tags.append(f"blueprint:{blueprint_id.strip()}")
    _seen: set[str] = set()
    config["tags"] = [t for t in _tags if not (t in _seen or _seen.add(t))]
    config["metadata"] = {
        "session_id": thread_id,
        "user_id": user_id,
        "project_id": project_id,
        "blueprint_id": blueprint_id,
        "environment": settings.app_env,
        "graph_name": GRAPH_NAME,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_temperature": settings.llm_temperature,
        "llm_version": settings.llm_version,
    }
    if phase_clean:
        config["metadata"]["phase_name"] = phase_clean
    return config

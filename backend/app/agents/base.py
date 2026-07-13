"""Utilidades compartidas por los nodos/agentes."""
from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, RemoveMessage


def trace(agent: str, text: str, *, version: str | None = None) -> AIMessage:
    """Mensaje de traza para streaming/observabilidad (incluye el nombre del agente)."""
    content = f"[{version}] {text}" if version else text
    return AIMessage(content=content, name=agent)


def prune_messages(messages: list[BaseMessage], *, window: int) -> list[RemoveMessage]:
    """Poda por conteo de `messages`: devuelve `RemoveMessage` para lo mas antiguo
    que exceda `window`, respetando el reducer `add_messages` (identifica por id).

    No resume ni reescribe contenido: `messages` es traza de streaming/observabilidad,
    no memoria que se reinyecte a los prompts de los agentes.
    """
    if len(messages) <= window:
        return []
    return [RemoveMessage(id=m.id) for m in messages[:-window] if m.id is not None]


def jdump(obj: Any) -> str:
    """Serializa a JSON legible para meter contexto en los prompts."""
    return json.dumps(obj, ensure_ascii=False, indent=2)


def research_context(state: dict) -> str:
    """Serializa `state["research"]` (ResearchReport) para inyectarlo como evidencia
    externa en los prompts. Devuelve "" si aun no hay investigacion (aditivo: el
    prompt queda identico al actual cuando no hay research).
    """
    research = state.get("research")
    if not research:
        return ""
    return jdump(research)

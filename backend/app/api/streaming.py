"""Puente de streaming: convierte el stream sincrono de LangGraph en eventos SSE async.

Ejecuta graph.stream(...) en un hilo y empuja los chunks a una asyncio.Queue para
poder emitirlos como Server-Sent Events sin bloquear el event loop.
"""
from __future__ import annotations

import asyncio
import json
import threading
from collections.abc import AsyncGenerator
from typing import Any

from langchain_core.messages import RemoveMessage

ARTIFACT_FIELDS = [
    "problem",
    "customer_segment",
    "value_proposition",
    "business_model",
    "hypotheses",
    "classifications",
    "prioritization",
    "recommendations",
    "metric_specs",
    "success_criteria",
    "decisions",
    "validation_roadmap",
    "plan_estimate",
    "test_cards",
    "critic_review",
    "report",
]


def serialize_blueprint(values: dict[str, Any]) -> dict[str, Any]:
    """Extrae los artefactos serializables del estado (sin los message objects)."""
    return {k: values.get(k) for k in ARTIFACT_FIELDS if values.get(k) is not None}


def _trace_text(update: dict[str, Any]) -> str | None:
    """Texto de la ultima traza real de un write de nodo.

    Ignora `RemoveMessage` (poda de `messages` por conteo, ver app/agents/base.py:prune_messages):
    no llevan contenido y no deben interpretarse como la traza del nodo.
    """
    msgs = update.get("messages") if isinstance(update, dict) else None
    if not msgs:
        return None
    for m in reversed(msgs):
        if isinstance(m, RemoveMessage):
            continue
        content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else None)
        if content:
            return content
    return None


async def event_stream(graph, payload, config) -> AsyncGenerator[dict, None]:
    """Genera eventos SSE: agent_update / interrupt / artifact / error.

    El llamador es responsable de emitir 'done' tras agotar este generador
    (necesita leer el estado final y persistir)."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def worker():
        try:
            for chunk in graph.stream(payload, config=config, stream_mode="updates"):
                loop.call_soon_threadsafe(queue.put_nowait, ("chunk", chunk))
        except Exception as exc:  # pragma: no cover
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, ("end", None))

    threading.Thread(target=worker, daemon=True).start()

    while True:
        kind, data = await queue.get()
        if kind == "end":
            break
        if kind == "error":
            yield {"event": "error", "data": json.dumps({"message": data}, ensure_ascii=False)}
            break

        chunk: dict = data
        if "__interrupt__" in chunk:
            interrupts = chunk["__interrupt__"]
            value = interrupts[0].value if interrupts else {}
            yield {"event": "interrupt", "data": json.dumps(value, ensure_ascii=False)}
            continue

        for node, update in chunk.items():
            text = _trace_text(update)
            payload_out = {"node": node, "trace": text}
            # adjuntar artefactos producidos por este nodo
            arts = {k: update[k] for k in ARTIFACT_FIELDS if isinstance(update, dict) and k in update}
            if arts:
                payload_out["artifacts"] = arts
            yield {"event": "agent_update", "data": json.dumps(payload_out, ensure_ascii=False)}

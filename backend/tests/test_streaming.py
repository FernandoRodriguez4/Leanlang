"""Tests de integracion _trace_text <-> prune_messages (poda de `messages` + streaming SSE)."""
from __future__ import annotations

from langchain_core.messages import AIMessage

from app.agents.base import prune_messages, trace
from app.api.streaming import _trace_text


def test_trace_text_returns_content_when_no_pruning():
    update = {"messages": [trace("problem", "Problema estructurado: x")]}
    assert _trace_text(update) == "Problema estructurado: x"


def test_trace_text_skips_remove_messages_from_pruning():
    """Regresion: cuando la ventana de `messages` se excede, prune_messages() agrega
    RemoveMessage al final del write del nodo; _trace_text debe seguir devolviendo el
    texto de la traza real, no None."""
    old_msgs = [AIMessage(content=f"m{i}", id=str(i)) for i in range(25)]
    pruned = prune_messages(old_msgs, window=20)
    assert pruned, "la fixture debe generar RemoveMessage para ejercer la regresion"

    update = {"messages": [trace("bump_revision", "Re-disenando experimentos segun feedback del critico."), *pruned]}
    assert _trace_text(update) == "Re-disenando experimentos segun feedback del critico."


def test_trace_text_none_when_only_remove_messages():
    old_msgs = [AIMessage(content=f"m{i}", id=str(i)) for i in range(25)]
    pruned = prune_messages(old_msgs, window=20)
    assert _trace_text({"messages": pruned}) is None


def test_trace_text_none_when_no_messages_key():
    assert _trace_text({}) is None
    assert _trace_text({"messages": []}) is None

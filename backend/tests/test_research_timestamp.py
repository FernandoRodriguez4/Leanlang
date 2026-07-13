"""Verifica que `research_node` capture un unico timestamp (`generated_at`) al
inicio de su ejecucion, antes de invocar Tavily/LLM, y que ese valor nunca se
recalcule -- ni si la sintesis demora, ni si el LLM devuelve su propio valor,
ni en el camino de fallo. Es la unica fuente de verdad que luego se propaga
sin cambios hasta `ResearchReport`, `BlueprintState`, la persistencia, la API
y el frontend (ver docs/plan-agente-investigador-tavily.md).
"""
from __future__ import annotations

import time
from datetime import datetime, timezone

import pytest

from app.agents import research as research_module
from app.schemas.research import ResearchReport


class _FakeStructuredModel:
    """Simula latencia de sintesis y devuelve un `generated_at` distinto al
    real, para probar que el nodo lo pisa con el timestamp capturado al inicio."""

    def __init__(self, delay: float, bogus_generated_at: str):
        self.delay = delay
        self.bogus_generated_at = bogus_generated_at

    def invoke(self, _msgs):
        time.sleep(self.delay)
        return ResearchReport(status="completed", generated_at=self.bogus_generated_at)


@pytest.fixture
def state():
    return {"research_plan": {"queries": ["mercado de kits de ciencia"]}}


def test_generated_at_captured_before_tavily_and_llm(monkeypatch, state):
    delay = 0.05
    bogus = "2000-01-01T00:00:00+00:00"

    def slow_search_all(queries):
        time.sleep(delay)
        return [{"query": q, "result": {}} for q in queries]

    monkeypatch.setattr(research_module, "_search_all", slow_search_all)
    monkeypatch.setattr(
        research_module,
        "get_structured_model",
        lambda schema: _FakeStructuredModel(delay, bogus),
    )

    before = datetime.now(timezone.utc)
    result = research_module.research_node(state)
    after = datetime.now(timezone.utc)

    report = result["research"]
    generated_at = datetime.fromisoformat(report["generated_at"])

    # El timestamp final NO es el que devolvio el LLM: el nodo lo pisa.
    assert report["generated_at"] != bogus
    # Capturado dentro de la ventana de la llamada...
    assert before <= generated_at <= after
    # ...pero mucho antes de que terminen Tavily + la sintesis (2 * delay),
    # es decir: se tomo al INICIO del nodo, no al final.
    assert (after - generated_at).total_seconds() >= delay


def test_generated_at_not_recomputed_on_failure(monkeypatch, state):
    def failing_search_all(_queries):
        raise RuntimeError("tavily down")

    monkeypatch.setattr(research_module, "_search_all", failing_search_all)

    before = datetime.now(timezone.utc)
    result = research_module.research_node(state)
    after = datetime.now(timezone.utc)

    report = result["research"]
    assert report["status"] == "failed"
    generated_at = datetime.fromisoformat(report["generated_at"])
    assert before <= generated_at <= after


def test_generated_at_survives_serialization_unchanged(monkeypatch, state):
    """El dict que vuelve del nodo (el que se persiste tal cual en el checkpoint,
    `blueprints.state` y la respuesta SSE) debe llevar el mismo string ISO, sin
    reformatear ni recalcular."""

    monkeypatch.setattr(research_module, "_search_all", lambda queries: [])
    monkeypatch.setattr(
        research_module,
        "get_structured_model",
        lambda schema: _FakeStructuredModel(0, "irrelevant"),
    )

    result = research_module.research_node(state)
    report = result["research"]

    # model_dump(mode="json") no debe alterar el formato del ISO string.
    datetime.fromisoformat(report["generated_at"])  # no lanza -> formato ISO valido
    assert report["generated_at"].endswith("+00:00")

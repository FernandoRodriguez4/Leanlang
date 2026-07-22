"""Agente Investigador: ejecuta Tavily sobre las queries del ResearchPlan y sintetiza
un ResearchReport. No decide nada (la decision de ejecutar vive en el Supervisor) y
un fallo de Tavily o del LLM de sintesis nunca detiene el pipeline.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from langchain_core.messages import HumanMessage, SystemMessage
from tavily import TavilyClient

from app.agents.base import jdump, trace
from app.agents.prompts import RESEARCH_PROMPT_VERSION, RESEARCH_SYSTEM
from app.core.config import settings
from app.core.llm import get_structured_model
from app.schemas.research import ResearchReport
from app.schemas.state import BlueprintState


def _search_all(queries: list[str]) -> list[dict]:
    """Ejecuta las queries (de-duplicadas) contra Tavily en paralelo."""
    deduped = list(dict.fromkeys(q.strip() for q in queries if q and q.strip()))
    if not deduped:
        return []
    client = TavilyClient(api_key=settings.tavily_api_key)
    with ThreadPoolExecutor(max_workers=len(deduped)) as executor:
        futures = [
            executor.submit(client.search, q, max_results=settings.research_results_per_query)
            for q in deduped
        ]
        return [{"query": q, "result": f.result()} for q, f in zip(deduped, futures)]


def research_node(state: BlueprintState) -> dict:
    """Investigador: lee `state["research_plan"]["queries"]`, ejecuta Tavily y
    sintetiza el `ResearchReport`. `status`, `generated_at` y `queries` los fija
    el propio nodo (no dependen del LLM).
    """
    # Unica fuente de verdad del timestamp: se captura al entrar al nodo, antes
    # de tocar Tavily o el LLM de sintesis, y nunca se recalcula mas adelante
    # (ni en el nodo, ni en la persistencia, ni en la API, ni en el frontend).
    generated_at = datetime.now(timezone.utc).isoformat()
    queries = (state.get("research_plan") or {}).get("queries") or []

    try:
        results = _search_all(queries)
        model = get_structured_model(ResearchReport, tier="low")
        synth_msgs = [
            SystemMessage(content=RESEARCH_SYSTEM),
            HumanMessage(
                content=(
                    f"Queries ejecutadas:\n{jdump(queries)}\n\n"
                    f"Resultados de busqueda (Tavily):\n{jdump(results)}"
                )
            ),
        ]
        report: ResearchReport = model.invoke(synth_msgs)
        report.queries = queries
        report.generated_at = generated_at
        summary = f"Investigacion completada: {len(report.sources)} fuentes."
    except Exception as exc:  # tolerancia a fallos: Tavily/LLM nunca detienen el pipeline
        report = ResearchReport(status="failed", generated_at=generated_at, queries=queries)
        summary = f"Investigacion fallida ({exc}); el pipeline continua sin evidencia externa."

    return {
        "research": report.model_dump(mode="json"),
        "messages": [trace("research", summary, version=RESEARCH_PROMPT_VERSION)],
    }

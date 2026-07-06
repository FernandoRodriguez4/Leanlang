"""Servicio de catalogo: carga y consulta filtrable de los 44 experimentos.

Lee el JSON curado (fuente de verdad) sin depender de la base de datos, de modo
que los agentes y los tests funcionen sin Postgres.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol, Sequence

from langsmith import traceable

from app.schemas.experiment import ExperimentCatalogItem

_CATALOG_PATH = Path(__file__).parent / "experiments.json"


class KnowledgeService(Protocol):
    """Contrato publico del futuro Knowledge Service (Fase 3, ver
    docs/audits/phase3_architecture_changes.md #4 y #8).

    `query_experiments` ya esta satisfecho hoy por las funciones de este modulo
    (busqueda exacta sobre el catalogo curado de 44 experimentos). `semantic_search`
    es unicamente la firma publica del segundo modo de recuperacion (semantico,
    sobre pgvector); su implementacion pertenece exclusivamente a la Fase 4 y no
    tiene cuerpo ejecutable aqui -- es un `Protocol` (tipado estructural), no una
    clase instanciable ni un stub en runtime.

    El tipo de retorno de `semantic_search` se deja deliberadamente generico
    (`Sequence[Any]`) para no acoplar el contrato a un esquema de datos (p. ej. un
    futuro `KnowledgeChunk`) que aun no existe y que se definira en la Fase 4 junto
    con la tabla de conocimiento.

    Una vez aprobada, esta firma publica se congela: la implementacion de
    `semantic_search` podra cambiar libremente en la Fase 4, pero la interfaz no
    debe romperse sin pasar de nuevo por aprobacion explicita.
    """

    def query_experiments(
        self,
        risk_type: str | None = None,
        stage: str | None = None,
        max_cost: int | None = None,
        max_setup_time: int | None = None,
        min_evidence_strength: int | None = None,
        limit: int = 10,
    ) -> list[ExperimentCatalogItem]: ...

    def semantic_search(self, query: str, top_k: int = 5) -> Sequence[Any]: ...


@lru_cache
def load_catalog() -> list[ExperimentCatalogItem]:
    raw = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    return [ExperimentCatalogItem(**item) for item in raw]


@lru_cache
def _by_id() -> dict[str, ExperimentCatalogItem]:
    return {e.id: e for e in load_catalog()}


def get_experiment(experiment_id: str) -> ExperimentCatalogItem | None:
    return _by_id().get(experiment_id)


# Es la unica "tool" real del sistema (busqueda en el catalogo de 44). La instrumentamos
# con @traceable para que en LangSmith anide bajo el run del Experiment Design Agent.
# Cuando el tracing esta off, @traceable es un no-op practicamente sin costo.
@traceable(run_type="tool", name="catalog.query_experiments")
def query_experiments(
    risk_type: str | None = None,
    stage: str | None = None,
    max_cost: int | None = None,
    max_setup_time: int | None = None,
    min_evidence_strength: int | None = None,
    limit: int = 10,
) -> list[ExperimentCatalogItem]:
    """Filtra el catalogo por tipo de hipotesis, etapa y restricciones.

    Ordena por: mayor evidencia, luego menor costo y menor tiempo de setup
    (refleja la regla del libro: barato/rapido primero, evidencia tan fuerte como se pueda).
    """
    items = load_catalog()

    def ok(e: ExperimentCatalogItem) -> bool:
        if risk_type and risk_type not in [t.value for t in e.types]:
            return False
        if stage and e.category.value != stage:
            return False
        if max_cost is not None and e.cost > max_cost:
            return False
        if max_setup_time is not None and e.setup_time > max_setup_time:
            return False
        if min_evidence_strength is not None and e.evidence_strength < min_evidence_strength:
            return False
        return True

    filtered = [e for e in items if ok(e)]
    filtered.sort(key=lambda e: (-e.evidence_strength, e.cost, e.setup_time))
    return filtered[:limit]


def get_pairings(experiment_id: str) -> dict[str, list[str]]:
    e = get_experiment(experiment_id)
    if not e:
        return {"before": [], "after": []}
    return {"before": e.pairings_before, "after": e.pairings_after}

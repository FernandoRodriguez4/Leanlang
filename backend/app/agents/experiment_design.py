"""Experiment Design Agent: selecciona del catalogo (44) Y disena el detalle concreto.

Enfoque hibrido: ancla al catalogo real (experiment_id) y ademas produce design_detail
(guion de entrevista, copy de landing, alcance de MVP, pasos del test).
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import EXPERIMENT_DESIGN_PROMPT_VERSION, EXPERIMENT_DESIGN_SYSTEM
from app.catalog import service
from app.core.llm import get_structured_model
from app.schemas.experiment import ExperimentRecList
from app.schemas.state import BlueprintState

_BUDGET_MAX_COST = {"very_low": 1, "low": 2, "medium": 3, "high": 5}
_TIME_MAX_SETUP = {"days": 2, "weeks": 3, "months": 5}


def _build_candidate_pool(state: BlueprintState) -> list[dict]:
    """Conjunto PERMITIDO de experimentos segun riesgos y restricciones (anclaje al catalogo)."""
    constraints = state.get("constraints", {}) or {}
    max_cost = _BUDGET_MAX_COST.get(constraints.get("budget_level", "low"), 2)
    max_setup = _TIME_MAX_SETUP.get(constraints.get("time_horizon", "weeks"), 3)

    prio = {p["hypothesis_id"]: p for p in state.get("prioritization", [])}
    cls = {c["hypothesis_id"]: c for c in state.get("classifications", [])}

    riskiest_ids = [hid for hid, p in prio.items() if p.get("is_riskiest")]
    if not riskiest_ids:
        riskiest_ids = sorted(prio, key=lambda h: prio[h].get("importance", 0), reverse=True)[:4]

    risk_types = {cls.get(hid, {}).get("risk_type") for hid in riskiest_ids}
    risk_types.discard(None)
    if not risk_types:
        risk_types = {"desirability"}

    pool: dict[str, dict] = {}
    for rt in risk_types:
        for stage in ("discovery", "validation"):
            for e in service.query_experiments(
                risk_type=rt, stage=stage, max_cost=max_cost, max_setup_time=max_setup, limit=6
            ):
                pool[e.id] = {
                    "id": e.id, "name": e.name, "stage": e.category.value,
                    "types": [t.value for t in e.types], "cost": e.cost,
                    "setup_time": e.setup_time, "run_time": e.run_time,
                    "evidence_strength": e.evidence_strength, "description": e.description,
                }
    return list(pool.values())


def experiment_design_node(state: BlueprintState) -> dict:
    pool = _build_candidate_pool(state)
    allowed_ids = {e["id"] for e in pool}

    prio = state.get("prioritization", [])
    riskiest = [p for p in prio if p.get("is_riskiest")] or sorted(
        prio, key=lambda p: p.get("importance", 0), reverse=True
    )[:4]
    hyp_by_id = {h["id"]: h for h in state.get("hypotheses", [])}
    cls_by_id = {c["hypothesis_id"]: c for c in state.get("classifications", [])}

    enriched = [
        {
            "hypothesis_id": p["hypothesis_id"],
            "statement": hyp_by_id.get(p["hypothesis_id"], {}).get("statement", ""),
            "risk_type": cls_by_id.get(p["hypothesis_id"], {}).get("risk_type"),
            "importance": p.get("importance"),
            "evidence": p.get("evidence"),
        }
        for p in riskiest
    ]

    feedback = ""
    if state.get("critic_review", {}).get("issues"):
        feedback = (
            "\n\nEl critico encontro estos problemas en la iteracion previa; corrigelos:\n"
            + jdump(state["critic_review"]["issues"])
        )

    model = get_structured_model(ExperimentRecList, tier="medium")
    msgs = [
        SystemMessage(content=EXPERIMENT_DESIGN_SYSTEM),
        HumanMessage(content=(
            "Hipotesis riesgosas a probar (prioriza estas):\n"
            f"{jdump(enriched)}\n\n"
            "Propuesta de valor (para contextualizar el diseno):\n"
            f"{jdump(state.get('value_proposition', {}))}\n\n"
            "Restricciones del equipo:\n"
            f"{jdump(state.get('constraints', {}))}\n\n"
            "CATALOGO PERMITIDO (solo puedes usar estos experiment_id):\n"
            f"{jdump(pool)}"
            f"{feedback}"
        )),
    ]
    result: ExperimentRecList = model.invoke(msgs)

    valid = []
    for r in result.recommendations:
        if r.experiment_id in allowed_ids:
            cat = service.get_experiment(r.experiment_id)
            if cat:
                r.experiment_name = cat.name
                r.cost = cat.cost
            valid.append(r.model_dump(mode="json"))

    return {
        "recommendations": valid,
        "messages": [trace("experiment_design", f"Disenados {len(valid)} experimentos (catalogo + diseno concreto).", version=EXPERIMENT_DESIGN_PROMPT_VERSION)],
    }

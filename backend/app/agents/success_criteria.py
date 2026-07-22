"""Success Criteria Agent: define criterios de exito y umbrales de validacion.

Ademas ENSAMBLA las Test Cards (hipotesis + experimento + metrica + criterio) de forma
determinista, uniendo las salidas del Metrics Agent y de este agente, para la UI y el export.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import SUCCESS_CRITERIA_PROMPT_VERSION, SUCCESS_CRITERIA_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.measurement import SuccessCriterionList
from app.schemas.state import BlueprintState

_DURATION = {"discovery": "1-2 semanas", "validation": "3-6 semanas"}


def _key(d: dict) -> tuple:
    return (d.get("hypothesis_id"), d.get("experiment_id"))


def _assemble_test_cards(state: BlueprintState, criteria: list[dict], metrics: list[dict]) -> list[dict]:
    hyp_by_id = {h["id"]: h for h in state.get("hypotheses", [])}
    metric_by_key = {_key(m): m for m in metrics}
    crit_by_key = {_key(c): c for c in criteria}

    cards = []
    for r in state.get("recommendations", []):
        k = _key(r)
        m = metric_by_key.get(k, {})
        c = crit_by_key.get(k, {})
        cards.append({
            "hypothesis_id": r.get("hypothesis_id"),
            "experiment_id": r.get("experiment_id"),
            "hypothesis_statement": hyp_by_id.get(r.get("hypothesis_id"), {}).get("statement", ""),
            "test_description": r.get("design_detail") or r.get("rationale", ""),
            "metric": m.get("metric", ""),
            "success_criteria": (c.get("criterion", "") + (f" (umbral: {c['threshold']})" if c.get("threshold") else "")).strip(),
            "expected_evidence_strength": c.get("expected_evidence_strength", r.get("expected_evidence_strength", 3)),
            "cost": r.get("cost", 3),
            "duration_estimate": _DURATION.get(r.get("stage", "discovery"), "1-3 semanas"),
        })
    return cards


def success_criteria_node(state: BlueprintState) -> dict:
    model = get_structured_model(SuccessCriterionList, tier="medium")
    context = {
        "hypotheses": state.get("hypotheses", []),
        "recommendations": state.get("recommendations", []),
        "metric_specs": state.get("metric_specs", []),
    }
    msgs = [
        SystemMessage(content=SUCCESS_CRITERIA_SYSTEM),
        HumanMessage(content=f"Define el criterio de exito y umbral por experimento:\n\n{jdump(context)}"),
    ]
    result: SuccessCriterionList = model.invoke(msgs)
    criteria = [c.model_dump(mode="json") for c in result.success_criteria]
    cards = _assemble_test_cards(state, criteria, state.get("metric_specs", []))

    return {
        "success_criteria": criteria,
        "test_cards": cards,
        "messages": [trace("success_criteria", f"Definidos {len(criteria)} criterios de exito; {len(cards)} Test Cards ensambladas.", version=SUCCESS_CRITERIA_PROMPT_VERSION)],
    }

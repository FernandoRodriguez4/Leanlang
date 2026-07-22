"""Risk Agent: clasifica por tipo + nivel de riesgo Y prioriza (mapa 2x2).

En la arquitectura de enjambre, el Risk Agent absorbe la clasificacion D/F/V y la
priorizacion por nivel de riesgo en un solo agente.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import PRIORITIZE_PROMPT_VERSION, PRIORITIZE_SYSTEM, RISK_PROMPT_VERSION, RISK_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.hypothesis import ClassificationList, PrioritizationList
from app.schemas.state import BlueprintState


def risk_node(state: BlueprintState) -> dict:
    hyps = state.get("hypotheses", [])

    # 1) Clasificacion por tipo + nivel de riesgo.
    cls_model = get_structured_model(ClassificationList, tier="medium")
    cls_result: ClassificationList = cls_model.invoke([
        SystemMessage(content=RISK_SYSTEM),
        HumanMessage(content=f"Clasifica estas hipotesis por tipo y nivel de riesgo:\n\n{jdump(hyps)}"),
    ])
    classifications = [c.model_dump(mode="json") for c in cls_result.classifications]

    # 2) Priorizacion en el mapa 2x2 (importancia x evidencia).
    prio_model = get_structured_model(PrioritizationList, tier="medium")
    prio_result: PrioritizationList = prio_model.invoke([
        SystemMessage(content=PRIORITIZE_SYSTEM),
        HumanMessage(content=f"Prioriza en el mapa 2x2:\n\n{jdump({'hypotheses': hyps, 'classifications': classifications})}"),
    ])
    prioritization = [p.model_dump(mode="json") for p in prio_result.prioritization]
    riskiest = sum(1 for p in prioritization if p.get("is_riskiest"))

    return {
        "classifications": classifications,
        "prioritization": prioritization,
        "messages": [trace("risk", f"Clasificadas {len(classifications)} hipotesis; {riskiest} de riesgo alto (probar primero).", version=f"{RISK_PROMPT_VERSION}+{PRIORITIZE_PROMPT_VERSION}")],
    }

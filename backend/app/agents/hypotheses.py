"""Agente 2: Generador de Hipotesis (con contra-hipotesis anti-sesgo)."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, research_context, trace
from app.agents.prompts import HYPOTHESES_PROMPT_VERSION, HYPOTHESES_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.hypothesis import HypothesisList
from app.schemas.state import BlueprintState


def hypotheses_node(state: BlueprintState) -> dict:
    model = get_structured_model(HypothesisList, tier="high")
    context = {
        "problem": state.get("problem", {}),
        "customer_segment": state.get("customer_segment", {}),
        "value_proposition": state.get("value_proposition", {}),
        "business_model": state.get("business_model", {}),
        "raw_idea": state["raw_idea"],
    }
    evidence = research_context(state)
    prefix = f"Evidencia externa disponible:\n{evidence}\n\n" if evidence else ""
    msgs = [
        SystemMessage(content=HYPOTHESES_SYSTEM),
        HumanMessage(content=f"{prefix}Genera las hipotesis a partir de este lienzo de negocio:\n\n{jdump(context)}"),
    ]
    result: HypothesisList = model.invoke(msgs)
    hyps = [h.model_dump(mode="json") for h in result.hypotheses]
    return {
        "hypotheses": hyps,
        "messages": [trace("hypotheses", f"Generadas {len(hyps)} hipotesis comprobables.", version=HYPOTHESES_PROMPT_VERSION)],
    }

"""Value Proposition Agent: construye la propuesta de valor."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, research_context, trace
from app.agents.prompts import VALUEPROP_PROMPT_VERSION, VALUEPROP_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.lean import ValueProposition
from app.schemas.state import BlueprintState


def value_proposition_node(state: BlueprintState) -> dict:
    model = get_structured_model(ValueProposition)
    context = {
        "raw_idea": state["raw_idea"],
        "problem": state.get("problem", {}),
        "customer_segment": state.get("customer_segment", {}),
    }
    evidence = research_context(state)
    prefix = f"Evidencia externa disponible:\n{evidence}\n\n" if evidence else ""
    msgs = [
        SystemMessage(content=VALUEPROP_SYSTEM),
        HumanMessage(content=f"{prefix}Construye la propuesta de valor para:\n\n{jdump(context)}"),
    ]
    vp: ValueProposition = model.invoke(msgs)
    return {
        "value_proposition": vp.model_dump(mode="json"),
        "messages": [trace("value_proposition", f"Propuesta de valor: {vp.statement}", version=VALUEPROP_PROMPT_VERSION)],
    }

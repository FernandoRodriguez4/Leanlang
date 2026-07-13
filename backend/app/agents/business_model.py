"""Business Model Agent: estructura los bloques del BMC (más allá del VPC)."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, research_context, trace
from app.agents.prompts import BUSINESS_MODEL_PROMPT_VERSION, BUSINESS_MODEL_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.lean import BusinessModel
from app.schemas.state import BlueprintState


def business_model_node(state: BlueprintState) -> dict:
    model = get_structured_model(BusinessModel)
    context = {
        "raw_idea": state["raw_idea"],
        "customer_segment": state.get("customer_segment", {}),
        "value_proposition": state.get("value_proposition", {}),
    }
    evidence = research_context(state)
    prefix = f"Evidencia externa disponible:\n{evidence}\n\n" if evidence else ""
    msgs = [
        SystemMessage(content=BUSINESS_MODEL_SYSTEM),
        HumanMessage(content=f"{prefix}Estructura el modelo de negocio (bloques BMC) para:\n\n{jdump(context)}"),
    ]
    bm: BusinessModel = model.invoke(msgs)
    return {
        "business_model": bm.model_dump(mode="json"),
        "messages": [trace("business_model", "Modelo de negocio (BMC) estructurado.", version=BUSINESS_MODEL_PROMPT_VERSION)],
    }

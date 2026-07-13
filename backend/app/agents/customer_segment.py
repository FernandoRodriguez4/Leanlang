"""Customer Segment Agent: define el segmento objetivo."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, research_context, trace
from app.agents.prompts import SEGMENT_PROMPT_VERSION, SEGMENT_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.lean import CustomerSegment
from app.schemas.state import BlueprintState


def customer_segment_node(state: BlueprintState) -> dict:
    model = get_structured_model(CustomerSegment)
    context = {"raw_idea": state["raw_idea"], "problem": state.get("problem", {})}
    evidence = research_context(state)
    prefix = f"Evidencia externa disponible:\n{evidence}\n\n" if evidence else ""
    msgs = [
        SystemMessage(content=SEGMENT_SYSTEM),
        HumanMessage(content=f"{prefix}Define el segmento objetivo para:\n\n{jdump(context)}"),
    ]
    seg: CustomerSegment = model.invoke(msgs)
    return {
        "customer_segment": seg.model_dump(mode="json"),
        "messages": [trace("customer_segment", f"Segmento objetivo: {seg.name}", version=SEGMENT_PROMPT_VERSION)],
    }

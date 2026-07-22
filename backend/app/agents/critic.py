"""Agente 7: Coach / Critico (QA) -> audita el diseno contra las trampas del libro."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import CRITIC_PROMPT_VERSION, CRITIC_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.state import BlueprintState
from app.schemas.testcard import CriticReview


def critic_node(state: BlueprintState) -> dict:
    model = get_structured_model(CriticReview, tier="high")
    blueprint = {
        "hypotheses": state.get("hypotheses", []),
        "classifications": state.get("classifications", []),
        "prioritization": state.get("prioritization", []),
        "recommendations": state.get("recommendations", []),
        "metric_specs": state.get("metric_specs", []),
        "success_criteria": state.get("success_criteria", []),
        "decisions": state.get("decisions", []),
        "validation_roadmap": state.get("validation_roadmap", {}),
        "plan_estimate": state.get("plan_estimate", {}),
        "test_cards": state.get("test_cards", []),
        "constraints": state.get("constraints", {}),
    }
    msgs = [
        SystemMessage(content=CRITIC_SYSTEM),
        HumanMessage(content=f"Audita este diseno experimental completo:\n\n{jdump(blueprint)}"),
    ]
    review: CriticReview = model.invoke(msgs)
    revision_count = state.get("revision_count", 0)
    status = "OK" if review.passed else f"requiere mejoras ({len(review.issues)} issues)"
    return {
        "critic_review": review.model_dump(mode="json"),
        "revision_count": revision_count,
        "messages": [trace("critic", f"Calidad {review.quality_score:.2f} -> {status}.", version=CRITIC_PROMPT_VERSION)],
    }

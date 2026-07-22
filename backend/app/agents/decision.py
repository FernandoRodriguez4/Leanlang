"""Decision Agent: regla de decisión pre-comprometida (Learning Card) por experimento."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import DECISION_PROMPT_VERSION, DECISION_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.decision import DecisionRuleList
from app.schemas.state import BlueprintState


def decision_node(state: BlueprintState) -> dict:
    model = get_structured_model(DecisionRuleList, tier="medium")
    context = {
        "hypotheses": state.get("hypotheses", []),
        "recommendations": state.get("recommendations", []),
        "success_criteria": state.get("success_criteria", []),
    }
    msgs = [
        SystemMessage(content=DECISION_SYSTEM),
        HumanMessage(content=f"Define la regla de decisión (Learning Card) por experimento:\n\n{jdump(context)}"),
    ]
    result: DecisionRuleList = model.invoke(msgs)
    decisions = [d.model_dump(mode="json") for d in result.decisions]
    return {
        "decisions": decisions,
        "messages": [trace("decision", f"Definidas {len(decisions)} reglas de decisión (persevere/pivot/kill).", version=DECISION_PROMPT_VERSION)],
    }

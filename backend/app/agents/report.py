"""Report Agent: genera el informe consolidado del blueprint de validacion."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import REPORT_PROMPT_VERSION, REPORT_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.report import Report
from app.schemas.state import BlueprintState


def report_node(state: BlueprintState) -> dict:
    model = get_structured_model(Report, tier="high")
    blueprint = {
        "problem": state.get("problem", {}),
        "customer_segment": state.get("customer_segment", {}),
        "value_proposition": state.get("value_proposition", {}),
        "business_model": state.get("business_model", {}),
        "hypotheses": state.get("hypotheses", []),
        "classifications": state.get("classifications", []),
        "prioritization": state.get("prioritization", []),
        "recommendations": state.get("recommendations", []),
        "success_criteria": state.get("success_criteria", []),
        "decisions": state.get("decisions", []),
        "validation_roadmap": state.get("validation_roadmap", {}),
        "critic_review": state.get("critic_review", {}),
    }
    msgs = [
        SystemMessage(content=REPORT_SYSTEM),
        HumanMessage(content=f"Genera el informe consolidado a partir de estos artefactos:\n\n{jdump(blueprint)}"),
    ]
    report: Report = model.invoke(msgs)
    return {
        "report": report.model_dump(mode="json"),
        "messages": [trace("report", "Informe consolidado generado.", version=REPORT_PROMPT_VERSION)],
    }

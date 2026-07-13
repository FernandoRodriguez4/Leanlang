"""Problem Agent: identifica y estructura el problema del cliente."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import research_context, trace
from app.agents.prompts import PROBLEM_PROMPT_VERSION, PROBLEM_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.lean import Problem
from app.schemas.state import BlueprintState


def problem_node(state: BlueprintState) -> dict:
    model = get_structured_model(Problem)
    evidence = research_context(state)
    prefix = f"Evidencia externa disponible:\n{evidence}\n\n" if evidence else ""
    msgs = [
        SystemMessage(content=PROBLEM_SYSTEM),
        HumanMessage(content=f"{prefix}Idea de negocio:\n\n{state['raw_idea']}"),
    ]
    problem: Problem = model.invoke(msgs)
    return {
        "problem": problem.model_dump(mode="json"),
        "messages": [trace("problem", f"Problema estructurado: {problem.statement}", version=PROBLEM_PROMPT_VERSION)],
    }

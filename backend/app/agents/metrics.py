"""Metrics Agent: define metricas accionables por experimento."""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import METRICS_PROMPT_VERSION, METRICS_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.measurement import MetricSpecList
from app.schemas.state import BlueprintState


def metrics_node(state: BlueprintState) -> dict:
    model = get_structured_model(MetricSpecList, tier="medium")
    context = {
        "hypotheses": state.get("hypotheses", []),
        "recommendations": state.get("recommendations", []),
    }
    msgs = [
        SystemMessage(content=METRICS_SYSTEM),
        HumanMessage(content=f"Define una metrica accionable por experimento recomendado:\n\n{jdump(context)}"),
    ]
    result: MetricSpecList = model.invoke(msgs)
    metrics = [m.model_dump(mode="json") for m in result.metrics]
    return {
        "metric_specs": metrics,
        "messages": [trace("metrics", f"Definidas {len(metrics)} metricas accionables.", version=METRICS_PROMPT_VERSION)],
    }

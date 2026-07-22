"""Sequencing Agent: roadmap de validación (fases/ondas) a partir de los experimentos.

Post-valida que las fases solo referencien experiment_id realmente diseñados (anclaje).
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import jdump, trace
from app.agents.prompts import ROADMAP_PROMPT_VERSION, ROADMAP_SYSTEM
from app.core.llm import get_structured_model
from app.schemas.roadmap import ValidationRoadmap
from app.schemas.state import BlueprintState


def sequencing_node(state: BlueprintState) -> dict:
    recs = state.get("recommendations", [])
    valid_ids = {r.get("experiment_id") for r in recs}

    model = get_structured_model(ValidationRoadmap, tier="medium")
    context = {
        "recommendations": [
            {k: r.get(k) for k in ("hypothesis_id", "experiment_id", "experiment_name", "stage", "sequence_order", "cost")}
            for r in recs
        ],
        "constraints": state.get("constraints", {}),
    }
    msgs = [
        SystemMessage(content=ROADMAP_SYSTEM),
        HumanMessage(content=f"Construye el roadmap de validación por fases:\n\n{jdump(context)}"),
    ]
    roadmap: ValidationRoadmap = model.invoke(msgs)

    # Anclaje: descartar ids inventados en las fases.
    data = roadmap.model_dump(mode="json")
    for ph in data.get("phases", []):
        ph["experiment_ids"] = [eid for eid in ph.get("experiment_ids", []) if eid in valid_ids]

    n_phases = len(data.get("phases", []))
    return {
        "validation_roadmap": data,
        "messages": [trace("sequencing", f"Roadmap de validación en {n_phases} fases.", version=ROADMAP_PROMPT_VERSION)],
    }

"""Estado compartido del grafo LangGraph (BlueprintState)."""
from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langgraph.graph.message import add_messages


class BlueprintState(TypedDict, total=False):
    """Estado que fluye entre los nodos/agentes del grafo.

    Los campos son dicts/lists serializables (no modelos Pydantic) para que el
    checkpointer de Postgres los persista sin friccion. Cada agente valida con su
    schema Pydantic al entrar y serializa con .model_dump() al salir.
    """

    # Identidad / entrada
    project_id: str
    user_id: str
    raw_idea: str
    constraints: dict[str, Any]

    # Artefactos producidos por los agentes Lean del enjambre (serializados)
    problem: dict[str, Any]  # Problem Agent
    customer_segment: dict[str, Any]  # Customer Segment Agent
    value_proposition: dict[str, Any]  # Value Proposition Agent
    business_model: dict[str, Any]  # Business Model Agent (bloques BMC)
    hypotheses: list[dict[str, Any]]  # Hypothesis Agent
    classifications: list[dict[str, Any]]  # Risk Agent (tipo + nivel)
    prioritization: list[dict[str, Any]]  # Risk Agent (mapa 2x2)
    recommendations: list[dict[str, Any]]  # Experiment Design Agent (catalogo + diseno)
    metric_specs: list[dict[str, Any]]  # Metrics Agent
    success_criteria: list[dict[str, Any]]  # Success Criteria Agent
    decisions: list[dict[str, Any]]  # Decision Agent (Learning Cards / reglas)
    validation_roadmap: dict[str, Any]  # Sequencing Agent (plan por fases)
    plan_estimate: dict[str, Any]  # Plan Estimation Agent (costo/tiempo/capacidades)
    test_cards: list[dict[str, Any]]  # ensamblado (metrica + criterio) para UI/export
    critic_review: dict[str, Any]  # Coach / Critico
    report: dict[str, Any]  # Report Agent (informe consolidado)

    # Control de orquestacion / triaje
    next: str  # decision del supervisor: a que nodo ir
    revision_count: int  # cuantas veces el critico devolvio al Experiment Design
    human_feedback: dict[str, Any]  # ediciones del usuario tras un interrupt

    # Agente Investigador (Tavily) — ver docs/plan-agente-investigador-tavily.md
    research: dict[str, Any]  # ResearchReport serializado (artefacto, se persiste en el checkpointer)
    # Control efimero: {execute, queries} escrito por el Supervisor y leido por
    # route_entry y el nodo research. Aunque queda declarado en BlueprintState (el
    # checkpointer no distingue campos efimeros de artefactos), conceptualmente
    # solo tiene sentido durante el tramo Supervisor -> research de la primera
    # construccion del Blueprint; no se lee ni se usa en ningun otro punto del flujo.
    research_plan: dict[str, Any]
    include_research: bool  # flag opcional por request (BlueprintRunRequest.include_research)

    # Traza para streaming/observabilidad
    messages: Annotated[list, add_messages]

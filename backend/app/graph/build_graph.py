r"""Construccion del grafo del enjambre multiagente (LangGraph StateGraph).

Arquitectura: Supervisor (orquestador, dueno del proceso) + Triaje (route_entry decide
que agente cubre la tarea) + 14 Lean Agents, con bucle del Critico e interrupts human-in-the-loop.

    START -> supervisor -(triaje)-> research | problem | hypotheses | risk
    research -> problem
    problem -> customer_segment -> value_proposition -> business_model -> hypotheses
    hypotheses -> [interrupt] human_hypotheses -> risk            (Risk Agent: tipo+nivel+2x2)
    risk -> [interrupt] human_prioritization -> experiment_design
    experiment_design -> metrics -> success_criteria -> decision -> sequencing -> plan_estimate -> critic
    critic -(route)-> bump_revision -> experiment_design          (si no pasa, hasta MAX_REVISIONS)
                    \-> report -> [interrupt] human_approval -> END
"""
from __future__ import annotations

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph

from app.agents.business_model import business_model_node
from app.agents.critic import critic_node
from app.agents.customer_segment import customer_segment_node
from app.agents.decision import decision_node
from app.agents.experiment_design import experiment_design_node
from app.agents.hypotheses import hypotheses_node
from app.agents.metrics import metrics_node
from app.agents.plan_estimate import plan_estimate_node
from app.agents.problem import problem_node
from app.agents.report import report_node
from app.agents.research import research_node
from app.agents.risk import risk_node
from app.agents.sequencing import sequencing_node
from app.agents.success_criteria import success_criteria_node
from app.agents.supervisor import (
    bump_revision_node,
    human_approval_node,
    human_hypotheses_node,
    human_prioritization_node,
    route_after_critic,
    route_entry,
    supervisor_node,
)
from app.agents.value_proposition import value_proposition_node
from app.schemas.state import BlueprintState


def make_graph_builder() -> StateGraph:
    """Construye la topologia del enjambre SIN compilar.

    Se usa tanto para compilar con nuestro checkpointer (produccion) como para
    LangGraph Studio (`langgraph dev`), que aporta su propia persistencia.
    """
    g = StateGraph(BlueprintState)

    # Orquestador + triaje
    g.add_node("supervisor", supervisor_node)
    g.add_node("research", research_node)
    # Lean Agents (enjambre)
    g.add_node("problem", problem_node)
    g.add_node("customer_segment", customer_segment_node)
    g.add_node("value_proposition", value_proposition_node)
    g.add_node("business_model", business_model_node)
    g.add_node("hypotheses", hypotheses_node)
    g.add_node("human_hypotheses", human_hypotheses_node)
    g.add_node("risk", risk_node)
    g.add_node("human_prioritization", human_prioritization_node)
    g.add_node("experiment_design", experiment_design_node)
    g.add_node("metrics", metrics_node)
    g.add_node("success_criteria", success_criteria_node)
    g.add_node("decision", decision_node)
    g.add_node("sequencing", sequencing_node)
    g.add_node("plan_estimate", plan_estimate_node)
    g.add_node("critic", critic_node)
    g.add_node("bump_revision", bump_revision_node)
    g.add_node("report", report_node)
    g.add_node("human_approval", human_approval_node)

    g.add_edge(START, "supervisor")
    g.add_conditional_edges(
        "supervisor",
        route_entry,
        {"research": "research", "problem": "problem", "hypotheses": "hypotheses", "risk": "risk"},
    )
    g.add_edge("research", "problem")

    # Lado del cliente (VPC distribuido) + modelo de negocio (BMC)
    g.add_edge("problem", "customer_segment")
    g.add_edge("customer_segment", "value_proposition")
    g.add_edge("value_proposition", "business_model")
    g.add_edge("business_model", "hypotheses")

    # Hipotesis -> riesgo -> diseno de experimentos
    g.add_edge("hypotheses", "human_hypotheses")
    g.add_edge("human_hypotheses", "risk")
    g.add_edge("risk", "human_prioritization")
    g.add_edge("human_prioritization", "experiment_design")

    # Medicion -> decision (Learning Card) -> roadmap -> critico
    g.add_edge("experiment_design", "metrics")
    g.add_edge("metrics", "success_criteria")
    g.add_edge("success_criteria", "decision")
    g.add_edge("decision", "sequencing")
    g.add_edge("sequencing", "plan_estimate")
    g.add_edge("plan_estimate", "critic")

    # Bucle del critico / informe final
    g.add_conditional_edges(
        "critic",
        route_after_critic,
        {"revise": "bump_revision", "approve": "report"},
    )
    g.add_edge("bump_revision", "experiment_design")
    g.add_edge("report", "human_approval")
    g.add_edge("human_approval", END)

    return g


def build_blueprint_graph(checkpointer: BaseCheckpointSaver):
    """Compila el grafo con nuestro checkpointer (uso en la app/FastAPI)."""
    return make_graph_builder().compile(checkpointer=checkpointer)

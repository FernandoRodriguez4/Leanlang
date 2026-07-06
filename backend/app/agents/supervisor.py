"""Supervisor / Triaje + nodos human-in-the-loop.

El supervisor decide, por triaje, en que punto del pipeline entrar (p. ej. saltar
Intake si la idea ya viene con canvas) y, tras el Critico, si se debe re-trabajar
(volver al Selector) o finalizar. Es determinista para garantizar reproducibilidad.
"""
from __future__ import annotations

from langgraph.types import interrupt

from app.agents.base import prune_messages, trace
from app.core.config import settings
from app.schemas.state import BlueprintState


# ---- Triaje de entrada -------------------------------------------------------
def supervisor_node(state: BlueprintState) -> dict:
    """Nodo de entrada: registra el inicio. La decision de ruta la toma route_entry."""
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    return {"messages": [trace("supervisor", "Triaje: orquestando el diseno de validacion."), *pruned]}


def route_entry(state: BlueprintState) -> str:
    """Triaje: el agente de triaje decide que agente cubre la tarea segun el estado.

    Permite re-entrar saltando etapas ya cubiertas (p. ej. si ya hay propuesta de valor
    o hipotesis), manteniendo reproducibilidad en el backbone Lean.
    """
    if not state.get("problem"):
        return "problem"
    if not state.get("hypotheses"):
        return "hypotheses"
    return "risk"


# ---- Decision tras el Critico ------------------------------------------------
def route_after_critic(state: BlueprintState) -> str:
    review = state.get("critic_review", {}) or {}
    revisions = state.get("revision_count", 0)
    if not review.get("passed", True) and revisions < settings.max_revisions:
        return "revise"  # vuelve al selector con el feedback del critico
    return "approve"  # pasa a la aprobacion humana / fin


def bump_revision_node(state: BlueprintState) -> dict:
    """Incrementa el contador antes de re-ejecutar el Experiment Design (evita loops infinitos)."""
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    return {
        "revision_count": state.get("revision_count", 0) + 1,
        "messages": [trace("supervisor", "Re-disenando experimentos segun feedback del critico."), *pruned],
    }


# ---- Nodos Human-in-the-loop (interrupts) -----------------------------------
def human_hypotheses_node(state: BlueprintState) -> dict:
    """Pausa para que el usuario confirme/edite las hipotesis."""
    edited = interrupt({"type": "review_hypotheses", "hypotheses": state.get("hypotheses", [])})
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    if isinstance(edited, dict) and edited.get("hypotheses"):
        return {
            "hypotheses": edited["hypotheses"],
            "messages": [trace("human", "Hipotesis editadas por el usuario."), *pruned],
        }
    return {"messages": [trace("human", "Hipotesis aceptadas por el usuario."), *pruned]}


def human_prioritization_node(state: BlueprintState) -> dict:
    """Pausa para que el usuario ajuste el mapa 2x2 (importancia/evidencia)."""
    edited = interrupt({"type": "review_prioritization", "prioritization": state.get("prioritization", [])})
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    if isinstance(edited, dict) and edited.get("prioritization"):
        return {
            "prioritization": edited["prioritization"],
            "messages": [trace("human", "Priorizacion ajustada por el usuario."), *pruned],
        }
    return {"messages": [trace("human", "Priorizacion aceptada por el usuario."), *pruned]}


def human_approval_node(state: BlueprintState) -> dict:
    """Pausa final para aprobar el blueprint."""
    decision = interrupt({"type": "approve_blueprint", "critic_review": state.get("critic_review", {})})
    msg = "Blueprint aprobado." if (decision or {}).get("approved", True) else "Blueprint marcado para revision."
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    return {"messages": [trace("human", msg), *pruned]}

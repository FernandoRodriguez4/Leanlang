"""Supervisor / Triaje + nodos human-in-the-loop.

El supervisor decide, por triaje, en que punto del pipeline entrar (p. ej. saltar
Intake si la idea ya viene con canvas) y, tras el Critico, si se debe re-trabajar
(volver al Selector) o finalizar. Es determinista para garantizar reproducibilidad.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import interrupt

from app.agents.base import prune_messages, trace
from app.agents.prompts import RESEARCH_PLAN_PROMPT_VERSION, RESEARCH_PLAN_SYSTEM
from app.core.config import settings
from app.core.llm import get_structured_model
from app.schemas.research import ResearchPlan
from app.schemas.state import BlueprintState


# ---- Triaje de entrada -------------------------------------------------------
def _should_plan_research(state: BlueprintState) -> bool:
    """Gate determinista: solo en la primera construccion del Blueprint, si esta
    habilitado por config y por el request (ver docs/plan-agente-investigador-tavily.md,
    seccion "Agente y lógica del Supervisor").
    """
    if state.get("problem") or state.get("research"):
        return False
    if not settings.research_enabled:
        return False
    if not state.get("include_research", True):
        return False
    return True


def supervisor_node(state: BlueprintState) -> dict:
    """Nodo de entrada: registra el inicio y, en la primera entrada elegible, corre
    el gate de investigacion (una llamada LLM que decide `execute` y genera las
    queries). La decision de ruta la toma route_entry.
    """
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    messages = [trace("supervisor", "Triaje: orquestando el diseno de validacion."), *pruned]

    if not _should_plan_research(state):
        return {"messages": messages}

    model = get_structured_model(ResearchPlan)
    plan_msgs = [
        SystemMessage(content=RESEARCH_PLAN_SYSTEM),
        HumanMessage(content=f"Idea de negocio:\n\n{state['raw_idea']}"),
    ]
    plan: ResearchPlan = model.invoke(plan_msgs)
    research_plan = plan.model_dump()
    research_plan["queries"] = research_plan["queries"][: settings.research_max_queries]

    messages.append(
        trace(
            "supervisor",
            f"Research plan: execute={research_plan['execute']}, queries={len(research_plan['queries'])}.",
            version=RESEARCH_PLAN_PROMPT_VERSION,
        )
    )
    return {"messages": messages, "research_plan": research_plan}


def route_entry(state: BlueprintState) -> str:
    """Triaje: el agente de triaje decide que agente cubre la tarea segun el estado.

    Permite re-entrar saltando etapas ya cubiertas (p. ej. si ya hay propuesta de valor
    o hipotesis), manteniendo reproducibilidad en el backbone Lean.
    """
    if not state.get("problem"):
        research_plan = state.get("research_plan") or {}
        if research_plan.get("execute") and not state.get("research"):
            return "research"
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
    """Pausa para que el usuario confirme/edite las hipotesis.

    La edicion es un reemplazo completo del array (`edited["hypotheses"]`), sin asumir
    que conserva el tamano original: el mismo mecanismo cubre editar texto, modificar
    hipotesis existentes y eliminar una o varias, por eso se chequea presencia de la
    clave (`in`) y no su truthiness (un `[]` explicito tambien cuenta como edicion).

    La validacion de forma/duplicados/minimo-uno vive en el endpoint HTTP
    (`resume_blueprint`, antes de construir el `Command(resume=...)`), no aca: si un
    node de LangGraph raisea *despues* de que `interrupt()` ya devolvio un valor, ese
    valor queda fijado para siempre en el checkpoint -- cualquier resume posterior,
    incluso uno valido, vuelve a repetir el mismo intento fallido (verificado
    empiricamente con MemorySaver). Por eso este nodo confia en que el payload que
    recibe ya fue validado antes de llegar aca.
    """
    edited = interrupt({"type": "review_hypotheses", "hypotheses": state.get("hypotheses", [])})
    pruned = prune_messages(state.get("messages", []), window=settings.messages_window)
    if isinstance(edited, dict) and "hypotheses" in edited:
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

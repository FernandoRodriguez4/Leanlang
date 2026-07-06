"""Endpoints del Blueprint: run (SSE), resume (human-in-the-loop), get, export."""
from __future__ import annotations

import json
import warnings

from fastapi import APIRouter, Depends, HTTPException
from langgraph.types import Command
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session

from app.api.streaming import event_stream, serialize_blueprint
from app.auth.security import get_current_user
from app.core.config import settings
from app.core.observability import build_run_config
from app.db.models import Blueprint, Project, User
from app.db.session import SessionLocal, get_db
from app.graph.runtime import get_graph
from app.schemas.api import BlueprintRunRequest, ResumeRequest

router = APIRouter(tags=["blueprint"])


def _own_project(db: Session, project_id: str, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project


def _own_blueprint(db: Session, blueprint_id: str, user: User) -> Blueprint:
    bp = db.get(Blueprint, blueprint_id)
    if not bp:
        raise HTTPException(status_code=404, detail="Blueprint no encontrado")
    project = db.get(Project, bp.project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Blueprint no encontrado")
    return bp


def _project_from_checkpoint(thread_id: str) -> tuple[dict, bool]:
    """Deriva la proyeccion de lectura (blueprint + awaiting) desde el checkpointer.

    El checkpointer es la unica fuente de verdad del estado vivo de ejecucion
    (ver docs/audits/backend_architecture_evolution_validation.md, Punto 2);
    `blueprints.state` es una proyeccion NO autoritativa derivada de aqui.
    Es idempotente por construccion: dado el mismo checkpoint, siempre produce
    el mismo resultado (sobreescritura completa, sin merge incremental), asi
    que recomputarla y volver a persistirla es seguro de repetir.
    """
    graph = get_graph()
    snapshot = graph.get_state({"configurable": {"thread_id": thread_id}})
    values = snapshot.values or {}
    blueprint = serialize_blueprint(values)
    awaiting = bool(snapshot.next)  # hay nodos pendientes -> interrupt
    return blueprint, awaiting


def shadow_read_check(blueprint_id: str) -> dict:
    """Validacion temporal (Fase 2): compara `blueprints.state` (la proyeccion
    persistida que devuelve `GET /blueprint/{id}`) contra lo que el
    checkpointer reporta ahora mismo para el mismo `thread_id`.

    Solo lectura, nunca escribe. Pensada para usarse mientras se decide
    confiar definitivamente en la proyeccion para servir lecturas (ver
    scripts/shadow_read_check.py); no es una verificacion permanente en el
    camino caliente de cada request.
    """
    with SessionLocal() as db:
        bp = db.get(Blueprint, blueprint_id)
        if bp is None:
            return {"blueprint_id": blueprint_id, "found": False}
        projected_state = bp.state or {}
        projected_status = bp.status
        thread_id = bp.thread_id

    checkpoint_state, awaiting = _project_from_checkpoint(thread_id)
    checkpoint_status = "awaiting_input" if awaiting else "done"

    state_match = projected_state == checkpoint_state
    # "running" es un estado transitorio legitimo de la proyeccion mientras el
    # grafo sigue avanzando entre dos checkpoints; solo importa que, cuando la
    # proyeccion ya se declara terminada/esperando, coincida con el checkpoint.
    status_match = projected_status == "running" or projected_status == checkpoint_status
    diff_keys = sorted(set(projected_state) ^ set(checkpoint_state))

    return {
        "blueprint_id": blueprint_id,
        "found": True,
        "match": state_match and status_match,
        "state_match": state_match,
        "status_match": status_match,
        "projected_status": projected_status,
        "checkpoint_status": checkpoint_status,
        "diff_keys": diff_keys,
    }


def _persist_final(thread_id: str, blueprint_id: str) -> dict:
    """Deriva la proyeccion final desde el checkpointer y la persiste en
    `blueprints.state`; devuelve el evento 'done'/'awaiting_input'.

    Escritura idempotente respecto al checkpoint (ver `_project_from_checkpoint`):
    si falla, la proyeccion queda desactualizada pero recuperable -- no hay
    perdida de datos de dominio porque el checkpointer sigue teniendo el
    estado autoritativo y esta misma funcion puede volver a ejecutarse.
    """
    blueprint, awaiting = _project_from_checkpoint(thread_id)
    status = "awaiting_input" if awaiting else "done"

    try:
        with SessionLocal() as db:
            bp = db.get(Blueprint, blueprint_id)
            if bp:
                bp.state = blueprint
                bp.status = status
                db.commit()
    except Exception as exc:  # pragma: no cover
        warnings.warn(
            f"[blueprint] no se pudo persistir la proyeccion derivada de '{blueprint_id}' "
            f"({exc}); el checkpointer sigue teniendo el estado autoritativo, la "
            "proyeccion queda desactualizada hasta la proxima escritura exitosa.",
            RuntimeWarning,
            stacklevel=2,
        )
    else:
        if settings.shadow_read_enabled:
            report = shadow_read_check(blueprint_id)
            if not report.get("match", True):
                warnings.warn(
                    f"[shadow-read] divergencia proyeccion/checkpoint en blueprint "
                    f"'{blueprint_id}': {report}",
                    RuntimeWarning,
                    stacklevel=2,
                )

    return {"event": status, "data": json.dumps(blueprint, ensure_ascii=False)}


async def _sse(graph, payload, config: dict, blueprint_id: str, emit_started: bool = False):
    if emit_started:
        yield {"event": "started", "data": json.dumps({"blueprint_id": str(blueprint_id)})}
    async for ev in event_stream(graph, payload, config):
        yield ev
    yield _persist_final(config["configurable"]["thread_id"], blueprint_id)


@router.post("/projects/{project_id}/blueprint/run")
async def run_blueprint(
    project_id: str,
    body: BlueprintRunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _own_project(db, project_id, user)
    constraints = (body.constraints.model_dump(mode="json") if body.constraints else project.constraints)

    bp = Blueprint(project_id=project.id, thread_id="", status="running", state={})
    db.add(bp)
    db.commit()
    db.refresh(bp)
    bp.thread_id = f"bp-{bp.id}"
    db.commit()

    initial_state = {
        "project_id": project.id,
        "user_id": user.id,
        "raw_idea": project.raw_idea,
        "constraints": constraints,
        "revision_count": 0,
        "messages": [],
    }
    graph = get_graph()
    config = build_run_config(
        bp.thread_id, user_id=user.id, project_id=project.id, blueprint_id=bp.id, phase="full_run"
    )
    return EventSourceResponse(_sse(graph, initial_state, config, bp.id, emit_started=True))


@router.post("/blueprint/{blueprint_id}/resume")
async def resume_blueprint(
    blueprint_id: str,
    body: ResumeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bp = _own_blueprint(db, blueprint_id, user)
    bp.status = "running"
    db.commit()
    graph = get_graph()
    # LangGraph ignora un resume "vacio" (falsy) y re-interrumpe: garantizamos no-vacio.
    resume_value = body.payload or {"accepted": True}
    command = Command(resume=resume_value)
    config = build_run_config(
        bp.thread_id, user_id=user.id, project_id=bp.project_id, blueprint_id=bp.id,
        phase=f"resume:{body.stage}",
    )
    return EventSourceResponse(_sse(graph, command, config, bp.id))


@router.get("/blueprint/{blueprint_id}")
def get_blueprint(
    blueprint_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    bp = _own_blueprint(db, blueprint_id, user)
    return {"id": bp.id, "project_id": bp.project_id, "status": bp.status, "blueprint": bp.state}


@router.get("/projects/{project_id}/blueprints")
def list_blueprints(
    project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    _own_project(db, project_id, user)
    rows = (
        db.query(Blueprint)
        .filter(Blueprint.project_id == project_id)
        .order_by(Blueprint.created_at.desc())
        .all()
    )
    return [{"id": b.id, "status": b.status, "created_at": b.created_at} for b in rows]

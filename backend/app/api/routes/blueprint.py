"""Endpoints del Blueprint: run (SSE), resume (human-in-the-loop), get, export."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from langgraph.types import Command
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session

from app.api.streaming import event_stream, serialize_blueprint
from app.auth.security import get_current_user
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


def _persist_final(thread_id: str, blueprint_id: str) -> dict:
    """Lee el estado final del grafo y lo persiste; devuelve el evento 'done'/'awaiting'."""
    graph = get_graph()
    snapshot = graph.get_state({"configurable": {"thread_id": thread_id}})
    values = snapshot.values or {}
    blueprint = serialize_blueprint(values)
    awaiting = bool(snapshot.next)  # hay nodos pendientes -> interrupt

    with SessionLocal() as db:
        bp = db.get(Blueprint, blueprint_id)
        if bp:
            bp.state = blueprint
            bp.status = "awaiting_input" if awaiting else "done"
            db.commit()

    event = "awaiting_input" if awaiting else "done"
    return {"event": event, "data": json.dumps(blueprint, ensure_ascii=False)}


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

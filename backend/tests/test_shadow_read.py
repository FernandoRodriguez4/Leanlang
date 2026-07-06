"""Tests de la proyeccion derivada `blueprints.state` y su validacion shadow-read
(Fase 2): consistencia checkpointer <-> proyeccion, sin tocar el endpoint HTTP."""
from __future__ import annotations

import uuid

import pytest
from langgraph.checkpoint.memory import MemorySaver

import app.api.routes.blueprint as blueprint_routes
from app.db.models import Blueprint, Project, User
from app.db.session import SessionLocal
from app.graph.build_graph import build_blueprint_graph


def _initial_state():
    return {
        "project_id": "p1",
        "user_id": "u1",
        "raw_idea": "Kits de ciencia por suscripcion mensual para padres millennials.",
        "constraints": {"budget_level": "low", "time_horizon": "weeks", "stage": "discovery"},
        "revision_count": 0,
        "messages": [],
    }


def _make_project() -> Project:
    with SessionLocal() as db:
        user = User(email=f"shadow-{uuid.uuid4().hex[:8]}@test.com", hashed_password="x")
        db.add(user)
        db.commit()
        db.refresh(user)
        project = Project(user_id=user.id, name="p", raw_idea="idea", constraints={})
        db.add(project)
        db.commit()
        db.refresh(project)
        return project


def _make_blueprint(project_id, thread_id: str) -> str:
    with SessionLocal() as db:
        bp = Blueprint(project_id=project_id, thread_id=thread_id, status="running", state={})
        db.add(bp)
        db.commit()
        db.refresh(bp)
        return str(bp.id)


def test_persist_final_projection_matches_checkpoint(fake_llm, monkeypatch):
    graph = build_blueprint_graph(MemorySaver())
    monkeypatch.setattr(blueprint_routes, "get_graph", lambda: graph)

    project = _make_project()
    thread_id = "t-shadow-match"
    blueprint_id = _make_blueprint(project.id, thread_id)

    graph.invoke(_initial_state(), config={"configurable": {"thread_id": thread_id}})
    blueprint_routes._persist_final(thread_id, blueprint_id)

    report = blueprint_routes.shadow_read_check(blueprint_id)
    assert report["found"] is True
    assert report["match"] is True
    assert report["state_match"] is True
    assert report["projected_status"] == "awaiting_input"
    assert report["checkpoint_status"] == "awaiting_input"
    assert report["diff_keys"] == []


def test_persist_final_is_idempotent(fake_llm, monkeypatch):
    """Volver a llamar _persist_final con el mismo checkpoint no cambia el resultado."""
    graph = build_blueprint_graph(MemorySaver())
    monkeypatch.setattr(blueprint_routes, "get_graph", lambda: graph)

    project = _make_project()
    thread_id = "t-shadow-idempotent"
    blueprint_id = _make_blueprint(project.id, thread_id)

    graph.invoke(_initial_state(), config={"configurable": {"thread_id": thread_id}})
    first = blueprint_routes._persist_final(thread_id, blueprint_id)
    second = blueprint_routes._persist_final(thread_id, blueprint_id)

    assert first == second
    report = blueprint_routes.shadow_read_check(blueprint_id)
    assert report["match"] is True


def test_shadow_read_check_detects_divergence(fake_llm, monkeypatch):
    graph = build_blueprint_graph(MemorySaver())
    monkeypatch.setattr(blueprint_routes, "get_graph", lambda: graph)

    project = _make_project()
    thread_id = "t-shadow-divergence"
    blueprint_id = _make_blueprint(project.id, thread_id)

    graph.invoke(_initial_state(), config={"configurable": {"thread_id": thread_id}})
    blueprint_routes._persist_final(thread_id, blueprint_id)

    # Simula una proyeccion desactualizada/corrupta (p. ej. una escritura fallida
    # previa) sin tocar el checkpointer, que sigue siendo la fuente de verdad.
    with SessionLocal() as db:
        bp = db.get(Blueprint, blueprint_id)
        bp.state = {"hypotheses": []}
        db.commit()

    report = blueprint_routes.shadow_read_check(blueprint_id)
    assert report["match"] is False
    assert report["state_match"] is False


def test_shadow_read_check_missing_blueprint():
    report = blueprint_routes.shadow_read_check(str(uuid.uuid4()))
    assert report["found"] is False


def test_persist_final_warns_on_shadow_read_mismatch(fake_llm, monkeypatch):
    """Con `shadow_read_enabled=True`, una divergencia detectada justo despues
    de persistir emite un RuntimeWarning visible (nunca rompe el flujo)."""
    graph = build_blueprint_graph(MemorySaver())
    monkeypatch.setattr(blueprint_routes, "get_graph", lambda: graph)
    monkeypatch.setattr(blueprint_routes.settings, "shadow_read_enabled", True)

    project = _make_project()
    thread_id = "t-shadow-warn"
    blueprint_id = _make_blueprint(project.id, thread_id)

    graph.invoke(_initial_state(), config={"configurable": {"thread_id": thread_id}})

    # Forzamos la divergencia: el shadow-read corre DESPUES del commit dentro de
    # _persist_final, asi que parcheamos shadow_read_check para simular que
    # devuelve match=False sin depender de una condicion de carrera real.
    monkeypatch.setattr(
        blueprint_routes, "shadow_read_check", lambda _bp_id: {"match": False, "diff_keys": ["x"]}
    )

    with pytest.warns(RuntimeWarning, match="shadow-read"):
        blueprint_routes._persist_final(thread_id, blueprint_id)

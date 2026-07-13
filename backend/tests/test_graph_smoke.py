"""Smoke test del grafo completo con LLM falso: valida orquestacion + interrupts + loop."""
from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

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


def test_full_flow_with_three_interrupts(fake_llm):
    graph = build_blueprint_graph(MemorySaver())
    config = {"configurable": {"thread_id": "t-smoke"}}

    # 1) Corre hasta el primer interrupt (revisar hipotesis)
    graph.invoke(_initial_state(), config=config)
    snap = graph.get_state(config)
    assert snap.next, "deberia pausar en human_hypotheses"
    assert "human_hypotheses" in snap.next
    assert len(snap.values["hypotheses"]) == 3

    # 2) Reanuda aceptando hipotesis -> pausa en priorizacion
    graph.invoke(Command(resume={"accepted": True}), config=config)
    snap = graph.get_state(config)
    assert "human_prioritization" in snap.next
    riskiest = [p for p in snap.values["prioritization"] if p["is_riskiest"]]
    assert len(riskiest) == 2

    # 3) Reanuda aceptando priorizacion -> selector/metrics/critic -> pausa en aprobacion
    graph.invoke(Command(resume={"accepted": True}), config=config)
    snap = graph.get_state(config)
    assert "human_approval" in snap.next

    # El selector debe haber descartado el id inventado ('inventado-xyz')
    recs = snap.values["recommendations"]
    assert recs, "deberia haber recomendaciones"
    assert all(r["experiment_id"] in {"link-tracking", "customer-interview"} for r in recs)
    assert all(r["experiment_id"] != "inventado-xyz" for r in recs)

    # Test cards y revision del critico presentes
    assert snap.values["test_cards"]
    assert snap.values["critic_review"]["passed"] is True

    # 4) Reanuda aprobando -> termina
    graph.invoke(Command(resume={"approved": True}), config=config)
    snap = graph.get_state(config)
    assert not snap.next, "el grafo deberia haber terminado"


def test_human_edits_override_hypotheses(fake_llm):
    graph = build_blueprint_graph(MemorySaver())
    config = {"configurable": {"thread_id": "t-edit"}}
    graph.invoke(_initial_state(), config=config)

    edited = [{"id": "h1", "statement": "Hipotesis editada por el usuario", "source_block": "value_propositions", "is_counter_hypothesis": False}]
    graph.invoke(Command(resume={"hypotheses": edited}), config=config)
    snap = graph.get_state(config)
    assert snap.values["hypotheses"][0]["statement"] == "Hipotesis editada por el usuario"


def test_human_deletes_hypotheses(fake_llm):
    """El array editado puede tener menos elementos: eliminar es solo un reemplazo
    completo de `state["hypotheses"]` con una lista mas corta (ver
    docs/audit_elimin_hipotesis.md)."""
    graph = build_blueprint_graph(MemorySaver())
    config = {"configurable": {"thread_id": "t-delete"}}
    graph.invoke(_initial_state(), config=config)
    snap = graph.get_state(config)
    assert len(snap.values["hypotheses"]) == 3

    remaining = [h for h in snap.values["hypotheses"] if h["id"] != "h2"]
    graph.invoke(Command(resume={"hypotheses": remaining}), config=config)
    snap = graph.get_state(config)
    assert len(snap.values["hypotheses"]) == 2
    assert {h["id"] for h in snap.values["hypotheses"]} == {"h1", "h3"}

    # Los nodos posteriores (Risk) solo ven las hipotesis restantes.
    assert "human_prioritization" in snap.next
    class_ids = {c["hypothesis_id"] for c in snap.values["classifications"]}
    assert class_ids <= {"h1", "h3"}


def test_human_delete_last_hypothesis_leaves_two(fake_llm):
    """Caso limite permitido: 2 -> 1 (siempre que quede al menos una)."""
    graph = build_blueprint_graph(MemorySaver())
    config = {"configurable": {"thread_id": "t-delete-to-one"}}
    graph.invoke(_initial_state(), config=config)

    remaining = [{"id": "h1", "statement": "H1", "source_block": "value_propositions", "is_counter_hypothesis": False}]
    graph.invoke(Command(resume={"hypotheses": remaining}), config=config)
    snap = graph.get_state(config)
    assert len(snap.values["hypotheses"]) == 1
    assert snap.values["hypotheses"][0]["id"] == "h1"


def test_human_confirms_hypotheses_without_editing(fake_llm):
    """Resume sin la clave 'hypotheses' (ej. {'accepted': True}) mantiene el state
    tal cual: el nodo confia en la forma del payload, la validacion vive en el
    endpoint HTTP (ver tests/test_resume_validation.py y app/api/routes/blueprint.py)."""
    graph = build_blueprint_graph(MemorySaver())
    config = {"configurable": {"thread_id": "t-accept"}}
    graph.invoke(_initial_state(), config=config)
    before = graph.get_state(config)

    graph.invoke(Command(resume={"accepted": True}), config=config)
    snap = graph.get_state(config)
    assert snap.values["hypotheses"] == before.values["hypotheses"]

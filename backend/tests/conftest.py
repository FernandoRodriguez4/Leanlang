"""Fixtures de test: modelo LLM falso (deterministico) para probar el grafo sin API."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

os.environ.setdefault("JWT_SECRET", "test")

# BD de test: PostgreSQL aislado (Fase 6 -- SQLite ya no es un backend valido, los
# modelos usan UUID/JSONB nativos que SQLite no puede compilar). Se deriva del
# DATABASE_URL real del `.env` (mismo host/usuario/password que ya usa el dev)
# cambiando solo el nombre de la base, para no depender de credenciales hardcodeadas
# ni colisionar con la BD de desarrollo (`blueprint`).
if "DATABASE_URL" not in os.environ:
    _dotenv_path = Path(__file__).resolve().parent.parent / ".env"
    _dev_url = dotenv_values(_dotenv_path).get("DATABASE_URL") or (
        "postgresql+psycopg://postgres:postgres@localhost:5432/blueprint"
    )
    _test_url = make_url(_dev_url).set(database="blueprint_test")
    os.environ["DATABASE_URL"] = _test_url.render_as_string(hide_password=False)

from app.schemas.experiment import ExperimentRec, ExperimentRecList  # noqa: E402
from app.schemas.hypothesis import (  # noqa: E402
    Classification,
    ClassificationList,
    Hypothesis,
    HypothesisList,
    Prioritization,
    PrioritizationList,
)
from app.schemas.decision import DecisionRule, DecisionRuleList  # noqa: E402
from app.schemas.lean import BusinessModel, CustomerSegment, Problem, ValueProposition  # noqa: E402
from app.schemas.measurement import (  # noqa: E402
    MetricSpec,
    MetricSpecList,
    SuccessCriterion,
    SuccessCriterionList,
)
from app.schemas.report import Report  # noqa: E402
from app.schemas.research import ResearchPlan  # noqa: E402
from app.schemas.roadmap import RoadmapPhase, ValidationRoadmap  # noqa: E402
from app.schemas.testcard import CriticReview  # noqa: E402


def _canned(schema):
    """Instancia canned valida para cada schema que usan los agentes del enjambre."""
    if schema is Problem:
        return Problem(
            statement="Los padres millennials no encuentran kits de ciencia listos y asequibles.",
            context="Padres con poco tiempo para preparar proyectos escolares.",
            context_summary="Padres ocupados sin tiempo para preparar proyectos escolares.",
            customer_jobs=["preparar proyecto de ciencias"],
            pains=["sin tiempo", "materiales dispersos"],
        )
    if schema is CustomerSegment:
        return CustomerSegment(
            name="Padres millennials",
            description="Padres 28-42 con hijos en primaria.",
            description_summary="Padres de 28 a 42 años con hijos en primaria.",
            characteristics=["ocupados", "digitales"],
            gains=["nota alta", "tiempo en familia"],
            early_adopters="Padres que ya compran material educativo online",
            early_adopters_summary="Padres que ya compran material educativo online.",
        )
    if schema is ValueProposition:
        return ValueProposition(
            statement="Kits de ciencia mensuales listos para usar, entregados a domicilio.",
            products_services=["kit mensual"],
            pain_relievers=["todo incluido"],
            gain_creators=["proyectos exitosos"],
            differentiator="Curados por docentes",
            differentiator_summary="Curados por docentes.",
        )
    if schema is BusinessModel:
        return BusinessModel(
            channels=["web", "redes sociales"],
            customer_relationships=["suscripción autoservicio"],
            revenue_streams=["suscripción mensual"],
            key_resources=["proveedores de material"],
            key_activities=["curaduría", "logística"],
            key_partners=["escuelas"],
            cost_structure=["materiales", "envío"],
        )
    if schema is HypothesisList:
        return HypothesisList(hypotheses=[
            Hypothesis(id="h1", statement="Creemos que los padres pagaran 15 USD/mes.", source_block="value_propositions"),
            Hypothesis(id="h2", statement="Creemos que podemos enviar el kit por menos de 5 USD.", source_block="key_activities"),
            Hypothesis(id="h3", statement="Creemos que los padres NO se suscribiran.", source_block="customer_segments", is_counter_hypothesis=True),
        ])
    if schema is ClassificationList:
        return ClassificationList(classifications=[
            Classification(hypothesis_id="h1", risk_type="desirability", risk_level="high", bmc_block="value_propositions", rationale="quieren la oferta?"),
            Classification(hypothesis_id="h2", risk_type="feasibility", risk_level="medium", bmc_block="key_activities", rationale="podemos entregar?"),
            Classification(hypothesis_id="h3", risk_type="desirability", risk_level="high", bmc_block="customer_segments", rationale="contra-hipotesis"),
        ])
    if schema is PrioritizationList:
        return PrioritizationList(prioritization=[
            Prioritization(hypothesis_id="h1", importance=0.95, evidence=0.1, quadrant="test_now", is_riskiest=True, rationale="critica y sin evidencia"),
            Prioritization(hypothesis_id="h2", importance=0.6, evidence=0.5, quadrant="keep_evidence", is_riskiest=False, rationale="moderada"),
            Prioritization(hypothesis_id="h3", importance=0.9, evidence=0.1, quadrant="test_now", is_riskiest=True, rationale="contra-hipotesis riesgosa"),
        ])
    if schema is ExperimentRecList:
        # ids reales del catalogo (desirability, costo bajo) + uno inventado que debe descartarse
        return ExperimentRecList(recommendations=[
            ExperimentRec(hypothesis_id="h1", experiment_id="link-tracking", experiment_name="Seguimiento de enlaces", sequence_order=1, stage="discovery", rationale="barato y rapido", design_detail="Landing con boton 'Me interesa - 15 USD/mes'.", expected_evidence_strength=3, cost=1),
            ExperimentRec(hypothesis_id="h1", experiment_id="customer-interview", experiment_name="Entrevista al cliente", sequence_order=2, stage="discovery", rationale="contexto cualitativo", design_detail="5 preguntas abiertas sobre el proceso actual.", expected_evidence_strength=1, cost=2),
            ExperimentRec(hypothesis_id="h1", experiment_id="inventado-xyz", experiment_name="Falso", sequence_order=3, stage="discovery", rationale="deberia descartarse", expected_evidence_strength=5, cost=1),
        ])
    if schema is MetricSpecList:
        return MetricSpecList(metrics=[
            MetricSpec(hypothesis_id="h1", experiment_id="link-tracking", metric="CTR del boton de interes", data_source="analytics", rationale="senal de intencion"),
            MetricSpec(hypothesis_id="h1", experiment_id="customer-interview", metric="N de padres que confirman el dolor", data_source="entrevistas", rationale="valida el problema"),
        ])
    if schema is SuccessCriterionList:
        return SuccessCriterionList(success_criteria=[
            SuccessCriterion(hypothesis_id="h1", experiment_id="link-tracking", criterion="Acertamos si hay interes real", threshold=">= 5% de CTR", expected_evidence_strength=3),
            SuccessCriterion(hypothesis_id="h1", experiment_id="customer-interview", criterion="Acertamos si confirman el dolor", threshold=">= 7 de 10 entrevistados", expected_evidence_strength=2),
        ])
    if schema is DecisionRuleList:
        return DecisionRuleList(decisions=[
            DecisionRule(hypothesis_id="h1", experiment_id="link-tracking", if_validated="Avanzar a preventa", if_invalidated="Ajustar el precio", recommended_decision="persevere"),
            DecisionRule(hypothesis_id="h1", experiment_id="customer-interview", if_validated="Confirmar el dolor", if_invalidated="Revisar el segmento", recommended_decision="pivot"),
        ])
    if schema is ValidationRoadmap:
        return ValidationRoadmap(phases=[
            RoadmapPhase(name="Onda 1 — Descubrimiento", stage="discovery", goal="Señal de interés", experiment_ids=["link-tracking", "customer-interview"], duration_estimate="1-2 semanas"),
        ], rationale="Barato y rápido primero, triangulando h1.")
    if schema is CriticReview:
        return CriticReview(quality_score=0.82, passed=True, issues=[], summary="Diseno solido.")
    if schema is ResearchPlan:
        # execute=False: el gate del Supervisor no dispara el nodo `research` en los
        # tests del grafo (ese nodo aun no esta registrado en build_graph.py -- Fase 6).
        return ResearchPlan(execute=False, queries=[])
    if schema is Report:
        return Report(
            executive_summary="Plan enfocado en validar disposicion a pagar y factibilidad de envio.",
            problem_summary="Padres sin tiempo para kits de ciencia.",
            value_proposition_summary="Kits mensuales listos a domicilio.",
            riskiest_hypotheses=["Pagaran 15 USD/mes"],
            recommended_sequence=["Seguimiento de enlaces", "Entrevista al cliente"],
            success_definition="CTR >= 5% y 7/10 entrevistados confirman el dolor.",
            next_steps=["Lanzar landing", "Agendar entrevistas"],
        )
    raise AssertionError(f"schema no soportado en el fake: {schema}")


class _FakeStructured:
    def __init__(self, schema):
        self.schema = schema

    def invoke(self, _msgs):
        return _canned(self.schema)


@pytest.fixture
def fake_llm(monkeypatch):
    """Parchea get_structured_model en todos los modulos de agentes del enjambre."""
    import app.agents.business_model as business_model
    import app.agents.critic as critic
    import app.agents.customer_segment as customer_segment
    import app.agents.decision as decision
    import app.agents.experiment_design as experiment_design
    import app.agents.hypotheses as hypotheses
    import app.agents.metrics as metrics
    import app.agents.problem as problem
    import app.agents.report as report
    import app.agents.risk as risk
    import app.agents.sequencing as sequencing
    import app.agents.success_criteria as success_criteria
    import app.agents.supervisor as supervisor
    import app.agents.value_proposition as value_proposition

    def fake_get_structured_model(schema, temperature=None):
        return _FakeStructured(schema)

    for mod in (problem, customer_segment, value_proposition, business_model, hypotheses, risk,
                experiment_design, metrics, success_criteria, decision, sequencing, critic, report,
                supervisor):
        monkeypatch.setattr(mod, "get_structured_model", fake_get_structured_model)
    return fake_get_structured_model


@pytest.fixture(scope="session", autouse=True)
def _reset_test_schema():
    """Reconstruye el esquema de `blueprint_test` via Alembic -- el mismo
    mecanismo que usa produccion (`alembic upgrade head`), sin `create_all()`.

    El esquema se vacia por completo (incluida `alembic_version`) antes de
    migrar: un `DROP SCHEMA`/`CREATE SCHEMA` deja a Alembic sin ningun estado
    de version previo, para que `upgrade("head")` siempre corra la migracion
    completa desde cero en cada sesion de tests (evita, ademas, que filas de
    una corrida anterior, ej. `dup@b.com`, rompan asserts en la siguiente).
    """
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from app.db.session import engine

    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    alembic_cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

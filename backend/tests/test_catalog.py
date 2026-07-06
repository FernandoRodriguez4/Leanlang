"""Tests del catalogo de experimentos (sin LLM)."""
from __future__ import annotations

import inspect

import pytest

from app.catalog import service


def test_catalog_has_44():
    catalog = service.load_catalog()
    assert len(catalog) == 44
    ids = [e.id for e in catalog]
    assert len(set(ids)) == 44  # ids unicos


def test_split_discovery_validation():
    catalog = service.load_catalog()
    discovery = [e for e in catalog if e.category.value == "discovery"]
    validation = [e for e in catalog if e.category.value == "validation"]
    assert len(discovery) == 29
    assert len(validation) == 15


def test_query_respects_constraints():
    cheap = service.query_experiments(risk_type="desirability", max_cost=2, max_setup_time=2)
    assert cheap, "deberia haber experimentos baratos de deseabilidad"
    for e in cheap:
        assert e.cost <= 2
        assert e.setup_time <= 2
        assert "desirability" in [t.value for t in e.types]


def test_query_sorted_by_evidence_then_cost():
    res = service.query_experiments(risk_type="desirability", limit=20)
    # ordenado por evidencia desc, luego costo asc
    for a, b in zip(res, res[1:]):
        assert (a.evidence_strength, -a.cost) >= (b.evidence_strength, -b.cost)


def test_pairings_exist_in_catalog():
    catalog = service.load_catalog()
    ids = {e.id for e in catalog}
    for e in catalog:
        for ref in e.pairings_before + e.pairings_after:
            assert ref in ids, f"pairing inexistente: {ref} en {e.id}"


def test_knowledge_service_is_a_protocol_not_a_stub():
    """Fase 3: `KnowledgeService` es unicamente un contrato de tipado (Protocol),
    sin cuerpo ejecutable ni instanciacion posible."""
    assert getattr(service.KnowledgeService, "_is_protocol", False) is True

    with pytest.raises(TypeError):
        service.KnowledgeService()  # los Protocol no son instanciables


def test_knowledge_service_semantic_search_has_no_executable_body():
    source = inspect.getsource(service.KnowledgeService.semantic_search)
    body = source.split(":", 1)[1].strip()
    assert body in ("...", "...\n")


def test_query_experiments_signature_matches_protocol():
    protocol_params = inspect.signature(service.KnowledgeService.query_experiments).parameters
    real_params = inspect.signature(service.query_experiments).parameters
    # el Protocol declara `self` de mas; el resto de la firma debe coincidir
    assert list(protocol_params)[1:] == list(real_params)

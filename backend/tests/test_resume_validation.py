"""Valida la regla de negocio 'al menos una hipotesis' y el resto de las
validaciones de `_validate_hypotheses_edit` en el borde HTTP (POST /resume),
antes de que el payload llegue a construir el Command(resume=...) que reanuda
el grafo. Se testea la funcion pura (sin DB/TestClient) porque no depende de
la sesion ni del checkpointer -- ver docstring de `_validate_hypotheses_edit`
en app/api/routes/blueprint.py para el porque de validar aca y no en el nodo.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.routes.blueprint import _validate_hypotheses_edit


def _hyp(id_, statement="s", source_block="value_propositions", counter=False):
    return {"id": id_, "statement": statement, "source_block": source_block, "is_counter_hypothesis": counter}


def test_accepts_shorter_list():
    result = _validate_hypotheses_edit([_hyp("h1"), _hyp("h3")])
    assert [h["id"] for h in result] == ["h1", "h3"]


def test_accepts_single_hypothesis():
    result = _validate_hypotheses_edit([_hyp("h1")])
    assert len(result) == 1


def test_rejects_empty_list():
    with pytest.raises(HTTPException) as exc:
        _validate_hypotheses_edit([])
    assert exc.value.status_code == 422
    assert "al menos una hipotesis" in exc.value.detail


def test_rejects_duplicate_ids():
    with pytest.raises(HTTPException) as exc:
        _validate_hypotheses_edit([_hyp("h1"), _hyp("h1")])
    assert exc.value.status_code == 422
    assert "duplicados" in exc.value.detail


def test_rejects_malformed_items():
    with pytest.raises(HTTPException) as exc:
        _validate_hypotheses_edit([{"id": "h1"}])  # falta 'statement'/'source_block'
    assert exc.value.status_code == 422


def test_rejects_non_list():
    with pytest.raises(HTTPException):
        _validate_hypotheses_edit("h1")

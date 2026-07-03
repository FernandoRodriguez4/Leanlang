"""Tests de la API (auth, proyectos, catalogo) con TestClient + PostgreSQL (ver conftest.py)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_experiments_catalog(client):
    r = client.get("/experiments")
    assert r.status_code == 200
    assert len(r.json()) == 44


def test_auth_and_project_flow(client):
    # registro
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "password123"})
    assert r.status_code == 201, r.text

    # login (form-data)
    r = client.post("/auth/login", data={"username": "a@b.com", "password": "password123"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # crear proyecto
    r = client.post(
        "/projects",
        headers=headers,
        json={
            "name": "Kits de ciencia",
            "raw_idea": "Kits de ciencia por suscripcion mensual para padres millennials.",
            "constraints": {"budget_level": "low", "time_horizon": "weeks", "stage": "discovery"},
        },
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    # listar
    r = client.get("/projects", headers=headers)
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    # acceso sin token -> 401
    assert client.get("/projects").status_code == 401


def test_register_rejects_duplicate(client):
    client.post("/auth/register", json={"email": "dup@b.com", "password": "password123"})
    r = client.post("/auth/register", json={"email": "dup@b.com", "password": "password123"})
    assert r.status_code == 400

"""Schemas de entrada/salida de la API (auth, proyectos, blueprint)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.blueprint import Constraints


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- Projects ----
class ProjectCreate(BaseModel):
    name: str
    raw_idea: str = Field(min_length=20, description="Descripcion de la idea de negocio")
    constraints: Constraints = Field(default_factory=Constraints)


class ProjectOut(BaseModel):
    id: UUID
    name: str
    raw_idea: str
    constraints: dict
    created_at: datetime


# ---- Blueprint run / resume ----
class BlueprintRunRequest(BaseModel):
    """Opcional: override de constraints al lanzar la corrida."""

    constraints: Constraints | None = None


class ResumeRequest(BaseModel):
    """Reanudacion tras un interrupt (human-in-the-loop).

    `stage` indica que interrupt se esta respondiendo: 'hypotheses' | 'prioritization' | 'approval'.
    `payload` lleva la edicion del usuario (lista de hipotesis editadas, ajustes del 2x2, etc.).
    """

    stage: str
    payload: dict = Field(default_factory=dict)

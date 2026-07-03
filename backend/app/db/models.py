"""Modelos ORM: User, Project, Blueprint, Experiment (catalogo)."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projects: Mapped[list["Project"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_idea: Mapped[str] = mapped_column(Text, nullable=False)
    constraints: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="projects")
    blueprints: Mapped[list["Blueprint"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Blueprint(Base):
    __tablename__ = "blueprints"
    __table_args__ = (
        CheckConstraint("status IN ('running', 'awaiting_input', 'done')", name="status_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    thread_id: Mapped[str] = mapped_column(String(64), index=True)  # enlaza con el checkpointer
    state: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(32))  # running|awaiting_input|done
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="blueprints")


class Experiment(Base):
    """Catalogo de los 44 experimentos del libro (fuente de verdad del Selector)."""

    __tablename__ = "experiments"
    __table_args__ = (
        CheckConstraint("cost BETWEEN 1 AND 5", name="cost_range"),
        CheckConstraint("setup_time BETWEEN 1 AND 5", name="setup_time_range"),
        CheckConstraint("run_time BETWEEN 1 AND 5", name="run_time_range"),
        CheckConstraint("evidence_strength BETWEEN 1 AND 5", name="evidence_strength_range"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # slug, ej. "customer-interview"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(32))  # discovery|validation
    subcategory: Mapped[str] = mapped_column(String(64))
    types: Mapped[list] = mapped_column(JSONB, default=list)  # ["desirability","feasibility",...]
    cost: Mapped[int] = mapped_column(Integer)  # 1..5
    setup_time: Mapped[int] = mapped_column(Integer)  # 1..5
    run_time: Mapped[int] = mapped_column(Integer)  # 1..5
    evidence_strength: Mapped[int] = mapped_column(Integer)  # 1..5
    capabilities: Mapped[list] = mapped_column(JSONB, default=list)
    description: Mapped[str] = mapped_column(Text)
    pairings_before: Mapped[list] = mapped_column(JSONB, default=list)
    pairings_after: Mapped[list] = mapped_column(JSONB, default=list)
    page_ref: Mapped[int | None] = mapped_column(Integer, nullable=True)

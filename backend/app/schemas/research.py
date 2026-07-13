"""Contratos de datos del Agente Investigador (Tavily).

Ver docs/plan-agente-investigador-tavily.md - seccion "3. Schemas Pydantic".
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ResearchPlan(BaseModel):
    """Salida del gate LLM del Supervisor: decide ejecutar e informa las queries."""

    execute: bool = Field(description="Si corresponde ejecutar el Investigador")
    queries: list[str] = Field(default_factory=list, description="3-5 consultas complementarias")


class Source(BaseModel):
    """Fuente citada en el Research Report."""

    title: str = Field(description="Titulo de la fuente")
    url: str = Field(description="URL de la fuente")
    snippet: str = Field(default="", description="Fragmento relevante de la fuente")


class Competitor(BaseModel):
    """Competidor identificado durante la investigacion."""

    name: str = Field(description="Nombre del competidor")
    description: str = Field(default="", description="Descripcion breve del competidor")
    url: str | None = Field(default=None, description="URL del competidor, si esta disponible")


class ResearchReport(BaseModel):
    """Salida del Agente Investigador: evidencia externa estructurada."""

    status: str = Field(default="completed", description="completed | partial | failed | empty")
    confidence: str = Field(default="", description="Nivel de confianza: High/Medium/Low o numerico")
    generated_at: str = Field(default="", description="ISO timestamp de la investigacion")
    queries: list[str] = Field(default_factory=list, description="Queries efectivamente ejecutadas")
    market_summary: str = Field(default="", description="Resumen del mercado")
    competitors: list[Competitor] = Field(default_factory=list, description="Competidores identificados")
    trends: list[str] = Field(default_factory=list, description="Tendencias relevantes")
    benchmarks: list[str] = Field(default_factory=list, description="Benchmarks relevantes")
    regulations: list[str] = Field(default_factory=list, description="Regulaciones relevantes")
    studies: list[str] = Field(default_factory=list, description="Estudios relevantes")
    sources: list[Source] = Field(default_factory=list, description="Fuentes citadas")

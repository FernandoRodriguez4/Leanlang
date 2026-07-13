"""Artefactos de los agentes Lean del enjambre (Value Proposition Canvas distribuido).

- Problem Agent -> Problem (lado del problema: jobs + pains).
- Customer Segment Agent -> CustomerSegment (a quien servimos).
- Value Proposition Agent -> ValueProposition (mapa de valor: productos, alivios, creadores).
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class Problem(BaseModel):
    """Salida del Problem Agent: el problema del cliente, estructurado."""

    statement: str = Field(description="El problema central del cliente en una frase")
    context: str = Field(description="Situacion/contexto en que aparece el problema (version completa)")
    context_summary: str = Field(
        description=(
            "Resumen de `context`: maximo 2 frases y 40 palabras, conserva la idea principal, "
            "los datos y nombres relevantes, y suena natural (no es un recorte del texto)."
        )
    )
    root_causes: list[str] = Field(default_factory=list, description="Causas raiz probables")
    customer_jobs: list[str] = Field(default_factory=list, description="Jobs-to-be-done relacionados")
    pains: list[str] = Field(default_factory=list, description="Dolores principales que sufre el cliente")


class CustomerSegment(BaseModel):
    """Salida del Customer Segment Agent: a quien va dirigido."""

    name: str = Field(description="Nombre corto del segmento objetivo")
    description: str = Field(description="Descripcion del segmento (version completa)")
    description_summary: str = Field(
        description=(
            "Resumen de `description`: maximo 2 frases y 40 palabras, conserva la idea principal, "
            "los datos y nombres relevantes, y suena natural (no es un recorte del texto)."
        )
    )
    characteristics: list[str] = Field(default_factory=list, description="Rasgos demograficos/conductuales")
    gains: list[str] = Field(default_factory=list, description="Ganancias/resultados que desean")
    early_adopters: str = Field(default="", description="Quienes adoptarian primero (version completa)")
    early_adopters_summary: str = Field(
        default="",
        description=(
            "Resumen de `early_adopters`: maximo 2 frases y 40 palabras, conserva la idea principal, "
            "los datos y nombres relevantes, y suena natural (no es un recorte del texto)."
        ),
    )


class ValueProposition(BaseModel):
    """Salida del Value Proposition Agent: el mapa de valor."""

    statement: str = Field(description="Propuesta de valor en una frase")
    products_services: list[str] = Field(default_factory=list, description="Productos y servicios")
    pain_relievers: list[str] = Field(default_factory=list, description="Como aliviamos los dolores")
    gain_creators: list[str] = Field(default_factory=list, description="Como creamos las ganancias")
    differentiator: str = Field(default="", description="Que la hace distinta de las alternativas (version completa)")
    differentiator_summary: str = Field(
        default="",
        description=(
            "Resumen de `differentiator`: maximo 2 frases y 40 palabras, conserva la idea principal, "
            "los datos y nombres relevantes, y suena natural (no es un recorte del texto)."
        ),
    )


class BusinessModel(BaseModel):
    """Salida del Business Model Agent: los bloques del BMC que no cubre el VPC.

    (segmentos y propuesta de valor ya los producen los otros agentes.)
    """

    channels: list[str] = Field(default_factory=list, description="Como llegamos y entregamos al cliente")
    customer_relationships: list[str] = Field(default_factory=list, description="Tipo de relacion con el segmento")
    revenue_streams: list[str] = Field(default_factory=list, description="Como se generan ingresos")
    key_resources: list[str] = Field(default_factory=list, description="Recursos clave para entregar el valor")
    key_activities: list[str] = Field(default_factory=list, description="Actividades clave")
    key_partners: list[str] = Field(default_factory=list, description="Socios y proveedores clave")
    cost_structure: list[str] = Field(default_factory=list, description="Principales costos")

"""Fabrica de modelos LLM agnostica.

Usa `init_chat_model` de LangChain para que el motor de los agentes pueda
intercambiarse por configuracion (anthropic / openai / etc.) sin tocar el
codigo de los agentes. Esto facilita la comparacion de modelos en la tesis.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import RunnableLambda

from app.core.config import settings

Tier = Literal["high", "medium", "low"]

_TIER_SETTINGS = {
    "high": "llm_model_high",
    "medium": "llm_model_medium",
    "low": "llm_model_low",
}


def _resolve_model(tier: Tier | None) -> str:
    """Nombre del modelo para el tier pedido; cae en LLM_MODEL si el tier no
    tiene su propia variable configurada (o si no se pide tier)."""
    if tier is not None:
        override = getattr(settings, _TIER_SETTINGS[tier])
        if override:
            return override
    return settings.llm_model


@lru_cache
def get_model(temperature: float | None = None, tier: Tier | None = None) -> BaseChatModel:
    """Devuelve el chat model configurado por env (cacheado).

    Soporta endpoints compatibles con OpenAI (DeepSeek, Groq, Together, Ollama...)
    via LLM_BASE_URL y LLM_API_KEY. `tier` selecciona el nombre del modelo
    (LLM_MODEL_HIGH/MEDIUM/LOW) dentro del mismo provider/endpoint -- pensado
    para no pagar el modelo mas caro en agentes de tarea mecanica/acotada.
    """
    model_name = _resolve_model(tier)
    kwargs: dict = {}
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    if settings.llm_api_key:
        kwargs["api_key"] = settings.llm_api_key
    if settings.llm_base_url and "deepseek.com" in settings.llm_base_url:
        # Los modelos DeepSeek v4 (pro/flash) razonan ("thinking") por defecto y en
        # ese modo la API rechaza cualquier tool_choice forzado -- justo lo que usa
        # with_structured_output(method="function_calling") en get_structured_model.
        # Hay que desactivarlo explicitamente (mismo esquema que el thinking de Anthropic).
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
    return init_chat_model(
        model=model_name,
        model_provider=settings.llm_provider,
        temperature=settings.llm_temperature if temperature is None else temperature,
        **kwargs,
    )


def _raise_if_none(value):
    """DeepSeek a veces responde `finish_reason: tool_calls` con `tool_calls: []`
    (probable JSON de argumentos mal formado descartado al parsear): el parser de
    LangChain no lanza excepcion en ese caso, simplemente devuelve `None`. Sin este
    chequeo, `with_retry` nunca se activa (no hay excepcion que reintentar) y el
    `None` llega tal cual al agente, que revienta con `AttributeError` al acceder
    a un campo del schema esperado.
    """
    if value is None:
        raise ValueError(
            "El modelo no genero una salida estructurada valida (tool call vacio)."
        )
    return value


def get_structured_model(schema, temperature: float | None = None, tier: Tier | None = None):
    """Modelo con salida estructurada validada contra un schema Pydantic.

    Usa function-calling (tools), compatible con OpenAI/Anthropic/DeepSeek, en lugar
    de json_schema (que no todos los endpoints compatibles soportan).

    `tier` ("high" | "medium" | "low") selecciona el modelo via LLM_MODEL_HIGH/
    MEDIUM/LOW (ver get_model); sin tier, usa LLM_MODEL como siempre.

    `with_retry` reintenta cuando el modelo devuelve una salida vacia o mal formada
    (p. ej. DeepSeek a veces responde `{}`, o el tool call sale vacio -- ver
    `_raise_if_none`), evitando que una corrida entera falle por una respuesta
    puntualmente invalida.
    """
    structured = get_model(temperature=temperature, tier=tier).with_structured_output(
        schema, method="function_calling"
    )
    chain = structured | RunnableLambda(_raise_if_none)
    return chain.with_retry(stop_after_attempt=3)

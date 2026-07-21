"""Rate limiter (slowapi) para endpoints sensibles a fuerza bruta (auth).

Almacenamiento en memoria por proceso: correcto para una sola instancia (plan
free de Render, ver render.yaml). Si en el futuro se escala a 2+ instancias
horizontalmente, cada una llevaria su propio contador -- para un limite global
real haria falta un backend compartido (ej. Redis, via `storage_uri`).
"""
from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_real_client_ip(request: Request) -> str:
    """`request.client.host` es el hop TCP inmediato -- detras del proxy de
    Render/Cloudflare no es la IP real del cliente y varia entre requests
    (verificado: el limite nunca se acumulaba de forma confiable en prod).

    OJO: `X-Forwarded-For` NO es una alternativa segura -- es un header que
    el propio cliente puede mandar directamente (verificado con
    `curl -H "X-Forwarded-For: ..."`), y sin saber cuantos proxies confiables
    hay por delante no se puede distinguir el valor real del inventado por un
    atacante para saltarse el limite (hallazgo real de una revision de
    seguridad sobre un intento anterior de este fix).

    `CF-Connecting-IP` si es confiable: Render enruta todo el trafico via
    Cloudflare (confirmado por `Server: cloudflare` / `CF-RAY` en las
    respuestas), y Cloudflare fija este header el mismo en su borde a partir
    de la conexion TCP real, sobrescribiendo cualquier valor que mande el
    cliente -- no es spoofeable. Si no esta presente (dev local sin
    Cloudflare delante), se cae a `request.client.host` (el peer TCP directo,
    nunca un header manipulable) en vez de a X-Forwarded-For.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_real_client_ip)

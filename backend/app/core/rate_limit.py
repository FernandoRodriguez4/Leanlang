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
    La IP real del cliente es la primera de `X-Forwarded-For` (agregada por
    el primer proxy que la recibe); se cae a `get_remote_address` si el
    header no esta presente (dev local, sin proxy).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_real_client_ip)

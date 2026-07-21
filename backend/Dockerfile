FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

FROM base AS deps
COPY requirements.txt ./
# requirements.txt trae al final una linea `git+https://.../Leanlang.git#egg=...`
# (pip freeze de un `pip install -e .` local): requiere git y re-clonaria este
# mismo repo. Se filtra porque el paquete local se instala aparte mas abajo.
RUN grep -v '^git+' requirements.txt > requirements.docker.txt \
    && pip install --no-cache-dir -r requirements.docker.txt

FROM deps AS runtime
COPY pyproject.toml ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
RUN pip install --no-cache-dir --no-deps -e .

RUN useradd --create-home --uid 1000 appuser
USER appuser

EXPOSE 8000
# WEB_CONCURRENCY controla cuantos workers levanta uvicorn (procesos separados,
# cada uno con su propio ConnectionPool -- ver app/graph/runtime.py). Las
# migraciones corren aca (no via `preDeployCommand`: no esta disponible en el
# plan free de Render) -- `alembic upgrade head` es idempotente, no hace nada
# si ya esta al dia, asi que repetirlo en cada arranque/despertar es seguro.
# --forwarded-allow-ips '' : uvicorn por defecto confia en 127.0.0.1 para
# reescribir request.client segun X-Forwarded-For/Proto -- eso permitia que
# cualquiera conectando desde localhost (incluido un request local en dev)
# spoofeara el X-Forwarded-For y confundiera al rate limiter. Se desactiva
# esa confianza por completo: el unico header que se lee para identificar
# al cliente real es CF-Connecting-IP (ver app/core/rate_limit.py), fijado
# por Cloudflare en su borde y no spoofeable por el cliente.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --forwarded-allow-ips ''"]

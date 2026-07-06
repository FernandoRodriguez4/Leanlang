"""Entry point de FastAPI: lifespan (DB + seed + checkpointer), CORS y routers."""
from __future__ import annotations

from contextlib import ExitStack, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, blueprint, export, projects
from app.catalog.seed import seed_experiments
from app.core.config import settings
from app.core.observability import configure_langsmith
from app.db.session import SessionLocal
from app.graph.runtime import get_checkpointer_status, init_graph_memory, init_graph_persistent


@asynccontextmanager
async def lifespan(app: FastAPI):
    stack = ExitStack()
    # 0) Observabilidad (LangSmith) — activada/desactivada por env, sin tocar agentes.
    configure_langsmith()

    # 1) Esquema de BD: gestionado por Alembic (`alembic upgrade head`), paso
    #    de despliegue previo al arranque. El proceso ya no crea tablas.
    try:
        with SessionLocal() as db:
            n = seed_experiments(db)
            print(f"[startup] Catalogo sembrado (nuevos: {n}).")
    except Exception as exc:  # pragma: no cover
        msg = str(exc).encode("ascii", errors="replace").decode("ascii")
        print(f"[startup] BD no disponible ({msg}); el grafo usara memoria.")

    # 2) Grafo + checkpointer (Postgres persistente con fallback a memoria)
    try:
        init_graph_persistent(stack)
    except Exception:  # pragma: no cover
        init_graph_memory()

    try:
        yield
    finally:
        stack.close()


app = FastAPI(title="Validation Blueprint API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(blueprint.router)
app.include_router(export.router)


@app.get("/health", tags=["health"])
def health():
    checkpointer = get_checkpointer_status()
    status = "degraded" if checkpointer["degraded"] else "ok"
    return {
        "status": status,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "checkpointer": checkpointer,
    }

"""Runtime del grafo: gestiona el checkpointer y guarda el grafo compilado.

Prioridad de checkpointer (cadena por defecto, `init_graph_persistent`):
  1. Postgres (`PostgresSaver`, esquema `langgraph`) — checkpointer principal.
  2. Memoria (ultimo recurso; se pierde al reiniciar).

Sin SQLite (Fase 6): unica alternativa de persistencia real es Postgres.

El grafo compilado se guarda como singleton de modulo y se inicializa en el
lifespan de FastAPI (o de forma perezosa para tests).
"""
from __future__ import annotations

from contextlib import ExitStack

from app.core.config import settings
from app.graph.build_graph import build_blueprint_graph

_graph = None


def get_graph():
    """Devuelve el grafo compilado; lo inicializa en memoria si aun no existe."""
    global _graph
    if _graph is None:
        init_graph_memory()
    return _graph


def init_graph_memory():
    """Compila el grafo con un checkpointer en memoria (dev/tests)."""
    global _graph
    from langgraph.checkpoint.memory import MemorySaver

    _graph = build_blueprint_graph(MemorySaver())
    return _graph


def _with_search_path(dsn: str, schema: str = "langgraph") -> str:
    """Garantiza que la conexion del saver fije `search_path` al esquema
    indicado, sin depender de que `LANGGRAPH_PG_DSN` ya lo incluya.

    Plan Fase 3: "Garantizar search_path=langgraph en la conexion del saver
    (via DSN options=-c search_path=langgraph, o configurando la
    conexion/pool del PostgresSaver)".
    """
    if "search_path" in dsn:
        return dsn
    sep = "&" if "?" in dsn else "?"
    return f"{dsn}{sep}options=-c%20search_path%3D{schema}"


def init_graph_postgres(stack: ExitStack):
    """Compila el grafo con PostgresSaver; cae a memoria si Postgres no esta disponible."""
    global _graph
    try:
        from langgraph.checkpoint.postgres import PostgresSaver

        dsn = _with_search_path(settings.langgraph_pg_dsn)
        saver = stack.enter_context(PostgresSaver.from_conn_string(dsn))
        saver.setup()  # crea checkpoints/checkpoint_blobs/checkpoint_writes/checkpoint_migrations en `langgraph`
        _graph = build_blueprint_graph(saver)
        return _graph
    except Exception as exc:  # pragma: no cover
        print(f"[runtime] Postgres checkpointer no disponible ({exc}); usando memoria.")
        return init_graph_memory()


def init_graph_persistent(stack: ExitStack):
    """Elige el checkpointer por defecto: Postgres -> memoria (Postgres-first)."""
    if settings.langgraph_pg_dsn:
        init_graph_postgres(stack)
    else:
        print("[runtime] LANGGRAPH_PG_DSN no configurado; usando memoria.")
        init_graph_memory()
    return _graph

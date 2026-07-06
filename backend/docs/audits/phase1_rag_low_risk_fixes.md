# Fase 1 — Correcciones de Bajo Riesgo (Pre-RAG)

> **Rol:** Senior Backend Engineer (Python / FastAPI / LangGraph / PostgreSQL).
> **Fecha:** 2026-07-04
> **Fuente de verdad:** `docs/audits/backend_architecture_audit_pre_rag.md` (auditoría) y
> `docs/audits/backend_architecture_evolution_validation.md` (validación de la estrategia,
> §7 "Fase 1 — Correcciones de bajo riesgo").
> **Alcance ejecutado:** exactamente el descrito en la Fase 1 del roadmap aprobado. No se
> auditó de nuevo, no se replantearon decisiones ya aprobadas, no se tocó RAG/pgvector/Knowledge
> Service/AsyncPostgresSaver/BlueprintState/`blueprints.state`.

---

## 1. Cambios realizados

### 1.1 Documentación

- **Docstring de `build_graph.py` actualizado** (R6). Antes omitía `business_model` (entre
  `value_proposition` y `hypotheses`) y la cadena `decision → sequencing → plan_estimate` (entre
  `success_criteria` y `critic`), y decía "9 Lean Agents" en vez de 14. El docstring ahora refleja
  la topología real de 19 nodos verificada en `make_graph_builder()`.
- **Variables `LANGSMITH_*` documentadas en `.env.example`**: `LANGSMITH_TRACING`,
  `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`, `LANGSMITH_HIDE_INPUTS`,
  `LANGSMITH_HIDE_OUTPUTS`, con una nota de que el tracing exige `LANGSMITH_TRACING=true` **y**
  API key (`tracing_enabled()`).

### 1.2 Fallback del checkpointer (R4)

- `app/graph/runtime.py` ahora rastrea el estado del checkpointer en dos variables de módulo:
  `_checkpointer_backend` (`"postgres" | "memory" | "unknown"`) y `_checkpointer_degraded`
  (`True` solo cuando Postgres estaba configurado y la conexión/`setup()` fallaron en tiempo de
  arranque, forzando la caída a `MemorySaver`).
- Se agregó `get_checkpointer_status()` para exponer ese estado.
- En `init_graph_postgres`, el `except` que antes solo imprimía un mensaje ahora **además**
  emite `warnings.warn(..., RuntimeWarning)` explícito y marca `_checkpointer_degraded = True`
  antes de caer a memoria.
- **Sin cambio de comportamiento funcional**: la cadena de prioridad (Postgres → memoria) es
  idéntica; solo se agregó observabilidad del estado. El caso "sin `LANGGRAPH_PG_DSN` configurado"
  (modo dev intencional) **no** se marca como degradado — es una elección de configuración, no un
  fallo silencioso.
- `app/main.py`: `GET /health` ahora incluye `checkpointer: {backend, degraded}` y el campo
  `status` pasa a `"degraded"` cuando `checkpointer.degraded` es `True` (antes siempre `"ok"`).

### 1.3 `MAX_REVISIONS` externalizado

- `app/core/config.py`: nuevo setting `max_revisions: int = 2` (antes era una constante local
  `MAX_REVISIONS = 1` en `app/agents/supervisor.py`).
- `app/agents/supervisor.py`: `route_after_critic` ahora usa `settings.max_revisions` en vez de
  la constante del módulo. **El flujo del crítico no cambió** (mismo `route_after_critic`, mismo
  `bump_revision_node` incrementando el contador); solo cambió de dónde sale el límite y su valor
  por defecto (1 → 2, según el ajuste aprobado en la validación).

### 1.4 Política de poda para `messages`

- Nueva utilidad `prune_messages(messages, *, window)` en `app/agents/base.py`: dado el límite
  `window`, devuelve `RemoveMessage(id=...)` para los mensajes más antiguos que lo excedan.
  Respeta el reducer `add_messages` existente (identifica por `id`, no reescribe contenido). **No
  hay resumen por LLM** — se descartó explícitamente por la validación (Punto 4): `messages` no se
  reinyecta a los prompts de los agentes, así que resumir no reduciría ningún prompt y solo
  añadiría coste/latencia/no-determinismo.
- Nuevo setting `messages_window: int = 20` en `app/core/config.py`.
- La poda se invoca **solo en los nodos de orquestación** (no en los 14 Lean Agents, que
  permanecen intactos): `supervisor_node`, `bump_revision_node`, `human_hypotheses_node`,
  `human_prioritization_node` y `human_approval_node`, todos en `app/agents/supervisor.py`. Cada
  uno agrega su `RemoveMessage`s de poda junto a su `trace()` habitual.
- **BlueprintState no se modificó** (`app/schemas/state.py` sin cambios): sigue siendo
  `messages: Annotated[list, add_messages]`. **Ningún prompt se modificó.**

---

## 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/graph/build_graph.py` | Docstring corregido (topología real, 14 agentes) |
| `.env.example` | Sección `LANGSMITH_*` documentada |
| `app/graph/runtime.py` | Estado del checkpointer (`backend`/`degraded`) + warning explícito en el fallback |
| `app/main.py` | `/health` expone `checkpointer` y `status: "degraded"` |
| `app/core/config.py` | `max_revisions: int = 2`, `messages_window: int = 20` |
| `app/agents/supervisor.py` | Usa `settings.max_revisions`; poda de `messages` en los 5 nodos de orquestación |
| `app/agents/base.py` | Nueva utilidad `prune_messages()` |

No se tocó ningún archivo de `app/agents/{business_model,critic,customer_segment,decision,
experiment_design,hypotheses,metrics,plan_estimate,problem,report,risk,sequencing,
success_criteria,value_proposition}.py`, ni `app/agents/prompts/__init__.py`, ni
`app/schemas/state.py`, ni `app/db/*`, ni `app/catalog/*`.

---

## 3. Evidencia de funcionamiento

**Docstring** — `make_graph_builder()` (`app/graph/build_graph.py:45-112`) confirma la topología
descrita en el nuevo docstring: `problem → customer_segment → value_proposition → business_model
→ hypotheses` y `experiment_design → metrics → success_criteria → decision → sequencing →
plan_estimate → critic`.

**Fallback degradado** — verificado por ejecución con un DSN inválido apuntando a un puerto
inexistente:

```
[runtime] ALERTA: Postgres checkpointer no disponible (connection timeout expired ...);
          usando memoria (degraded).
warnings emitted: ['[runtime] Postgres checkpointer no disponible (connection timeout expired...']
status: {'backend': 'memory', 'degraded': True}
```

Y el caso normal (memoria elegida explícitamente, sin fallo de Postgres) confirma que **no** se
marca como degradado:

```python
init_graph_memory()
get_checkpointer_status()  # {'backend': 'memory', 'degraded': False}
health()                   # {'status': 'ok', ..., 'checkpointer': {'backend': 'memory', 'degraded': False}}
```

**`MAX_REVISIONS` / `messages_window`** — confirmado por lectura de `settings`:

```python
settings.max_revisions     # 2
settings.messages_window   # 20
```

**Poda por conteo** — verificado con una lista de 25 mensajes con `id` y ventana 20: se generan 5
`RemoveMessage` para los 5 más antiguos (ids `'0'`..`'4'`), dejando los últimos 20; con una lista
por debajo de la ventana no se genera ningún `RemoveMessage` (no-op).

---

## 4. Verificaciones ejecutadas

- **Suite de tests completa:** `pytest tests/ -q` → **47 passed** (incluye
  `test_graph_smoke.py`, que corre el grafo completo con los 3 `interrupt` HITL y el bucle del
  crítico end-to-end; `test_api.py::test_health` sigue verificando `status == "ok"` en el caso
  normal). Nota de entorno: la base `blueprint_test` no existía en esta máquina antes de correr
  la suite (gap de aprovisionamiento local, no relacionado con esta fase); se creó vacía y
  Alembic reconstruyó el esquema como hace normalmente el fixture de sesión.
- **Import de todos los módulos tocados** sin errores (`app.graph.build_graph`,
  `app.graph.runtime`, `app.agents.supervisor`, `app.core.config`, `app.main`).
- **Prueba dirigida del fallback** del checkpointer con DSN inválido (ver §3): confirma warning
  explícito + `degraded=True` + `/health` reportando `"degraded"`.
- **Prueba dirigida de `prune_messages`** (ver §3): ventana respetada, `RemoveMessage` solo para
  el excedente, no-op por debajo del límite.

---

## 5. Riesgos encontrados

Ninguno bloqueante. Dos notas menores:

1. La poda de `messages` ocurre únicamente en los 5 nodos de orquestación (triaje, HITL x3,
   `bump_revision`), no después de cada uno de los 14 Lean Agents — que quedaron intactos por
   alcance. En el camino feliz (sin revisiones del crítico) el conteo de mensajes de un run típico
   (~19) queda por debajo de la ventana (20), así que la poda no actúa; su efecto es visible
   principalmente cuando el bucle del crítico itera (ahora hasta 2 veces con
   `MAX_REVISIONS=2`), que es exactamente el escenario que hace crecer `messages` sin cota. No es
   un defecto — es la consecuencia esperada de no tocar los agentes — pero queda documentado para
   que la Fase 2/3 lo tenga en cuenta si se decide podar con más granularidad.
2. La base de datos de test (`blueprint_test`) no estaba aprovisionada en este entorno; se creó
   para poder ejecutar la suite. Esto es un gap de entorno local, no un hallazgo de arquitectura.

---

## 6. Confirmación de no exceder el alcance

- No se implementó RAG, pgvector, ni Knowledge Service.
- No se tocó `AsyncPostgresSaver` ni el saver síncrono (`PostgresSaver.from_conn_string` sigue
  igual; solo se envuelve con tracking de estado, sin cambiar su comportamiento).
- No se modificó `BlueprintState` (`app/schemas/state.py` sin diff).
- No se modificó la lógica del Checkpointer más allá de exponer su estado y avisar del fallback
  (mismo `search_path`, mismo `setup()`, misma cadena de prioridad Postgres → memoria).
- No se tocó `blueprints.state` ni la doble fuente de verdad (Punto 2 / Fase 2, fuera de alcance).
- No se modificó ningún agente Lean (los 14 nodos LLM del enjambre permanecen sin cambios).
- No se modificó ningún prompt (`app/agents/prompts/__init__.py` sin diff).
- No se implementó resumen de `messages` por LLM (explícitamente descartado por la validación).
- No se realizaron optimizaciones ni refactors no aprobados (p. ej. no se tocó el pool de
  conexiones, no se dimensionó `pool_size`/`max_overflow`, no se tocó `session.py`).

**Criterio de finalización cumplido:** las 4 correcciones aprobadas de la Fase 1 están
implementadas, el backend sigue funcionando (`pytest` 47/47), no hay regresiones detectadas, y
este documento deja constancia de cambios, evidencia y riesgos.

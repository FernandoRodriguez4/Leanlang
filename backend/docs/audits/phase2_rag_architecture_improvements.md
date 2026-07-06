# Fase 2 — Mejoras Arquitectónicas (Persistencia / Estado / Rendimiento)

> **Rol:** Senior Backend Engineer (Python / FastAPI / LangGraph / PostgreSQL).
> **Fecha:** 2026-07-04
> **Fuente de verdad:** `docs/audits/backend_architecture_audit_pre_rag.md` (auditoría),
> `docs/audits/backend_architecture_evolution_validation.md` (validación de la estrategia,
> §7 "Fase 2 — Mejoras arquitectónicas"), `docs/audits/phase1_rag_low_risk_fixes.md` y
> `docs/audits/phase1_rag_code_review.md` (Fase 1, prerrequisito ya cerrado: R4 — fallback
> ruidoso + health-check *degraded*).
> **Alcance ejecutado:** exactamente el descrito en la Fase 2 del roadmap aprobado. No se
> auditó de nuevo, no se replantearon decisiones ya aprobadas, no se tocó RAG/pgvector/
> Knowledge Service/`AsyncPostgresSaver`/`BlueprintState`/agentes/prompts.

---

## 1. Cambios implementados

### 1.1 `blueprints.state` reclasificado como proyección de lectura derivada

Siguiendo el ajuste aprobado en la validación (Punto 2: "reclasificar, no eliminar"), se
formalizó en código lo que ya era la intención arquitectónica: el checkpointer sigue siendo
la **única fuente de verdad** del estado vivo de ejecución; `blueprints.state` es una
**proyección NO autoritativa**, derivada y recomputable en cualquier momento.

- Nueva función `_project_from_checkpoint(thread_id)` (`app/api/routes/blueprint.py`):
  encapsula la derivación (antes era código inline en `_persist_final`) y queda documentada
  explícitamente como **idempotente por construcción** — dado el mismo checkpoint, siempre
  produce el mismo resultado porque es una sobreescritura completa de campos serializables
  (vía `serialize_blueprint`), sin merge incremental. Volver a invocarla y volver a persistir
  su resultado es seguro de repetir.
- `_persist_final` ahora:
  1. deriva la proyección desde el checkpointer (`_project_from_checkpoint`);
  2. persiste en `blueprints.state` dentro de un único `try/except`;
  3. si la escritura falla, emite un `RuntimeWarning` explícito (mismo patrón que el
     fallback del checkpointer de la Fase 1/R4) en vez de fallar en silencio — el
     checkpointer sigue teniendo el estado autoritativo, así que no hay pérdida de datos de
     dominio, solo una proyección desactualizada hasta la próxima escritura exitosa.
- **No se eliminó `blueprints.state`** ni se cambió `GET /blueprint/{id}` (sigue leyendo la
  proyección directamente, sin tocar el checkpointer en el camino de lectura — el ajuste
  aprobado explícitamente evita acoplar cada `GET` a `graph.get_state(...)`).

### 1.2 Shadow Read — validación temporal checkpointer ↔ proyección

Nueva función `shadow_read_check(blueprint_id)` (`app/api/routes/blueprint.py`):

- Lee la proyección persistida (`blueprints.state` + `status`) y, por separado, deriva el
  estado fresco desde el checkpointer para el mismo `thread_id` (reusando
  `_project_from_checkpoint`).
- Compara ambos: contenido del estado (`state_match`), estado de `status` (`status_match`,
  tolerando `"running"` como transitorio legítimo mientras el grafo avanza entre dos
  checkpoints) y devuelve las claves en las que difieren (`diff_keys`).
- **Solo lectura; nunca escribe ni modifica el checkpointer.**
- Activación opcional y temporal vía el nuevo setting `shadow_read_enabled` (default
  `False`): cuando está en `True`, `_persist_final` corre `shadow_read_check` justo después
  de persistir y emite un `RuntimeWarning` si detecta divergencia. Es una verificación
  *post-write*, no un mecanismo permanente — la validación diseñada explícitamente para el
  período previo a confiar del todo en la proyección (§7, Punto 2 de la validación).
- Nuevo script `scripts/shadow_read_check.py`: corre `shadow_read_check` contra todos los
  blueprints existentes (o uno específico por id) y reporta divergencias por línea de
  comandos, para validación manual/periódica fuera del camino caliente de cada request.

### 1.3 Pool de conexiones PostgreSQL — revisión y dimensionamiento

**Hallazgo relevante durante la revisión:** `PostgresSaver.from_conn_string` (paquete
`langgraph-checkpoint-postgres==3.1.0`, `langgraph/checkpoint/postgres/__init__.py:76-83`)
usa una **única conexión psycopg** (`Connection.connect(...)`), no un pool — serializada
además por un `threading.Lock()` interno. Esto es **completamente independiente** del pool
de SQLAlchemy de `app/db/session.py`: el checkpointer nunca consume conexiones de ese pool.
En consecuencia, el pool de SQLAlchemy solo atiende CRUD de negocio (auth/projects/blueprints)
y la escritura de la proyección derivada (`_persist_final`) — cargas de vida corta, no
conexiones retenidas durante la ejecución completa (potencialmente larga, por las llamadas
LLM) de un blueprint.

Cambios (sin migrar a `AsyncPostgresSaver`, sin tocar el saver — decisión ya aprobada y sin
cambios):

- `app/core/config.py`: nuevos settings `db_pool_size` (10), `db_max_overflow` (20),
  `db_pool_timeout` (30), `db_pool_recycle` (1800) — antes constantes hardcodeadas
  (`pool_size=5, max_overflow=10, pool_recycle=1800`, sin `pool_timeout` explícito) en
  `app/db/session.py`.
- `app/db/session.py`: el `create_engine(...)` ahora lee estos valores de `settings` en vez
  de constantes fijas — mismo patrón de externalización que `max_revisions`/
  `messages_window` en la Fase 1.
- Los valores por defecto se doblaron (`pool_size` 5→10, `max_overflow` 10→20) como ajuste
  razonado a partir del hallazgo anterior (el pool de SQLAlchemy no compite con el
  checkpointer y solo absorbe ráfagas cortas), dando margen antes de que una carga
  concurrente alta agote el pool en operaciones de negocio. **No se ejecutaron pruebas de
  carga nuevas** en esta fase (fuera del alcance pedido, que pide "revisar y dimensionar
  según la configuración actual", no reejecutar el harness de la Fase 0); los scripts de
  benchmark ya existentes (`scripts/benchmark/phase0_baseline.py`,
  `scripts/benchmark/monitor.py`) siguen disponibles para validar estos valores con datos
  reales antes de un despliegue de producción de alta concurrencia.
- `.env.example`: documentadas las nuevas variables `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`,
  `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE` y `SHADOW_READ_ENABLED`.

---

## 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/api/routes/blueprint.py` | `_project_from_checkpoint()` (deriva proyección, documentada como idempotente), `shadow_read_check()` (validación temporal), `_persist_final()` refactorizado (try/except con warning + shadow-read opcional) |
| `app/core/config.py` | `db_pool_size`, `db_max_overflow`, `db_pool_timeout`, `db_pool_recycle`, `shadow_read_enabled` |
| `app/db/session.py` | `create_engine(...)` usa los settings de pool en vez de constantes fijas |
| `.env.example` | Documentadas las variables de pool y `SHADOW_READ_ENABLED` |
| `scripts/shadow_read_check.py` | Nuevo script de validación manual/periódica (solo lectura) |
| `tests/test_shadow_read.py` | Nuevo — 6 tests de la proyección derivada y shadow read |

No se tocó `app/schemas/state.py` (`BlueprintState`), ningún archivo de `app/agents/*`
(incluidos los 14 Lean Agents y `supervisor.py`), `app/agents/prompts/__init__.py`,
`app/graph/build_graph.py`, `app/graph/runtime.py`, ni el mecanismo del checkpointer
(`PostgresSaver` síncrono sin cambios, sin `AsyncPostgresSaver`).

---

## 3. Verificaciones realizadas

- **Consistencia proyección ↔ checkpoint:**
  - `test_persist_final_projection_matches_checkpoint`: tras `_persist_final`, la proyección
    persistida coincide exactamente con lo derivado del checkpointer (`match=True`,
    `diff_keys=[]`).
  - `test_persist_final_is_idempotent`: invocar `_persist_final` dos veces sobre el mismo
    checkpoint devuelve el mismo evento SSE y deja la proyección consistente — confirma la
    idempotencia declarada.
  - `test_shadow_read_check_detects_divergence`: corrompiendo manualmente `blueprints.state`
    (simulando una escritura previa fallida/parcial) sin tocar el checkpoint, `shadow_read_check`
    detecta `match=False` / `state_match=False`.
  - `test_shadow_read_check_missing_blueprint`: id inexistente → `found=False`, sin excepción.
  - `test_persist_final_warns_on_shadow_read_mismatch`: con `shadow_read_enabled=True`, una
    divergencia detectada emite `RuntimeWarning` (capturado con `pytest.warns`) sin romper el
    flujo de persistencia.
- **Funcionamiento del workflow:** `pytest tests/ -q` → **56 passed** (51 previos de la Fase 1
  + 5 nuevos de `tests/test_shadow_read.py`), incluyendo `test_graph_smoke.py` (grafo completo
  con los 3 `interrupt` HITL y el bucle del crítico) y `test_api.py`/`test_streaming.py` sin
  regresiones.
- **Pool de conexiones:** verificado por lectura de `settings` y del `engine` compilado:
  `engine.pool.size() == 10`, `engine.pool._max_overflow == 20`, coincidiendo con los nuevos
  defaults; import de `app.db.session` y `app.core.config` sin errores.
- **Import de todos los módulos tocados** sin errores (`app.api.routes.blueprint`,
  `app.core.config`, `app.db.session`).
- **Ausencia de regresiones:** ningún test previo de la Fase 1 cambió de resultado; el
  endpoint `GET /blueprint/{id}` no se modificó (sigue leyendo `blueprints.state`
  directamente); el health-check y el fallback del checkpointer de la Fase 1 quedan intactos.

---

## 4. Riesgos encontrados

1. **Conexión única del checkpointer (hallazgo, no un defecto introducido aquí):**
   `PostgresSaver.from_conn_string` usa una sola conexión psycopg serializada por un lock en
   proceso — el pool de SQLAlchemy dimensionado en esta fase **no** alivia la concurrencia del
   propio checkpointer. Este es un límite del saver síncrono ya aceptado (Punto 3, aprobado
   sin cambios); queda documentado aquí porque afecta directamente el razonamiento de
   dimensionamiento del pool, no porque requiera acción en esta fase. Prioridad: informativa.
2. **Dimensionamiento del pool sin prueba de carga nueva:** los nuevos valores
   (`pool_size=10`, `max_overflow=20`) son un ajuste razonado a partir de cómo se usa el pool
   (ráfagas cortas de CRUD/proyección, no conexiones retenidas por ejecución), pero no fueron
   validados con el harness de carga (`scripts/benchmark/`) en esta fase — el alcance pedido
   fue "revisar y dimensionar según la configuración actual", no reejecutar pruebas de carga.
   Riesgo bajo (los valores anteriores ya funcionaban; estos solo dan más margen), pero
   conviene correr `scripts/benchmark/phase0_baseline.py` contra estos nuevos valores antes de
   un despliegue de alta concurrencia en producción.
3. **Shadow read es un warning, no una alarma monitoreada:** `shadow_read_enabled=True` emite
   `RuntimeWarning` (visible en logs/stderr), pero no hay aún un canal de alerta activa
   (métrica, dashboard). Suficiente para el período de validación manual/script descrito en el
   alcance; si se decide mantenerlo activo en producción por más tiempo del previsto,
   convendría conectar estos warnings a observabilidad real — fuera de alcance de esta fase.

Ningún riesgo es bloqueante ni requiere modificar la arquitectura aprobada.

---

## 5. Confirmación de no exceder el alcance

- No se implementó RAG, pgvector, ni Knowledge Service.
- No se migró a `AsyncPostgresSaver`; `PostgresSaver.from_conn_string` sigue exactamente
  igual (misma conexión única, mismo `search_path`, mismo `setup()`). La decisión sobre el
  saver permanece sin cambios.
- No se modificó `BlueprintState` (`app/schemas/state.py` sin diff).
- No se modificó ningún agente Lean ni `supervisor.py` ni ningún prompt
  (`app/agents/prompts/__init__.py` sin diff).
- No se eliminó `blueprints.state`: se reclasificó como proyección derivada, tal como exige
  el ajuste aprobado (Punto 2), sin romper el contrato de `GET /blueprint/{id}`.
- El shadow read es estrictamente de solo lectura y temporal (gateado por
  `shadow_read_enabled`, default `False`); no se introdujo ningún componente arquitectónico
  nuevo (ni servicio, ni tabla, ni endpoint HTTP nuevo) — es una función de verificación más
  un script de línea de comandos.
- No se tocó la topología del grafo (`app/graph/build_graph.py`) ni el mecanismo del
  checkpointer (`app/graph/runtime.py`) más allá de lo ya cerrado en la Fase 1.
- No se realizaron optimizaciones ni refactors no aprobados fuera de lo descrito arriba.

**Criterio de finalización cumplido:** los cambios aprobados de la Fase 2 (proyección
derivada + escritura idempotente, shadow read temporal, pool de conexiones dimensionado)
están implementados, el workflow sigue funcionando correctamente (`pytest` 56/56), no hay
regresiones detectadas, y este documento deja constancia de cambios, verificaciones y
riesgos. El sistema queda listo para la Fase 3 (formalizar `app/catalog/service.py` como
Knowledge Service con interfaz dual, según
`docs/audits/backend_architecture_evolution_validation.md` §7).

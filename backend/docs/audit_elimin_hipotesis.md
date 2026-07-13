# Auditoría Técnica: Ciclo de Vida de las Hipótesis

## Resumen Ejecutivo

**⚠️ Modelo híbrido — ni Caso 1 ni Caso 2 tal como están definidos.**

El comportamiento real no calza con ninguno de los dos casos limpios porque **no existe una tabla/entidad "Hypothesis"**. Las hipótesis nunca son filas individuales en la BD; son un `array` dentro de un blob JSON que representa *todo* el estado del blueprint. Ese blob se persiste automáticamente en dos lugares de Postgres **antes** de que el usuario revise nada:

1. El checkpointer nativo de LangGraph (`PostgresSaver`, esquema `langgraph`) — se escribe en cada transición de nodo, incluida la que genera las hipótesis.
2. La proyección `blueprints.state` (JSONB) de la tabla de negocio — se escribe la primera vez justo cuando el flujo llega al interrupt de revisión (`human_hypotheses`), es decir, con las 11 hipótesis ya generadas y **antes** de que el usuario haga nada.

Entonces:

- No es Caso 1 puro: las hipótesis **sí llegan a Postgres** antes de la confirmación del usuario (vía checkpointer, y también vía la proyección `blueprints.state` en el momento del interrupt).
- No es Caso 2 puro: no hay tabla `hypotheses`, no hay `Hypothesis` ORM, no hay `INSERT`/`UPDATE` por fila, no hay endpoint `PATCH`/`DELETE` de una hipótesis individual. La "persistencia" es una sobrescritura completa del blob (snapshot completo, no CRUD granular).

---

## Evidencias

### Archivos inspeccionados
- `app/agents/hypotheses.py` — generación
- `app/schemas/hypothesis.py` — schema Pydantic `Hypothesis` / `HypothesisList`
- `app/schemas/state.py` — `BlueprintState` (TypedDict, no modelo ORM)
- `app/graph/build_graph.py` — topología del grafo
- `app/agents/supervisor.py` — nodos human-in-the-loop
- `app/api/streaming.py` — puente SSE
- `app/api/routes/blueprint.py` — endpoints `run` / `resume` / `get`
- `app/graph/runtime.py` — configuración del checkpointer
- `app/db/models.py`, `app/db/session.py` — capa ORM
- `migrations/versions/82c106cacc45_initial_schema.py` — esquema real de tablas
- `tests/test_shadow_read.py` — confirma el timing de persistencia

### Modelos ORM encontrados
Solo 4 tablas de negocio, ninguna es `Hypothesis`:

| Tabla | Archivo | Campos relevantes |
|---|---|---|
| `users` | `app/db/models.py:14` | — |
| `projects` | `app/db/models.py:27` | `raw_idea`, `constraints` |
| `blueprints` | `app/db/models.py:45` | `thread_id`, **`state: JSONB`**, `status` |
| `experiments` | `app/db/models.py:64` | catálogo estático de los 44 experimentos |

`Hypothesis` en `app/schemas/hypothesis.py:10` es un **schema Pydantic**, no un modelo SQLAlchemy — no tiene `__tablename__`, no hereda de `Base`. Sirve solo para validar la salida estructurada del LLM (`get_structured_model(HypothesisList)`).

### Confirmación en migración inicial
`migrations/versions/82c106cacc45_initial_schema.py` solo crea `experiments`, `users`, `projects`, `blueprints`. **No existe tabla `hypotheses`.**

### Repositorios / servicios
No existe `HypothesisService`, `HypothesisRepository` ni ningún módulo de persistencia dedicado a hipótesis. No hay `Session.add(Hypothesis(...))`, ni `bulk_insert`, ni `create()` para hipótesis en ningún archivo del repo.

### Endpoints encontrados relacionados con hipótesis
- `POST /projects/{project_id}/blueprint/run` (`app/api/routes/blueprint.py:148`) — arranca el grafo.
- `POST /blueprint/{blueprint_id}/resume` (`app/api/routes/blueprint.py:181`) — reanuda tras cualquier interrupt, incluido el de hipótesis, vía `Command(resume=payload)`.
- `GET /blueprint/{blueprint_id}` (`app/api/routes/blueprint.py:202`) — lee `bp.state` (la proyección JSONB).

No hay `DELETE`/`PATCH` específico de una hipótesis. La única ruta `DELETE` del sistema es `DELETE /projects/{project_id}` (`app/api/routes/projects.py:57`), que borra el proyecto entero (cascada).

---

## 1. Flujo de generación

`app/agents/hypotheses.py:13` — `hypotheses_node(state)`:
```python
result: HypothesisList = model.invoke(msgs)
hyps = [h.model_dump(mode="json") for h in result.hypotheses]
return {"hypotheses": hyps, "messages": [...]}
```
El LLM produce un `HypothesisList` (Pydantic, validación en memoria), se serializa a `list[dict]` y se devuelve como update de nodo LangGraph. Este `dict` se mergea en `BlueprintState` (`app/schemas/state.py:28`, campo `hypotheses: list[dict[str, Any]]`), que es un `TypedDict` — **no un modelo ORM**, vive en el estado del grafo.

**Respuesta:** viven inicialmente en el **State de LangGraph** (`state["hypotheses"]`), como `list[dict]` serializable, no como objetos ORM ni Artifact independiente.

## 2. Persistencia

Hay dos mecanismos de escritura a Postgres, ninguno es CRUD de dominio sobre una tabla `hypotheses`:

**a) Checkpointer de LangGraph** (`app/graph/runtime.py:67`, `init_graph_postgres`): usa `PostgresSaver` sobre el esquema `langgraph` (tablas `checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, gestionadas por LangGraph, no por el ORM de la app). Esto persiste **automáticamente** el estado completo (incluidas las hipótesis) en cada transición de nodo — es infraestructura de LangGraph, no lógica de negocio explícita del repo. Ocurre inmediatamente al terminar `hypotheses_node`, antes de llegar al nodo de revisión humana.

**b) Proyección `blueprints.state`** (`app/api/routes/blueprint.py:99`, `_persist_final`):
```python
blueprint, awaiting = _project_from_checkpoint(thread_id)
...
bp.state = blueprint
bp.status = status
db.commit()
```
Se llama al final de `_sse` (`app/api/routes/blueprint.py:145`), es decir, **cada vez que el stream SSE se agota** — lo que ocurre tanto al llegar a un interrupt como al terminar el grafo. La primera vez que esto pasa tras `run_blueprint`, el grafo ya corrió `hypotheses_node` y está pausado en `human_hypotheses` (interrupt), por lo que `blueprint` ya incluye las 11 hipótesis y `status="awaiting_input"`. El propio código lo documenta explícitamente (`app/api/routes/blueprint.py:44-49`):

> "El checkpointer es la única fuente de verdad del estado vivo de ejecución [...]; `blueprints.state` es una proyección NO autoritativa derivada de aquí."

**Respuesta:** sí existe persistencia automática (dos capas), y ocurre **antes** de la confirmación del usuario — al llegar al interrupt de revisión, no al confirmar. La ejecuta el propio flujo del grafo (checkpointer) y la función `_persist_final` (proyección de negocio).

## 3. Modelos ORM

No existe `Hypothesis`, `BlueprintHypothesis`, `BusinessHypothesis` ni `ValidationHypothesis` como modelo SQLAlchemy. El único `Hypothesis` del repo es el schema Pydantic de validación de salida del LLM (`app/schemas/hypothesis.py:10`), sin persistencia propia.

**Respuesta: las hipótesis NO tienen tabla propia.**

## 4. Base de datos

**No existe una tabla destinada a hipótesis.** Las hipótesis viven:
- Como parte del JSON del checkpointer de LangGraph (esquema `langgraph`, tablas internas de LangGraph).
- Como una clave (`"hypotheses"`) dentro del JSONB `blueprints.state` (tabla `blueprints`, `app/db/models.py:56`), junto a todos los demás artefactos del blueprint (`problem`, `customer_segment`, `classifications`, `report`, etc.).

No hay relación ni clave foránea a nivel de hipótesis individual — son un array embebido, sin `id` de fila propio (solo el `id: "h1"` interno del schema, que es un string arbitrario del LLM, no una PK de BD).

## 5. Momento exacto del guardado

Flujo real confirmado también por `tests/test_shadow_read.py:49-66` (el test invoca el grafo una sola vez, llama `_persist_final`, y verifica `projected_status == "awaiting_input"` con las hipótesis ya en `bp.state`):

```
IA genera hipótesis (hypotheses_node)
   ↓
State LangGraph (state["hypotheses"])
   ↓
Checkpointer Postgres persiste el checkpoint (automático, LangGraph)
   ↓
Grafo entra a human_hypotheses → interrupt() → stream SSE se agota
   ↓
_persist_final(): lee el checkpoint (YA con las 11 hipótesis) y hace
Session.commit() sobre blueprints.state  (status="awaiting_input")
   ↓
BD (dos lugares: checkpoint de LangGraph + blueprints.state)
   ↓
Usuario recién ahora ve/revisa las hipótesis (vía GET /blueprint/{id} o el evento SSE "interrupt")
```

**No es** el patrón "IA genera → State → usuario revisa → confirma → commit". El primer commit ocurre **antes** de que el usuario haya visto nada, disparado por el propio interrupt, no por una acción del usuario.

## 6. Edición

`human_hypotheses_node` (`app/agents/supervisor.py:100`):
```python
edited = interrupt({"type": "review_hypotheses", "hypotheses": state.get("hypotheses", [])})
if isinstance(edited, dict) and edited.get("hypotheses"):
    return {"hypotheses": edited["hypotheses"], ...}
return {"messages": [...]}  # sin cambios si no se edita
```
El usuario edita vía `POST /blueprint/{id}/resume` (`app/api/routes/blueprint.py:181`) con `ResumeRequest{stage: "hypotheses", payload: {"hypotheses": [...]}}`. Esto se traduce en `Command(resume=payload)`, que LangGraph inyecta como valor de retorno de `interrupt()`. El nodo entonces **reemplaza el array completo** `state["hypotheses"]` (no hace merge por id, no actualiza una hipótesis individual — sobrescribe todo el campo, comportamiento por defecto de LangGraph al no haber un reducer `Annotated` para ese campo en `BlueprintState`).

Este nuevo estado se re-checkpointea automáticamente (LangGraph) al avanzar de nodo, y se vuelve a proyectar a `blueprints.state` en el siguiente `_persist_final` (siguiente interrupt o fin del grafo).

**Respuesta:** la edición no es un simple cambio de frontend: hace un `POST /resume` real, actualiza el State de LangGraph (reemplazo completo del array), se checkpointea en Postgres, y eventualmente hace `Session.commit()` sobre la proyección `blueprints.state`. Pero **no** es un `PATCH` granular ni un `UPDATE` de fila — es sobrescritura de blob completo.

## 7. Eliminación

No existe ningún endpoint, servicio, repositorio ni lógica de `DELETE`/soft-delete para una hipótesis individual. Lo más cercano: si el usuario "elimina" una hipótesis en el frontend, tendría que enviar el array editado (sin esa hipótesis) dentro de `ResumeRequest.payload["hypotheses"]` al mismo endpoint `/resume` — que la excluiría del array reemplazado. Pero **esto no está implementado como una operación de eliminación explícita en el backend**; sería, a lo sumo, una consecuencia implícita de reemplazar el array completo vía edición.

**Respuesta: no existe nada dedicado a eliminar una hipótesis** (ni endpoint, ni servicio, ni repository, ni DELETE, ni soft delete).

## 8. Consumo posterior

`route_entry` (`app/agents/supervisor.py:65`) y `risk_node` (siguiente nodo tras `human_hypotheses`) leen `state.get("hypotheses")` — es decir, **el State de LangGraph**, no la BD directamente. La proyección `blueprints.state` solo se usa para servir lecturas HTTP (`GET /blueprint/{id}`), nunca se relee hacia el grafo — el propio código lo aclara: es "NO autoritativa", derivada, solo para lectura externa.

**Respuesta:** los agentes posteriores leen exclusivamente el **State de LangGraph** (respaldado por el checkpointer de Postgres). La BD de negocio (`blueprints.state`) es solo una copia de lectura para el frontend, no una fuente que alimente al grafo.

---

## Diagrama del flujo real

```
Supervisor (triaje)
     ↓
hypotheses_node → genera 11 hipótesis → state["hypotheses"]
     ↓
Checkpointer Postgres (langgraph.checkpoints) ← escritura automática, YA persistido
     ↓
human_hypotheses_node → interrupt() → stream SSE termina
     ↓
_persist_final() → blueprints.state (JSONB) ← segunda escritura, YA persistido,
                     status="awaiting_input"          ANTES de que el usuario actúe
     ↓
Frontend recibe evento "interrupt" / hace GET /blueprint/{id}
     ↓
Usuario edita o acepta
     ↓
POST /blueprint/{id}/resume → Command(resume={"hypotheses":[...]})
     ↓
human_hypotheses_node reanuda → REEMPLAZA state["hypotheses"] completo
     ↓
Checkpointer Postgres (nuevo checkpoint, automático)
     ↓
risk_node consume state["hypotheses"] (del State, no de la BD de negocio)
     ↓
... siguiente interrupt → _persist_final() vuelve a sobrescribir blueprints.state completo
```

---

## Conclusión Final

1. **¿Las hipótesis existen en la BD inmediatamente después de ser generadas?**
   Sí, en dos formas: automáticamente vía el checkpointer de LangGraph (Postgres, esquema `langgraph`) apenas termina `hypotheses_node`, y luego también en la proyección `blueprints.state` en cuanto el flujo llega al interrupt de revisión — es decir, **antes** de que el usuario haga cualquier acción. No están en un "borrador" separado del resto del estado.

2. **¿O solo existen en memoria hasta que el usuario las confirma?**
   No. La confirmación del usuario no es el evento que dispara el primer guardado — el guardado ya ocurrió al momento de generarse/pausar el grafo. Lo que hace la confirmación/edición es generar un **nuevo** checkpoint (reemplazando el array), no el primer commit.

3. **¿Actualmente sería correcto implementar un botón "Eliminar" únicamente en frontend?**
   No, sería incorrecto/inconsistente: como las hipótesis ya están persistidas (checkpointer + `blueprints.state`) antes de que el usuario actúe, un "Eliminar" solo-frontend dejaría el backend con las 11 hipótesis originales tanto en el checkpoint de LangGraph como en la próxima lectura de `GET /blueprint/{id}` (que sirve `bp.state`, no algo derivado del frontend) — la próxima carga de página, u otro consumidor de la API, vería la hipótesis "eliminada" reaparecer.

4. **¿O necesariamente debe eliminar (o marcar) registros persistidos en la BD?**
   No hay "registros" en el sentido relacional (no hay fila por hipótesis), pero sí hay que actualizar el array persistido: cualquier eliminación debe viajar por `POST /blueprint/{id}/resume` con el array de hipótesis ya sin ese elemento, para que `human_hypotheses_node` reemplace `state["hypotheses"]`, eso se checkpointee en LangGraph, y la siguiente `_persist_final` lo refleje en `blueprints.state`. Hoy esa ruta de eliminación (endpoint/servicio explícito) **no existe** — solo existe el mecanismo genérico de "reemplazar el array completo" vía edición de hipótesis.

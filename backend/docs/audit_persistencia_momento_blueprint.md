# Auditoría Técnica: Verificación del Momento de Persistencia del Estado del Blueprint

## Objetivo

Verificar con evidencia técnica el momento exacto en que el estado del Blueprint (incluyendo las hipótesis) se persiste durante el flujo de LangGraph, y confirmar o refutar:

> Las hipótesis ya están persistidas antes de que el usuario vea la pantalla de revisión.

Esta auditoría es de solo lectura (no se modificó código). A diferencia de la auditoría previa (`docs/audit_elimin_hipotesis.md`), aquí se inspeccionó también el código fuente **interno de la librería `langgraph`** instalada en `venv/Lib/site-packages/langgraph/pregel/`, porque la pregunta exige certeza sobre el *timing* exacto del checkpointer, no solo sobre el código de la app.

---

## 1. Flujo completo de ejecución (POST /run → primer interrupt)

Secuencia de llamadas real, con archivo y función:

1. `POST /projects/{project_id}/blueprint/run` → `run_blueprint()` — `app/api/routes/blueprint.py:148`
2. Crea `Blueprint(status="running", state={})`, hace `db.commit()` dos veces (creación + asignación de `thread_id`) — **este commit es de la fila `blueprints`, no contiene aún hipótesis** (`state={}`).
3. Devuelve `EventSourceResponse(_sse(...))` — `app/api/routes/blueprint.py:178`
4. `_sse()` (`app/api/routes/blueprint.py:140`) delega en `event_stream(graph, payload, config)` — `app/api/streaming.py:60`
5. `event_stream()` lanza un hilo (`threading.Thread(target=worker)`) que ejecuta `graph.stream(payload, config=config, stream_mode="updates")` — **API síncrona** de LangGraph (`app/api/streaming.py:70`), y va empujando cada `chunk` a una cola async.
6. Dentro de `graph.stream(...)` (motor Pregel de LangGraph, `SyncPregelLoop`), se ejecutan los nodos en orden topológico por *supersteps*: `supervisor` → (`route_entry`) → `problem` → `customer_segment` → `value_proposition` → `business_model` → `hypotheses` → `human_hypotheses` (interrupt).
7. Al llegar el chunk `{"__interrupt__": [...]}`, `event_stream()` emite el evento SSE `"interrupt"` (`app/api/streaming.py:88-91`) y continúa el bucle — pero el `worker()` ya terminó de iterar `graph.stream(...)` (no hay más chunks), por lo que pone `("end", None)` en la cola (`app/api/streaming.py:75`) y el generador `event_stream()` termina (`break` en `app/api/streaming.py:82`).
8. `_sse()` retoma el control tras el `async for`: `yield _persist_final(config["configurable"]["thread_id"], blueprint_id)` — `app/api/routes/blueprint.py:145`.
9. `_persist_final()` (`app/api/routes/blueprint.py:99`) llama `_project_from_checkpoint(thread_id)` → `graph.get_state(...)` — lee el checkpoint más reciente ya persistido — y hace `db.commit()` sobre `blueprints.state`.

## 2. `hypotheses_node()`: cuándo termina y cuándo se checkpointea

`hypotheses_node` (`app/agents/hypotheses.py:13`) es una función síncrona normal: termina cuando hace `return {"hypotheses": hyps, "messages": [...]}`. No escribe nada a disco por sí misma — es el motor Pregel quien decide cuándo persistir.

**Evidencia del motor (no de la app):** en `venv/Lib/site-packages/langgraph/pregel/_loop.py`, el ciclo de ejecución es:

```python
# _loop.py:592  tick()  -> prepara/ejecuta las tareas del superstep actual
# _loop.py:676  after_tick()
def after_tick(self) -> None:
    writes = [w for t in self.tasks.values() for w in t.writes]
    self.updated_channels = apply_writes(self.checkpoint, self.channels, self.tasks.values(), ...)
    ...
    self._put_checkpoint({"source": "loop"})   # <- línea 706: GUARDA EL CHECKPOINT
    if self.interrupt_after and should_interrupt(...):
        raise GraphInterrupt()
```

`hypotheses_node` corre en un *superstep* propio (el edge `hypotheses -> human_hypotheses` en `app/graph/build_graph.py:93` obliga a que `human_hypotheses` sea programado en el superstep **siguiente**, según el modelo BSP/Pregel). Al terminar ese superstep, `after_tick()` aplica los `writes` del nodo (incluye `hypotheses`) a los canales y **inmediatamente después** llama `_put_checkpoint()`, que dispara la escritura a Postgres.

**Respuesta: sí, el checkpoint que contiene las hipótesis se genera inmediatamente al terminar el superstep de `hypotheses_node`, en un superstep completo ANTES de que `human_hypotheses_node` siquiera comience a ejecutarse** (no antes/durante el propio `hypotheses_node`, sino apenas termina su superstep).

## 3. `interrupt()` dentro de `human_hypotheses_node()`

Código (`app/agents/supervisor.py:100-109`):
```python
def human_hypotheses_node(state: BlueprintState) -> dict:
    edited = interrupt({"type": "review_hypotheses", "hypotheses": state.get("hypotheses", [])})
    ...
```

`interrupt()` (`venv/Lib/site-packages/langgraph/types.py:811`): "the first invocation of this function raises a `GraphInterrupt` exception, halting execution". No es un valor de retorno normal — es una excepción.

**¿Quién la captura?** `PregelRunner.commit()` (`venv/Lib/site-packages/langgraph/pregel/_runner.py:574-591`):
```python
elif exception:
    if isinstance(exception, GraphInterrupt):
        if exception.args[0]:
            writes = [(INTERRUPT, exception.args[0])]
            ...
            self.put_writes()(task.id, writes)
```
La excepción se convierte en un *write* especial de tipo `INTERRUPT` asociado a la tarea (nunca llega a ejecutar el `return` del nodo — por eso `hypotheses` **no cambia** en este punto, solo se registra que `human_hypotheses` quedó pendiente).

**¿Continúa ejecutándose código después?** Dentro del nodo, no — la excepción corta la ejecución en el punto de `interrupt()`; las líneas siguientes de `human_hypotheses_node` (el `if isinstance(edited, dict)...`) **no corren** en esta pasada. Sí continúa el *loop* de Pregel: tras `commit()`, el runner termina la tarea, y `after_tick()` se ejecuta igual (aplica los writes — en este caso solo el marcador `INTERRUPT`, sin cambios de canal — y llama `_put_checkpoint()` de nuevo, esta vez con metadata que indica `next=("human_hypotheses",)`).

**Respuesta:** `interrupt()` detiene solo el nodo (excepción capturada por el runner), pero el *loop* sigue lo suficiente para persistir un checkpoint final que marca el punto de pausa. La ejecución del *grafo* termina ahí (no hay más supersteps hasta el resume).

## 4. Runtime del checkpointer (`runtime.py`, `PostgresSaver`)

`app/graph/runtime.py:67` (`init_graph_postgres`) usa `PostgresSaver.from_conn_string(dsn)` sin pasar `durability` en ningún punto de la app (`grep durability` sobre `app/` → sin resultados). Esto significa que se usa el valor **por defecto de LangGraph**.

Evidencia del default (`venv/Lib/site-packages/langgraph/pregel/main.py:2720`, docstring de `stream()`):
> `durability`: defaults to `"async"`. Options: `"sync"` (persiste antes de que empiece el siguiente step), `"async"` (persiste en paralelo mientras corre el siguiente step), `"exit"` (solo persiste al salir del grafo).

Con `durability="async"` (el default, y el que usa esta app al no overridearlo):
- `_put_checkpoint()` (`_loop.py:1064`) evalúa `do_checkpoint = ... and (exiting or self.durability != "exit")` → **True** en cada superstep (no solo al final), porque `durability != "exit"`.
- El guardado real se despacha así (`_loop.py:1179-1189`):
  ```python
  # save it, without blocking
  # if there's a previous checkpoint save in progress, wait for it
  # ensuring checkpointers receive checkpoints in order
  self._put_checkpoint_fut = self.submit(
      self._checkpointer_put_after_previous,
      getattr(self, "_put_checkpoint_fut", None),
      self.checkpoint_config, copy_checkpoint(self.checkpoint),
      self.checkpoint_metadata, new_versions,
  )
  ```
  Es decir: se **encola** en un `BackgroundExecutor` (thread pool), sin bloquear el avance del loop al siguiente superstep — de ahí "async": la escritura del checkpoint de `hypotheses_node` puede seguir en vuelo mientras `human_hypotheses_node` ya empieza a ejecutar.

**¿Se pierde la garantía por ser asíncrono?** No, porque al finalizar/salir del `stream()` (aquí: en cuanto se agota el generador, sea por interrupt o por fin del grafo), el propio contexto del loop hace `self.stack.__exit__(...)` (`_loop.py:1688-1695`), que cierra el `BackgroundExecutor`. Su `__exit__` (`venv/Lib/site-packages/langgraph/pregel/_executor.py:93-109`) es explícito:
```python
# wait for all tasks to finish
if pending := {t for t in tasks if not t.done()}:
    concurrent.futures.wait(pending)
```
Esto **bloquea hasta que todas las escrituras de checkpoint pendientes (incluida la de `hypotheses`) hayan terminado**, antes de que `graph.stream(...)` termine de iterar. Recién después de eso el hilo `worker()` de `app/api/streaming.py:70-77` llega al `finally` y encola `("end", None)`.

Además, `PostgresSaver` abre su conexión con `autocommit=True` (`venv/Lib/site-packages/langgraph/checkpoint/postgres/__init__.py:77`), así que cada `put()` queda comprometido en la base apenas se ejecuta, sin depender de un `commit()` externo adicional.

**Respuesta:** el checkpointer escribe **al finalizar cada superstep** (no antes, no "durante" en el sentido de a mitad de un nodo, no solo "al finalizar todo el grafo"). Con `durability="async"` (el default en uso), el envío a Postgres se dispara apenas termina el superstep y se **garantiza completado antes de que `graph.stream()` devuelva el control al llamador** (por el `wait()` bloqueante en `BackgroundExecutor.__exit__`).

## 5. Stream SSE: cuándo termina realmente

Secuencia confirmada en `app/api/streaming.py` y `app/api/routes/blueprint.py`:
```
graph.stream(...) agota sus chunks (incluido el chunk "__interrupt__")
   ↓
worker() termina su for-loop → finally → queue.put(("end", None))   [streaming.py:75]
   ↓
event_stream() recibe kind=="end" → break  → el generador async termina [streaming.py:82]
   ↓
_sse(): el "async for ev in event_stream(...)" se agota
   ↓
_sse(): yield _persist_final(...)      [blueprint.py:145]
```

**Confirmado: es la primera secuencia.** `interrupt() → SSE finaliza → _persist_final()`. `_persist_final()` nunca corre antes de que el stream SSE se agote — está fuera y después del `async for`, en la misma función generadora `_sse`.

## 6. `_persist_final()`: quién la invoca, cuándo, condiciones

Función completa: `app/api/routes/blueprint.py:99-137`.

- **Quién la invoca:** únicamente `_sse()`, en la línea `app/api/routes/blueprint.py:145`: `yield _persist_final(config["configurable"]["thread_id"], blueprint_id)`.
- **Desde dónde:** tanto `run_blueprint()` (primer tramo) como `resume_blueprint()` (`app/api/routes/blueprint.py:181-199`) pasan por `_sse()`, así que `_persist_final()` corre tras **cualquier** interrupt o fin de grafo, no solo el de hipótesis.
- **En qué momento:** después de que el generador `event_stream()` se agota (ver punto 5) — es decir, después de que el checkpointer ya escribió y **esperó** (bloqueante) su escritura, según el punto 4.
- **Condiciones:** ninguna condicional — siempre se ejecuta al final de `_sse()`, sin importar si hubo interrupt o el grafo terminó. Dentro, hace `db.get(Blueprint, blueprint_id)`; si `bp` existe, escribe `bp.state` y `bp.status`, y comete (`app/api/routes/blueprint.py:111-117`).

## 7. Momento del primer `commit()` relacionado con hipótesis

Hay que distinguir dos "commits":

**a) Commit del checkpointer de LangGraph** (Postgres, autocommit por conexión — `venv/Lib/site-packages/langgraph/checkpoint/postgres/__init__.py:77`, método `put()` en línea 263): ocurre en `after_tick()` (`_loop.py:706`) apenas termina el superstep de `hypotheses_node`. Esto sucede **dentro** de la llamada a `graph.stream(...)`, **antes** de que el usuario reciba cualquier evento SSE (los chunks se van emitiendo, pero el checkpoint de ese superstep ya se escribió por completo antes incluso de que el chunk de ese nodo llegue a la cola del hilo `worker`, porque `after_tick()` corre sincrónicamente dentro del mismo tick que produce el chunk).

**b) `Session.commit()` explícito de SQLAlchemy** sobre `blueprints.state` (`app/api/routes/blueprint.py:117`, dentro de `_persist_final()`): ocurre **después** de que el stream SSE completo se agotó, es decir, después de que el usuario ya pudo haber recibido el evento `"interrupt"` por SSE — pero el checkpoint de LangGraph (a) ya estaba escrito mucho antes de ese punto.

**Respuesta: ambos commits ocurren antes de que el usuario actúe** (antes del `POST /resume`). El commit (a) del checkpointer incluso ocurre antes de que el usuario **reciba** el evento de revisión por SSE; el commit (b) ocurre justo cuando el stream ya se agotó, muy poco después, pero también antes de cualquier acción del usuario.

## 8. Línea temporal real (trazado)

```
POST /projects/{id}/blueprint/run
   ↓
Blueprint creado (status="running", state={})  — db.commit() (fila vacía, sin hipótesis)
   ↓
graph.stream() arranca en un hilo
   ↓
supervisor → problem → customer_segment → value_proposition → business_model
   ↓
hypotheses_node() retorna {"hypotheses": [...11...]}
   ↓
after_tick() → apply_writes() → _put_checkpoint()
   → checkpointer.put() a Postgres (autocommit=True)   ← PRIMER COMMIT CON HIPÓTESIS
   → BackgroundExecutor espera su futuro si el loop termina/sale
   ↓
human_hypotheses_node() arranca (superstep siguiente) → interrupt(...)
   ↓
GraphInterrupt capturada en PregelRunner.commit() → put_writes(INTERRUPT) → Postgres
   ↓
after_tick() de este superstep → _put_checkpoint() (metadata: next=["human_hypotheses"])
   ↓
graph.stream() no tiene más chunks → generador se agota
   ↓
worker() → queue.put(("end", None))
   ↓
event_stream() → break (generador async se agota)
   ↓
_sse(): "async for" termina → yield _persist_final(thread_id, blueprint_id)
   ↓
_persist_final(): graph.get_state() lee el checkpoint YA escrito (con hipótesis)
   ↓
db.commit() sobre blueprints.state (status="awaiting_input")  ← SEGUNDO COMMIT CON HIPÓTESIS
   ↓
Evento SSE "done"/"awaiting_input" llega al frontend (contiene las hipótesis en su payload)
   ↓
Usuario VE la pantalla de revisión (las hipótesis YA estaban en Postgres en dos lugares)
   ↓
Usuario edita/acepta → POST /blueprint/{id}/resume
```

No hay ninguna variante del flujo real en la que `_persist_final()` corra antes de que el checkpoint de LangGraph exista — `_persist_final()` **lee** ese checkpoint (`_project_from_checkpoint` → `graph.get_state(...)`), así que depende estructuralmente de que ya exista.

---

## Tabla de verificación

| Pregunta | Resultado | Evidencia |
|---|---|---|
| ¿El checkpoint ocurre antes del interrupt? | **Sí** | El checkpoint con `hypotheses` se escribe en `after_tick()` (`_loop.py:706`) al cerrar el superstep de `hypotheses_node`, un superstep completo antes de que `human_hypotheses_node` (donde vive el `interrupt()`) siquiera empiece a ejecutar. |
| ¿El checkpoint ocurre antes de que el usuario vea las hipótesis? | **Sí** | El usuario solo puede verlas vía el evento SSE `"interrupt"` o `GET /blueprint/{id}`; ambos dependen de que el checkpoint (o su proyección) ya exista. El checkpoint se escribe y su futuro se espera (`BackgroundExecutor.__exit__`, `_executor.py:106-107`) antes de que el stream SSE se agote. |
| ¿`_persist_final()` ocurre antes del `POST /resume`? | **Sí** | `_persist_final()` corre al final de `_sse()` (`blueprint.py:145`), dentro de la respuesta HTTP del propio `POST /run` — es decir, antes de que exista siquiera la posibilidad de un `POST /resume` (que es una llamada HTTP posterior y separada). |
| ¿`blueprints.state` ya contiene las hipótesis antes de la revisión? | **Sí** | `_persist_final()` lee `graph.get_state()` (que ya incluye `hypotheses`) y hace `bp.state = blueprint; db.commit()` (`blueprint.py:115-117`) antes de que el endpoint `run` termine de responder. |
| ¿Existe alguna ventana donde solo el checkpoint tenga el estado (y `blueprints.state` no)? | **Sí, pero acotada y sin relevancia para el usuario** | Entre el commit del checkpointer (a) y el `db.commit()` de `_persist_final()` (b) hay una ventana de milisegundos *dentro* de la misma llamada `_sse()`, antes de que el endpoint HTTP `POST /run` devuelva su respuesta. El usuario no puede observar esa ventana porque el SSE aún no ha entregado el evento final. Ver sección 9. |
| ¿El primer `Session.commit()` (SQLAlchemy) ocurre antes de que el usuario actúe? | **Sí** | Ocurre dentro de `_persist_final()`, ejecutado como parte de la misma petición `POST /run` que generó las hipótesis — antes de que el usuario pueda emitir un `POST /resume`. |

---

## 9. Estado del Blueprint: ¿ventana entre checkpoint y `blueprints.state`?

Sí existe una ventana, pero es interna al propio ciclo de una sola petición HTTP, no una ventana expuesta al usuario:

- **Duración:** desde que `after_tick()` completa el checkpoint de `hypotheses_node` (y luego el del interrupt) hasta que `_persist_final()` ejecuta `db.commit()` — todo dentro de la ejecución de `_sse()`/`run_blueprint()`, del orden de milisegundos (el tiempo que tarda en agotarse el resto del `async for` y llamar a `_project_from_checkpoint`).
- **Cuándo desaparece:** en cuanto `_persist_final()` hace `db.commit()`, dentro de la misma petición `POST /run` — **antes** de que la respuesta HTTP/SSE se dé por completada hacia el cliente.
- **Quién sincroniza:** `_persist_final()` es la única función que sincroniza ambas capas, y lo hace de forma unidireccional (lee el checkpoint, escribe la proyección) — nunca al revés. El propio código lo declara explícitamente como una "proyección NO autoritativa" (`app/api/routes/blueprint.py:44-49`), y existe un mecanismo de verificación (`shadow_read_check()`, `blueprint.py:59-96`, y `tests/test_shadow_read.py`) precisamente para detectar divergencias entre ambas capas si `_persist_final()` fallara.
- **Importante:** esta ventana **no** es la ventana "antes de que el usuario revise" mencionada en el objetivo de la auditoría — el usuario no puede ver las hipótesis hasta que la respuesta SSE se complete, y para ese momento ambas capas (checkpoint y `blueprints.state`) ya están sincronizadas.

## 10. Fuente de verdad durante el interrupt

**Respuesta: D) Depende del momento del flujo, con matiz — durante el interrupt en reposo (esperando al usuario), la respuesta correcta y consciente del propio código es (A) el checkpoint de LangGraph, con (B) como copia derivada.**

Evidencia textual explícita del propio repo (`app/api/routes/blueprint.py:44-49`, docstring de `_project_from_checkpoint`):
> "El checkpointer es la única fuente de verdad del estado vivo de ejecución [...]; `blueprints.state` es una proyección NO autoritativa derivada de aquí."

Esto es coherente con lo hallado en el motor: cualquier reanudación (`resume_blueprint()`) opera exclusivamente sobre `graph` (el checkpointer), nunca lee `blueprints.state` para decidir cómo continuar (`app/api/routes/blueprint.py:191-199`, usa `get_graph()` + `Command(resume=...)`). `blueprints.state` solo sirve para servir `GET /blueprint/{id}` sin tener que ir al checkpointer en cada lectura.

Mientras el sistema está estable esperando al usuario (después de que `_persist_final()` corrió), ambas capas tienen el mismo contenido — de ahí que (C) "ambas" también sea una respuesta válida en ese instante puntual, pero la relación de autoridad/dirección de sincronización es siempre A → B, nunca B → A.

---

## Conclusión Técnica

1. **¿Las hipótesis ya están persistidas cuando el usuario comienza la revisión?**
   Sí, con certeza. Tanto el checkpoint de LangGraph (Postgres, autocommit, con espera bloqueante garantizada al salir del `stream()`) como la proyección `blueprints.state` (vía `_persist_final()`) ya contienen las 11 hipótesis antes de que la petición HTTP `POST /run` termine de responder — es decir, antes de que el frontend pueda siquiera mostrar la pantalla de revisión.

2. **¿Esa persistencia existe únicamente en el checkpoint de LangGraph o también en `blueprints.state`?**
   En ambos. El checkpoint de LangGraph es la fuente de verdad autoritativa (según lo documenta el propio código); `blueprints.state` es una proyección derivada, pero también queda escrita en Postgres antes de que el usuario actúe, dentro de la misma petición.

3. **¿El sistema implementa realmente un modelo de "Snapshot Persistido del Estado"?**
   Sí. Cada superstep del grafo genera un snapshot completo de todos los canales (incluido `hypotheses`) que se persiste en Postgres vía el checkpointer; `blueprints.state` es, a su vez, un snapshot completo (no incremental — "sobreescritura completa, sin merge incremental", según el propio docstring de `_project_from_checkpoint`) derivado del checkpoint más reciente.

4. **¿Puede afirmarse con certeza que NO corresponde al Caso 1 (borrador temporal)?**
   Sí. El Caso 1 exige que las hipótesis "NO existan todavía en la base de datos" y que "solo cuando confirma la revisión se persisten". Ambas condiciones son falsas: existen en Postgres (dos capas) antes de la confirmación, y la confirmación del usuario no es el evento que dispara el primer guardado.

5. **¿Puede afirmarse con certeza que tampoco corresponde al Caso 2 (CRUD de hipótesis)?**
   Sí. El Caso 2, tal como está descrito, implica una tabla propia con filas por hipótesis, donde "editar" es un `UPDATE` de registro y "eliminar" es un `DELETE`/soft-delete de fila. Eso no existe: no hay tabla `hypotheses`, no hay modelo ORM `Hypothesis`, y toda escritura (generación, edición) reemplaza el array completo dentro de un blob JSON — nunca opera sobre una fila individual.

6. **¿Existe alguna evidencia que contradiga estas conclusiones?**
   No se halló ninguna. Toda la evidencia — código de la app y código interno de `langgraph` (`_loop.py`, `_runner.py`, `_executor.py`, `checkpoint/postgres/__init__.py`) — es consistente entre sí y apunta a la misma secuencia: generación → checkpoint (LangGraph) → interrupt → fin del stream → proyección (`blueprints.state`) → recién entonces, revisión del usuario. El único matiz real es la ventana interna de milisegundos entre las dos escrituras de Postgres (sección 9), que no es observable por el usuario y no afecta ninguna de las conclusiones anteriores.

**Implicación para la futura funcionalidad "Eliminar hipótesis" (sin proponer solución, solo constatando el hecho técnico):** dado que las hipótesis ya están persistidas en dos capas de Postgres antes de que el usuario las vea, cualquier eliminación tendrá que modificar el array persistido (vía el mismo mecanismo de reemplazo completo usado por la edición: `POST /resume` → `human_hypotheses_node` → nuevo checkpoint → nueva proyección) — no puede limitarse a un cambio de estado temporal en el frontend, porque el estado "temporal" tal como lo plantea el Caso 1 no existe en este sistema.

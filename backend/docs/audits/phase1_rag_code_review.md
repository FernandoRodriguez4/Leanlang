# Fase 1 — Code Review Final

> **Rol:** revisión puntual (no auditoría, no rediseño, no implementación de correcciones).
> **Fecha:** 2026-07-04
> **Fuente de verdad:** `docs/audits/backend_architecture_audit_pre_rag.md`,
> `docs/audits/backend_architecture_evolution_validation.md`,
> `docs/audits/phase1_rag_low_risk_fixes.md`.
> **Alcance:** verificar que la implementación reportada en `phase1_rag_low_risk_fixes.md`
> cumple exactamente lo aprobado. No se reevaluó la arquitectura ni se propusieron mejoras.

---

## 1. Revisión de `prune_messages()`

**Archivo:** `app/agents/base.py:16-25`.

```python
def prune_messages(messages: list[BaseMessage], *, window: int) -> list[RemoveMessage]:
    if len(messages) <= window:
        return []
    return [RemoveMessage(id=m.id) for m in messages[:-window] if m.id is not None]
```

Verificado punto por punto:

| Verificación | Resultado |
|---|---|
| Usa `RemoveMessage` correctamente | ✅ — `RemoveMessage(id=...)` es la forma correcta de marcar borrado para el reducer `add_messages` (`langgraph/graph/message.py`: un `RemoveMessage` con `id` existente en el estado previo lo elimina del merge). |
| Respeta el reducer `add_messages` | ✅ — identifica por `id`, no reescribe contenido; probado con 25 mensajes con `id` y `window=20`: elimina exactamente los 5 más antiguos (`ids '0'..'4'`), deja los últimos 20. Con una lista por debajo de la ventana, no genera nada (`[]`), confirmando que es no-op cuando no hace falta podar. |
| No rompe el historial persistido | ✅ — los IDs podados siempre provienen de `state.get("messages", [])`, es decir, del mismo `left` que usará el reducer al mezclar el `write` del nodo. Por diseño de `add_messages`, un `RemoveMessage` solo falla (`ValueError`) si su `id` **no** existe en `left`; aquí siempre existe, porque se lee del propio estado de entrada. No se observó ni es esperable el error "Attempting to delete a message with an ID that doesn't exist". |
| No elimina mensajes incorrectos | ✅ — solo los más antiguos que exceden `window` (`messages[:-window]`), verificado por índice en la prueba anterior. |
| Únicamente limita el crecimiento de `messages` | ✅ en aislamiento — la función no toca ningún otro campo del estado ni reescribe contenido. |
| No modifica `BlueprintState` | ✅ — `app/schemas/state.py` sin diff; sigue siendo `messages: Annotated[list, add_messages]`. |
| No modifica artefactos ni decisiones | ✅ — los 5 call sites (`app/agents/supervisor.py`) solo añaden `pruned` a la clave `"messages"` de su dict de retorno; los demás campos (`hypotheses`, `prioritization`, `revision_count`) no se tocan. |
| No modifica prompts | ✅ — `app/agents/prompts/__init__.py` sin diff; `supervisor.py` no invoca LLM. |
| Ningún agente depende de mensajes eliminados | ✅ para los 14 Lean Agents — ninguno lee `state["messages"]` como entrada (confirman ambos documentos de auditoría/validación: `messages` no se reinyecta a los prompts). Grep sobre `app/agents/*.py` confirma que cada agente solo **escribe** a `"messages"` vía `trace(...)`, nunca lo lee. |

**Riesgo de regresión encontrado (fuera del propio `prune_messages()`, en su integración):**

El riesgo no está en la función en sí, sino en el **orden** en que sus resultados se combinan en
los 5 call sites y cómo eso interactúa con el puente de streaming SSE:

- En los 5 nodos modificados (`app/agents/supervisor.py:20, 50, 62, 64, 74, 76, 84`), el patrón es
  siempre `"messages": [trace(...), *pruned]` — el mensaje de traza **primero**, los
  `RemoveMessage` de poda **después**.
- `app/api/streaming.py:39-44` (`_trace_text`) construye el texto que se envía por SSE tomando
  **el último elemento** del `update["messages"]` que devuelve el nodo (`stream_mode="updates"`
  entrega el `write` crudo del nodo, no el estado ya reducido):
  ```python
  msgs = update.get("messages") ...
  last = msgs[-1]
  return getattr(last, "content", None) or (...)
  ```
- Cuando `pruned` no está vacío (se excedió `messages_window=20`), `msgs[-1]` es un
  `RemoveMessage`, no el `AIMessage` de `trace()`. `RemoveMessage.content` es `""` (cadena vacía,
  heredada de `BaseMessage`), que es *falsy*, así que la expresión `or (...)` cae al segundo
  operando; como `last` no es un `dict`, el resultado final es `None`.
- **Reproducido:** con `update = {"messages": [trace("bump_revision", "..."), *prune_messages(25_msgs, window=20)]}`,
  `_trace_text(update)` devuelve `None` en vez del texto de la traza.

**Efecto:** el evento SSE `agent_update` para ese nodo llega al frontend con `"trace": null` en
vez del texto real (p. ej. "Re-disenando experimentos segun feedback del critico."), exactamente
en los momentos en que la poda se activa — es decir, cuando el bucle del crítico itera (más
probable ahora que `MAX_REVISIONS=2`) o cuando un HITL ocurre tarde en una corrida larga. No
afecta al estado persistido, al checkpointer, ni a los artefactos (`serialize_blueprint` los lee
de campos separados, no de `messages`), pero sí degrada la señal visible en el streaming
exactamente en los nodos de orquestación/revisión, que son los que más interesa mostrar al
usuario.

- **No cubierto por la suite existente:** no hay ningún test sobre `app/api/streaming.py`
  (`_trace_text` / `event_stream`); los 47 tests reportados como "passed" en
  `phase1_rag_low_risk_fixes.md` no ejercitan este camino, por lo que no lo habrían detectado.

---

## 2. Revisión de `blueprint_test`

**Lo que ocurrió exactamente:** al ejecutar `pytest tests/ -q`, el fixture `_reset_test_schema`
(`tests/conftest.py`) intentó conectarse a una base `blueprint_test` que no existía en este
Postgres local, y falló con `FATAL: no existe la base de datos "blueprint_test"` en las 47 pruebas.
Para poder correr la suite, se ejecutó un comando puntual (`psycopg`, conectado como superusuario a
la base `postgres`) que hizo `CREATE DATABASE blueprint_test` — nada más.

Verificado contra el repositorio:

| Pregunta | Resultado |
|---|---|
| ¿Se modificó el repositorio? | **No.** `git status` (raíz del repo, `C:/Users/NATALI/Leanlang`) no muestra ningún archivo nuevo ni modificado por esta acción; el único cambio de estado ocurrió en el catálogo del servidor PostgreSQL local (`CREATE DATABASE`), que no es parte del árbol de git. |
| ¿Se añadieron scripts nuevos? | **No.** `backend/scripts/` aparece como *untracked* en `git status`, pero su contenido (`scripts/benchmark/monitor.py`, `scripts/benchmark/phase0_baseline.py`, con fecha `2026-07-04 01:16-01:18`) ya existía **antes** de que empezara esta fase de trabajo (aparecía como `??` en el `gitStatus` inicial de la conversación, previo a cualquier cambio). No se creó ni modificó ningún archivo dentro de `scripts/` en esta revisión ni en la Fase 1. |
| ¿Se cambiaron archivos de configuración (`tests/conftest.py`, `alembic.ini`, `.env`)? | **No.** `git diff --stat -- tests conftest.py alembic.ini` no devuelve diferencias; estos archivos no fueron tocados. |
| ¿Se creó una migración nueva? | **No.** La suite corre `alembic upgrade head` contra el esquema ya existente en el repo (`tests/conftest.py:187-198`); no se generó ningún archivo nuevo bajo `alembic/versions`. |

**Conclusión del punto 2:** el cambio fue **exclusivamente de entorno local** (una base de datos
Postgres vacía, creada una sola vez para que el fixture de sesión pudiera reconstruir el esquema
vía Alembic, tal como está diseñado). No quedó persistido nada dentro del proyecto/repositorio; es
un prerrequisito de infraestructura local (equivalente a tener Postgres corriendo), no un cambio de
código ni de configuración versionada.

---

## 3. Riesgos encontrados

| # | Riesgo | Severidad | Evidencia |
|:--:|---|:--:|---|
| 1 | Orden `[trace(...), *pruned]` en los 5 nodos de orquestación hace que `_trace_text` (`app/api/streaming.py:39-44`) devuelva `None` en vez del texto de traza cuando la poda se activa (ventana excedida). Afecta solo el campo `trace` del evento SSE `agent_update`; no afecta estado, checkpointer ni artefactos. | Media (UX/observabilidad del streaming, no de datos) | `app/agents/supervisor.py:20,50,62,64,74,76,84` + `app/api/streaming.py:39-44` |
| 2 | Ese camino (`_trace_text`/`event_stream`) no tiene cobertura de tests; la suite verde (47/47) no ejercita este caso y por tanto no lo detecta. | Baja-Media (gap de cobertura, no un defecto nuevo introducido por la falta de test) | Ausencia de referencias a `streaming` en `tests/` |
| 3 | `blueprint_test` — sin riesgo: cambio confinado al entorno local, sin persistencia en el repositorio. | Ninguno | `git status` / `git diff --stat` en la raíz del repo |

No se encontraron riesgos relacionados con `BlueprintState`, el Checkpointer, `blueprints.state`,
los prompts, o los 14 Lean Agents — ninguno fue tocado por la Fase 1, consistente con lo reportado.

---

## 4. Veredicto de esta revisión (previo al hotfix)

**No se aprobó el cierre completo de la Fase 1 tal cual.** `prune_messages()` en sí misma es
correcta y cumple el contrato aprobado (poda por conteo, respeta `add_messages`, sin resúmenes por
LLM, sin tocar `BlueprintState`/artefactos/prompts/agentes). `blueprint_test` es, en efecto,
únicamente un cambio de entorno local, sin impacto en el repositorio.

Sin embargo, se detectó una **regresión real y reproducible** en la integración entre la poda de
`messages` y el puente de streaming SSE (`app/api/streaming.py:_trace_text`), causada por el orden
de retorno `[trace(...), *pruned]` en `app/agents/supervisor.py`. Esta regresión no estaba
contemplada en `phase1_rag_low_risk_fixes.md` ni cubierta por la suite de tests, y se manifiesta
precisamente en los nodos de orquestación/revisión que la Fase 1 tenía que dejar intactos desde la
perspectiva del usuario final (el texto de traza que ve durante el bucle del crítico o los HITL).

Conforme a las instrucciones de ese ejercicio, no se implementó ninguna corrección en ese momento
— se dejó documentada con evidencia de archivo y línea. La corrección se aplicó en la Fase 1.1,
documentada en la sección siguiente.

---

## 5. Fase 1.1 — Hotfix de integración

### 5.1 Causa del problema

`app/api/streaming.py:_trace_text` (antes de este hotfix) asumía que el **último elemento** de
`update["messages"]` — el write crudo que devuelve un nodo bajo `stream_mode="updates"` — era
siempre un mensaje de traza válido:

```python
last = msgs[-1]
return getattr(last, "content", None) or (last.get("content") if isinstance(last, dict) else None)
```

Esa suposición se rompió cuando `prune_messages()` (Fase 1, aprobada y correcta en sí misma) entró
en juego: los 5 nodos de orquestación en `app/agents/supervisor.py` devuelven
`"messages": [trace(...), *pruned]`, así que en cuanto la ventana (`messages_window=20`) se excede,
el último elemento de esa lista es un `RemoveMessage` (contenido `""`, sin texto de traza). Como
`RemoveMessage` no es un `dict`, la expresión completa evaluaba a `None`, y el evento SSE
`agent_update` llegaba al frontend con `"trace": null` en vez del texto real, justo en los nodos
del bucle del crítico o los HITL tardíos — exactamente cuando la poda se activa.

### 5.2 Corrección aplicada

Cambio **único**, confinado a `app/api/streaming.py` (no se tocó `prune_messages()`, ni el orden
de retorno en `app/agents/supervisor.py`, ni la política de poda aprobada):

```python
def _trace_text(update: dict[str, Any]) -> str | None:
    """Texto de la ultima traza real de un write de nodo.

    Ignora `RemoveMessage` (poda de `messages` por conteo, ver app/agents/base.py:prune_messages):
    no llevan contenido y no deben interpretarse como la traza del nodo.
    """
    msgs = update.get("messages") if isinstance(update, dict) else None
    if not msgs:
        return None
    for m in reversed(msgs):
        if isinstance(m, RemoveMessage):
            continue
        content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else None)
        if content:
            return content
    return None
```

En vez de asumir que el último elemento es la traza, recorre `msgs` en reversa e ignora cualquier
`RemoveMessage`, devolviendo el contenido del primer mensaje real que encuentra desde el final. Se
agregó el import `from langchain_core.messages import RemoveMessage` en el mismo archivo. Ningún
otro archivo fue modificado para este hotfix.

### 5.3 Verificaciones realizadas

- **Streaming vuelve a mostrar la traza correctamente:** reproducido el caso exacto de la
  regresión (25 mensajes con `id`, ventana 20 → 5 `RemoveMessage` de poda) y confirmado que
  `_trace_text` devuelve `"Re-disenando experimentos segun feedback del critico."` en vez de
  `None`.
- **La poda sigue funcionando igual:** `prune_messages()` no se modificó; se re-verificó que con
  25 mensajes y ventana 20 sigue generando exactamente 5 `RemoveMessage` para los ids más
  antiguos (`'0'..'4'`).
- **`RemoveMessage` sigue respetando el reducer `add_messages`:** se ejecutó
  `add_messages(left, [nuevo_trace, *pruned])` con `left` de 25 mensajes — el resultado tiene 21
  mensajes (los últimos 20 + el nuevo), confirmando que el reducer sigue mezclando/eliminando por
  `id` sin cambios de comportamiento.
- **Casos borde de `_trace_text`:** sin poda (devuelve el texto normal), `messages` vacío o
  ausente (devuelve `None`, sin excepción), y una lista compuesta **solo** por `RemoveMessage`
  (devuelve `None` en vez de lanzar error, caso defensivo que no ocurre en la práctica pero no
  rompe nada).
- **Prueba de integración añadida:** `tests/test_streaming.py` (4 tests) cubre exactamente el caso
  de esta regresión (`test_trace_text_skips_remove_messages_from_pruning`) más los casos borde
  anteriores, para que una futura regresión similar quede atrapada por la suite.
- **Suite completa:** `pytest tests/ -q` → **51 passed** (47 previos + 4 nuevos de
  `test_streaming.py`), sin fallos ni skips.
- **Confirmación de alcance:** `git diff --stat -- app/api/streaming.py` → 1 archivo, 14
  inserciones / 2 eliminaciones. No se tocó `BlueprintState`, el Checkpointer, `blueprints.state`,
  ningún agente, ningún prompt, ni `MAX_REVISIONS`/`messages_window`.

### 5.4 Confirmación de cierre de la Fase 1

Con este hotfix, la única regresión detectada en la revisión final queda corregida, verificada y
cubierta por una prueba dedicada, sin reabrir ni modificar ninguna de las decisiones aprobadas de
la Fase 1 (poda por conteo sin resumen LLM, `MAX_REVISIONS=2` externalizado, fallback del
checkpointer con warning + `degraded`, docstring y `.env.example` documentados).

**La Fase 1 (incluyendo el hotfix 1.1) queda completamente cerrada y lista para iniciar la Fase 2**
(reclasificación de `blueprints.state` como proyección de lectura derivada, según
`docs/audits/backend_architecture_evolution_validation.md` §7).

# Validación Técnica de la Evolución Arquitectónica — Backend Leanlang (Post-Auditoría)

> **Rol:** Principal Software Architect / Staff Engineer
> **Alcance:** validación de la *estrategia de evolución*, no re-auditoría. **No** se implementó código.
> **Fecha:** 2026-07-04
> **Documento base:** `docs/audits/backend_architecture_audit_pre_rag.md`
> **Objeto:** decidir si las 5 soluciones propuestas son técnicamente correctas, si existe alternativa
> mejor, qué riesgos introducen y en qué orden implementarlas antes de RAG.

## Convenciones

Veredicto por propuesta:

| Símbolo | Significado |
|:---:|---|
| ✅ **APROBAR** | La propuesta es la mejor práctica o suficientemente correcta; implementar tal cual. |
| 🟡 **APROBAR CON AJUSTES** | La dirección es correcta pero hay que modificar el alcance o la secuencia. |
| 🔴 **NO IMPLEMENTAR (aún)** | Introduce sobreingeniería o riesgo no justificado; posponer o descartar. |

Cada afirmación de código está anclada a `archivo:línea` verificada en esta validación.

---

## 1. Resumen Ejecutivo

Las cinco propuestas son **técnicamente viables** y ninguna exige rediseño. Sin embargo, **dos de ellas
contienen sobreingeniería** que conviene recortar antes de implementar, y **una interacción de riesgo no
considerada** debe resolverse antes de tocar la fuente de verdad del estado.

**Veredicto global de la estrategia: 🟡 Aprobada con ajustes.** El sistema estará listo para RAG tras
ejecutar las Fases 1–3 del roadmap, pero **no** debe implementarse la evolución del estado (Punto 2) ni la
política de `messages` (Punto 4) tal como están redactadas.

**Prerrequisito transversal — Fase 0 (Benchmark y Línea Base):** antes de tocar código en la Fase 1 se
establece una **línea base reproducible** del sistema actual (latencias p95/p99, throughput, tokens/run,
tamaño de `BlueprintState`, acumulación de `messages`, utilización del pool y concurrencia soportada), sin
modificar código ni arquitectura. Esta medición es la que permite **atribuir causalidad** a cada mejora
posterior y respaldar con evidencia —no con intuición— las decisiones ya aprobadas, en particular la del
Punto 3 (mantener el saver síncrono hasta que las métricas justifiquen `AsyncPostgresSaver`). Sin esta
referencia, el impacto de las fases siguientes no sería demostrable objetivamente (detalle en §7, Fase 0).

| # | Propuesta | Veredicto | Ajuste central |
|:--:|---|:--:|---|
| 1 | Catálogo: JSON → PG-SQL → Knowledge Service (SQL + pgvector) | 🟡 | **Eliminar la fase intermedia "catálogo en PG-SQL"**: es sobreingeniería para 44 ítems. Ir de JSON directo a Knowledge Service dual (exacto en memoria + semántico en pgvector). |
| 2 | Fuente única de verdad: checkpointer vivo, relacional = dominio | 🟡 | **No eliminar `blueprints.state`**: degradarlo a *proyección de lectura* derivada, no a fuente competidora. Requiere cerrar antes el fallback silencioso (R4). |
| 3 | Saver síncrono: mantener hasta que las métricas justifiquen AsyncSaver | ✅ | Correcto. No migrar ahora. Es la decisión de ingeniería adecuada. |
| 4 | `messages`: máx. 20, resumen automático, conservar 10 | 🟡 | **Descartar el resumen automático por LLM.** `messages` **no** se reinyecta a los prompts; sólo alimenta streaming/almacenamiento. La solución correcta es podar por conteo, no resumir. |
| 5 | `MAX_REVISIONS = 1 → 2` | ✅ | Correcto como valor. Ajuste menor: externalizarlo a `config` y observar coste real. |

**Riesgo crítico no considerado en las propuestas:** el fallback silencioso a `MemorySaver`
(`runtime.py:64-66`; además `get_graph()` arranca **por defecto en memoria**, `runtime.py:25-27`) convierte
al Punto 2 en peligroso: si se elimina `blueprints.state` y el checkpointer cae a memoria sin alarma, se
pierde **toda** persistencia de dominio. **La secuencia importa: cerrar R4 antes que el Punto 2.**

---

## 2. Evaluación de cada propuesta

### Punto 1 — Evolución del Catálogo · 🟡 APROBAR CON AJUSTES

**Propuesta:** Fase 1 JSON+memoria (actual) → Fase 2 Catálogo en PostgreSQL (índices + SQL) → Fase 3
Knowledge Service (SQL para estructurado + pgvector para semántico).

**¿Es correcta?** La dirección final es correcta; **la fase intermedia no**.

- **[HECHO]** Hoy el catálogo es un filtro en Python puro sobre un JSON cacheado con `@lru_cache`
  (`app/catalog/service.py:19-68`), O(44), sin dependencia de BD — propiedad que los tests aprovechan
  (`service.py:2-5`). La tabla `experiments` en Postgres existe pero **es un espejo que ningún agente
  consulta** (auditoría §4.4).
- **Migrar 44 ítems a SQL con índices (Fase 2 propuesta) no aporta valor medible:** O(44) en memoria ya es
  óptimo, y añadir una consulta SQL introduce latencia de red, una dependencia de BD para una operación que
  hoy funciona sin ella, y **duplica** la lógica de filtrado/orden (`service.py:53-67`) en SQL. Es un paso
  de coste sin retorno — precisamente la sobreingeniería que las restricciones piden evitar.

**Alternativa mejor (recomendada):** colapsar a **dos fases**.

- **Fase A (conservar):** `query_experiments` exacto sobre JSON en memoria. Es la mejor práctica para un
  catálogo curado y pequeño; su determinismo total y explicabilidad son un *feature*, no deuda.
- **Fase B (añadir):** `semantic_search(query, top_k)` sobre **pgvector**, sólo cuando el corpus supere lo
  curado. Ambos modos conviven detrás del mismo *Knowledge Service* (la evolución natural de
  `catalog/service.py`, ya aislado como única "tool" del sistema).

**¿SQL y pgvector conviviendo?** Sí, pero **no** SQL como capa de acceso al catálogo de 44. La convivencia
correcta es: **filtro exacto (memoria/JSON) para anclar `experiment_id` del catálogo** + **pgvector para
recuperar conocimiento no catalogado**. Son complementarios (auditoría §7.5). SQL relacional entra sólo si
el corpus vectorizado necesita *metadata filtering* junto a la búsqueda ANN — y eso pgvector ya lo resuelve
con columnas normales + índice HNSW en la misma tabla.

**¿Cambiaría el orden?** Sí: **eliminar la fase "catálogo en PG-SQL"**. El orden queda JSON exacto → (cuando
el producto lo exija) añadir pgvector semántico.

**Riesgos que introduce la versión ajustada:**
- pgvector exige extensión Postgres + proveedor de embeddings en `config` (nuevo eje de coste/latencia).
- La búsqueda semántica es **aproximada**; **no** debe alimentar el *anclaje de ids*. La salvaguarda
  determinista del Experiment Design (descarte de ids fuera de `allowed_ids`,
  `experiment_design.py:100-107`) **debe permanecer intacta**: pgvector *enriquece*, nunca *sustituye* el
  grounding en código.

**Impacto sobre LangGraph / BlueprintState / agentes / workflow:** nulo estructuralmente. Sólo el
`experiment_design` (1/14 agentes) gana un segundo modo de recuperación. El estado, el checkpointer, la
topología y los otros 13 agentes no cambian.

**¿La implementaría así?** Con el ajuste: sí. Sin el ajuste (fase PG-SQL intermedia): no.

---

### Punto 2 — Fuente Única de Verdad · 🟡 APROBAR CON AJUSTES

**Propuesta:** checkpointer = única fuente del estado vivo; base relacional = persistencia del dominio;
**eliminar** la duplicación de snapshots.

**¿Es la mejor práctica?** El principio es correcto (el checkpointer es la autoridad del estado de
ejecución). Pero **"eliminar el snapshot" es la conclusión equivocada.**

- **[HECHO]** Hoy `GET /blueprint/{id}` y `list` leen de `blueprints.state` (JSONB), **no** del checkpointer
  (`blueprint.py:119-138`). `blueprints.state` se escribe al final/interrupt vía `_persist_final`
  (`blueprint.py:39-55`).
- Eliminar `blueprints.state` obliga a que **cada lectura del API deserialice el checkpoint** de LangGraph
  (`graph.get_state(...)`), acoplando la capa de lectura a los internals del checkpointer, encareciendo el
  `GET` (reconstrucción de estado vs. lectura de una fila) y rompiéndose si en el futuro se **poda** el
  checkpointer para housekeeping (auditoría §6, eje A).

**Alternativa mejor (recomendada) — CQRS-lite:** no eliminar, **reclasificar**.

- **Checkpointer** = única fuente de verdad del **estado vivo de ejecución** (autoridad para `resume`,
  recuperación, `route_*`). ✅ como propone.
- **`blueprints.state`** = **proyección de lectura derivada** (read model), explícitamente no-autoritativa,
  actualizada transaccionalmente en cada checkpoint relevante (fin/interrupt). Sirve al `GET` sin tocar el
  checkpointer y sobrevive a la poda de checkpoints.

Esto elimina la **ambigüedad** ("¿cuál manda?") sin perder el desacople de lectura. La duplicación deja de
ser un riesgo cuando una de las dos fuentes se declara *derivada* y se escribe en la misma transacción.

**¿Existe riesgo? ¿Puede romper el workflow?**
- La escritura de la proyección hoy **no es transaccional respecto al checkpoint**: `_persist_final` abre su
  propia `SessionLocal` (`blueprint.py:47-52`) y el checkpointer escribe por separado → ventana de
  divergencia si una falla (R2). El ajuste debe cerrar esto (escribir la proyección en el mismo commit o
  reconstruirla siempre desde el checkpointer bajo demanda con caché).
- **Interacción crítica no considerada (bloqueante para este punto):** el checkpointer **cae a memoria en
  silencio** ante fallo de Postgres (`runtime.py:64-66`) y `get_graph()` **arranca en memoria por defecto**
  (`runtime.py:25-27`). Si se elimina `blueprints.state` y el saver está en memoria, un reinicio **borra
  todo** sin traza de dominio. **Por tanto: cerrar R4 (fallback ruidoso + health-check) ANTES de degradar la
  proyección.**

**¿Cómo migrarlo de forma seguro?**
1. Convertir el fallback silencioso en warning + estado *degraded* del health-check (P0 de la auditoría).
2. Hacer que la escritura de `blueprints.state` sea idempotente y derivada (reconstruible desde el
   checkpointer), documentándola como read model.
3. Mantener ambos en paralelo un periodo, comparando (shadow-read) que la proyección coincide con
   `graph.get_state(...)`; sólo entonces confiar en la proyección para el `GET`.

**Impacto sobre LangGraph / agentes / workflow:** ninguno sobre la ejecución del grafo (es ortogonal). El
impacto es en la **capa API de lectura** y en la garantía de consistencia. No afecta a BlueprintState ni a
los agentes.

**¿La implementaría así?** Con el ajuste (proyección derivada, no eliminación) y tras cerrar R4: sí.

---

### Punto 3 — Saver Síncrono · ✅ APROBAR

**Propuesta:** mantener `PostgresSaver` síncrono mientras no haya cuello de botella; ejecutar pruebas de
carga; migrar a `AsyncPostgresSaver` sólo si las métricas lo justifican.

**¿Es la estrategia correcta?** **Sí, sin reservas.** Es exactamente la decisión de ingeniería adecuada:
optimizar bajo evidencia, no por anticipación.

- **[HECHO]** El diseño actual ya mitiga el bloqueo: `graph.stream(...)` corre en un **worker thread** que
  empuja a una `asyncio.Queue` (`streaming.py:52-64`), de modo que el saver síncrono **no bloquea el event
  loop** de FastAPI en el camino normal. El cuello potencial es de **concurrencia agregada** (threads +
  conexiones del pool), no de bloqueo del loop.
- Migrar a `AsyncPostgresSaver` **ahora** sería prematuro y **no gratis**: exige pasar la invocación del
  grafo a `astream`, rediseñar el puente de streaming (hoy construido explícitamente sobre thread + cola
  precisamente por el saver síncrono) y revalidar el `search_path` y el pool. Coste alto, beneficio no
  demostrado.

**¿Conviene migrar ahora? ¿O esperar a pruebas de carga?** Esperar. Migrar sólo si las pruebas de carga
muestran saturación atribuible al saver (p. ej. p99 de latencia creciente con concurrencia, agotamiento del
`pool_size=5, max_overflow=10` de `session.py`). **Antes** de migrar el saver, la palanca más barata es
**dimensionar el pool de conexiones**, que probablemente resuelva el 80% del problema sin tocar la
arquitectura async.

**Riesgos:** ninguno por mantenerlo. El único riesgo es **no medir**: la estrategia sólo es válida si las
pruebas de carga se ejecutan de verdad (con LangSmith/métricas de pool como fuente).

**Impacto:** nulo mientras no se migre.

**¿La implementaría así?** Sí, tal cual. Es la mejor práctica.

---

### Punto 4 — Política para `messages` · 🟡 APROBAR CON AJUSTES

**Propuesta:** máx. 20 mensajes → resumen automático → conservar los últimos 10; mantener artifacts,
decisions y summaries separados; el LLM recibiría summary + últimos mensajes + artifacts + estado.

**¿Es una política estable?** El objetivo (acotar el crecimiento monótono de `messages`) es correcto, pero
**la propuesta parte de una premisa falsa** y por eso introduce complejidad innecesaria.

- **[HECHO] `messages` NO se reinyecta a los prompts de los agentes.** Los agentes construyen su contexto
  con `jdump(...)` de **artefactos concretos** del estado (`base.py:16-18`), no con el historial de mensajes.
  `messages` sólo se usa para: (a) el **texto de streaming** SSE (`streaming.py:39-44`, `_trace_text` lee el
  último) y (b) **observabilidad/almacenamiento**. La propia auditoría lo confirma (§4.6): *"`messages` crece
  sin cota pero no se reinyecta a los prompts... afecta almacenamiento y payload de streaming, no el tamaño
  del prompt de cada agente."*
- **Consecuencia:** generar un **resumen automático por LLM** de `messages` **no reduce ningún prompt de
  agente** (no lo consumen) — sólo añade una llamada LLM extra, coste, latencia y una nueva superficie de
  fallo, para resumir una traza que nadie lee como contexto. Es sobreingeniería.
- **Riesgo técnico adicional del resumen:** `messages` usa el reducer `add_messages` (`state.py:47`), que
  identifica mensajes por `id`. Podar/reemplazar correctamente exige emitir `RemoveMessage(id=...)`; un
  "resumen que sustituye" mal implementado puede **romper el reducer** o duplicar historial. Cuanto menos se
  manipule ese canal, mejor.

**Política mejor (recomendada) — poda simple, sin LLM:**
- **Acotar por conteo** los mensajes de traza (p. ej. conservar los últimos N con `RemoveMessage`, o no
  acumular más allá de una ventana). No hace falta resumen porque el valor de `messages` es la **traza en
  vivo**, no memoria semántica.
- **La "memoria" real ya está separada y es la correcta:** los artefactos (`problem`, `recommendations`,
  `decisions`, `report`, …) viven en campos propios de `BlueprintState` (`state.py:24-39`) con semántica
  *last-write-wins*, y son los que se inyectan a los prompts. La propuesta de "mantener artifacts/decisions
  separados" **ya está implementada por diseño** — no hay que hacer nada ahí.
- Si en el futuro se quisiera **memoria conversacional** que sí se reinyecte (p. ej. un agente coach con
  RAG), *entonces* un resumen tendría sentido — pero es una necesidad de RAG (Fase 4), no de hoy.

**¿Puede afectar el comportamiento del workflow / romper LangGraph o los agentes?**
- La **poda por conteo** es de bajo riesgo si se hace con `RemoveMessage` y respetando el reducer.
- El **resumen automático** sí puede afectar: llamada LLM extra en el camino crítico, no determinista (choca
  con la temperatura 0.2 y la reproducibilidad que el sistema cuida), y manipulación del canal `messages`.
  **Por eso se descarta.**

**Impacto sobre BlueprintState / agentes:** con la versión ajustada (poda), impacto casi nulo — los agentes
no dependen de `messages`. Con la versión original (resumen), impacto medio y riesgo de regresión.

**¿La implementaría así?** No. Implementaría **sólo la poda por conteo** y **omitiría el resumen automático**
mientras `messages` no alimente ningún prompt.

---

### Punto 5 — `MAX_REVISIONS` · ✅ APROBAR (con ajuste menor)

**Propuesta:** `MAX_REVISIONS = 1 → 2`.

**¿Es el valor adecuado?** Sí. `2` es un buen equilibrio.

- **[HECHO]** Hoy `MAX_REVISIONS = 1` (`supervisor.py:14`): el crítico sólo puede forzar **una** corrección,
  lo que puede ser agresivo si un diseño necesita 2 iteraciones (auditoría §4.5).
- **Coste de subir a 2:** cada revisión re-ejecuta el sub-bucle `bump_revision → experiment_design →
  metrics → success_criteria → decision → sequencing → plan_estimate → critic` (build_graph, bucle del
  crítico). Es **~6 nodos LLM adicionales** en el peor caso por revisión extra. Pasar de 1 a 2 **duplica el
  techo** de ese coste/latencia. Es asumible y acotado (no es un bucle abierto: el contador lo limita,
  `supervisor.py:45-50`).
- **¿Otro valor?** `≥3` no se justifica: rendimientos decrecientes de calidad frente a coste/latencia
  crecientes; si tras 2 correcciones el crítico no aprueba, el problema es de prompt o de diseño, no de más
  iteraciones. `2` es el óptimo calidad/coste/latencia.

**Ajuste menor recomendado:** externalizar `MAX_REVISIONS` a `app/core/config.py` (hoy es una constante en
`supervisor.py:14`) para poder tunearlo por entorno sin tocar código, y **observar en LangSmith** cuántos
runs realmente alcanzan la 2.ª revisión antes de fijarlo definitivamente.

**Riesgos:** bajos — mayor coste/latencia acotado. Ninguno estructural.

**Impacto sobre workflow:** el bucle del crítico puede iterar una vez más; el resto igual.

**¿La implementaría así?** Sí, con el valor `2` y externalizado a config.

---

## 3. Riesgos

| # | Riesgo | Origen | Impacto | Prioridad |
|:--:|---|---|---|:--:|
| RV1 | **Eliminar `blueprints.state` con fallback silencioso a memoria activo → pérdida total de dominio en un reinicio.** | Interacción Punto 2 × R4 (`runtime.py:25-27,64-66`) | Alto | **Crítica — bloquea el Punto 2** |
| RV2 | Fase intermedia "catálogo en PG-SQL" → duplica lógica de filtro en SQL, añade dependencia de BD y latencia sin beneficio para 44 ítems. | Punto 1 | Medio (coste/deuda) | Alta |
| RV3 | Resumen automático de `messages` por LLM → coste/latencia extra, no determinismo, riesgo de romper el reducer `add_messages`, sin reducir ningún prompt (no se reinyecta). | Punto 4 | Medio | Alta |
| RV4 | pgvector alimentando el anclaje de ids → reintroduce alucinación que hoy el grounding en código evita. | Punto 1 / Fase 4 | Alto (a futuro) | Media |
| RV5 | Escritura de la proyección no transaccional respecto al checkpoint → ventana de divergencia (R2 heredado). | Punto 2 | Medio | Media |
| RV6 | `MAX_REVISIONS=2` duplica el techo de coste del sub-bucle del crítico sin medición previa. | Punto 5 | Bajo | Baja |
| RV7 | Estrategia del saver síncrono sólo válida si las pruebas de carga se ejecutan de verdad. | Punto 3 | Bajo | Baja |

**Riesgo importante NO considerado en las propuestas:** **RV1** (secuencia Punto 2 × R4). Las propuestas
tratan la fuente única de verdad y el fallback silencioso como temas separados; **son un único riesgo
acoplado** y el orden de implementación es lo que lo neutraliza.

---

## 4. Recomendaciones

1. **Reordenar el Punto 1:** eliminar la fase "catálogo en PostgreSQL-SQL". Ir de JSON exacto (conservar) a
   Knowledge Service dual (exacto en memoria + `semantic_search` en pgvector) sólo cuando el corpus crezca.
2. **Reclasificar, no eliminar, en el Punto 2:** checkpointer = fuente de verdad del estado vivo;
   `blueprints.state` = **proyección de lectura derivada** y transaccional. Es CQRS-lite, no duplicación.
3. **Cerrar R4 antes que el Punto 2:** convertir el fallback a memoria en warning + health-check *degraded*;
   evaluar que `get_graph()` no arranque silenciosamente en memoria en producción.
4. **Reemplazar el resumen de `messages` por poda por conteo** (con `RemoveMessage`, respetando
   `add_messages`). No añadir llamadas LLM para resumir una traza que ningún prompt consume.
5. **Mantener el saver síncrono** y, como primera palanca de escala, **dimensionar el pool** de
   `session.py` (`pool_size`/`max_overflow`) antes de considerar `AsyncPostgresSaver`.
6. **`MAX_REVISIONS = 2`, externalizado a `config`**, observando en LangSmith la frecuencia real de 2.ª
   revisión.
7. **Preservar el grounding determinista** del Experiment Design (`allowed_ids`) cuando entre pgvector:
   semántico *enriquece*, exacto *ancla*.

---

## 5. Ajustes sugeridos (resumen accionable)

| Propuesta original | Ajuste sugerido |
|---|---|
| Catálogo en 3 fases con PG-SQL intermedio | **2 fases:** JSON exacto (conservar) → + pgvector semántico. Sin capa SQL para el catálogo de 44. |
| Eliminar snapshots duplicados | **Degradar `blueprints.state` a proyección derivada**, no eliminar. Escritura transaccional. |
| Saver síncrono → esperar métricas | **Sin cambios.** Añadir: dimensionar pool primero. |
| `messages`: máx 20 + resumen LLM + últimos 10 | **Sólo poda por conteo** (ventana N con `RemoveMessage`). **Sin resumen LLM.** Artifacts/decisions ya están separados por diseño. |
| `MAX_REVISIONS = 2` | **`= 2` pero en `config`**, con observación de frecuencia real. |

---

## 6. Veredicto Técnico

Respuesta explícita a las 5 preguntas de validación final:

| # | Pregunta | Veredicto |
|:--:|---|---|
| 1 | ¿Las soluciones propuestas son técnicamente viables? | **Sí, las cinco.** Ninguna exige rediseño; tres se implementan casi tal cual (3, 5 y 1 con recorte), dos requieren ajuste de alcance (2 y 4). |
| 2 | ¿Existe alguna que no recomendarías implementar? | **Sí, dos matices:** (a) la fase "catálogo en PG-SQL" del Punto 1 — **no implementar**; (b) el **resumen automático por LLM** del Punto 4 — **no implementar**. El resto de cada propuesta sí. |
| 3 | ¿Existe algún riesgo importante no considerado? | **Sí: RV1** — eliminar `blueprints.state` mientras el checkpointer puede caer a memoria en silencio (R4) causa pérdida total de dominio. Es la interacción Punto 2 × R4, no contemplada por separado en las propuestas. |
| 4 | ¿Falta algún cambio antes de comenzar RAG? | **Sí, tres previos:** (a) cerrar R4 (fallback ruidoso + health-check); (b) definir el Knowledge Service como interfaz dual sobre `catalog/service.py`; (c) añadir a `config` proveedor/modelo de embeddings y parámetros de recuperación. La extensión pgvector y el diseño del corpus son parte ya de la Fase 4. |
| 5 | ¿La arquitectura seguiría siendo consistente tras aplicar estas mejoras? | **Sí.** Con los ajustes, el estado, el checkpointer, la observabilidad, la salida estructurada y 13/14 agentes permanecen intactos. La consistencia mejora (fuente de verdad desambiguada, `messages` acotado) sin introducir componentes innecesarios. |

**Conclusión:** la estrategia de evolución es **sólida y alineada con la arquitectura actual**. Aprobada con
los ajustes de los Puntos 1, 2 y 4. El sistema queda **listo para iniciar RAG** tras completar las Fases
1–3 del roadmap. Se evita explícitamente la sobreingeniería (capa SQL para 44 ítems, resumen LLM de una
traza no consumida) y se respeta lo que **ya es mejor práctica** (grounding en código, saver síncrono con
worker thread, separación de artefactos en el estado).

---

## 7. Roadmap por Fases

### Fase 0 — Benchmark y Línea Base (sin modificar código)

**Objetivo:** medir el comportamiento actual del backend **sin tocar el código ni la arquitectura**, para
obtener una **línea base reproducible** con la que comparar objetivamente el impacto de cada mejora
posterior (poda de `messages`, reclasificación de `blueprints.state`, ajuste de `MAX_REVISIONS`, Knowledge
Service y, a futuro, pgvector). Sirve tanto para validar técnicamente los cambios como para respaldar los
resultados de la tesis.

> **Prerrequisito de método:** esta fase es **puramente observacional**. No añade instrumentación al código
> de la aplicación. Todas las métricas se obtienen de fuentes **ya existentes** o **externas al proceso**
> (LangSmith, `pg_stat_activity`, métricas de SO, y un cliente de carga contra los endpoints SSE). Si una
> métrica exigiese modificar código para medirse, se documenta como *no disponible sin instrumentación* y se
> pospone — no se implementa aquí.

**Métricas a registrar (mínimo):**

| Métrica | Fuente sin tocar código |
|---|---|
| Latencia promedio por ejecución | Cliente de carga contra `POST /projects/{id}/blueprint/run` (SSE) — tiempo `started` → `done`. |
| Latencia p95 y p99 | Distribución del cliente de carga (agregación de la muestra). |
| Throughput (ejecuciones/min) | Cliente de carga (runs completados / tiempo). |
| Tiempo de checkpoint | LangSmith (span del saver) y/o `pg_stat_statements` sobre las tablas del esquema `langgraph`. |
| Tiempo de recuperación desde checkpoint | Cliente: tiempo del `POST /blueprint/{id}/resume` → primer evento (rehidratación vía `graph.get_state`). |
| Consumo de memoria del proceso | Monitor de SO externo (p. ej. `psutil`/`docker stats` sobre el PID de Uvicorn). |
| Consumo de CPU | Ídem, monitor de SO externo. |
| Tokens promedio por ejecución | **LangSmith** (ya instrumentado; metadata provider/model/tokens por run). |
| Mensajes acumulados en `messages` | Lectura del estado final vía `graph.get_state(...)` o del `blueprints.state` persistido (conteo, sin modificar código). |
| Tamaño promedio del BlueprintState | Tamaño serializado de `blueprints.state` (JSONB) por run — consulta de sólo lectura. |
| Utilización del pool PostgreSQL | `pg_stat_activity` (conexiones activas/idle) durante la carga; contraste con `pool_size=5, max_overflow=10` (`session.py`). |
| Tiempo de espera del pool (si disponible) | Logs de SQLAlchemy / métricas del engine si están expuestas; si no lo están, marcar *no disponible sin instrumentación*. |
| Concurrencia sin degradación significativa | Nivel de concurrencia a partir del cual p95/p99 se disparan en las pruebas. |

**Pruebas (línea base reproducible, no prueba extrema):** ejecutar cargas controladas a **1, 5, 10 y 20
usuarios concurrentes** contra el flujo real de blueprint (run + resume de los 3 interrupts HITL). El
objetivo es una curva base estable y repetible, no encontrar el punto de rotura. Fijar semilla de escenario
(misma `raw_idea`/`constraints`) para reducir varianza; la temperatura 0.2 del sistema ya favorece la
reproducibilidad.

> **Salvedad de método (HITL):** el grafo tiene 3 `interrupt` human-in-the-loop (`supervisor.py:54-80`). La
> carga debe automatizar el `resume` con payload fijo (p. ej. `{"accepted": true}`) para medir de extremo a
> extremo sin intervención manual. Documentar el payload usado como parte del escenario.

**Evidencias:** guardar todas las métricas crudas y agregadas (por nivel de concurrencia), la configuración
del entorno (versión de commit, DSN/pool, proveedor/modelo LLM, si el saver fue Postgres o memoria) y el
escenario. El informe de resultados debe indicar **explícitamente** que estos valores corresponden al
**estado inicial del sistema** y serán la referencia de comparación de las fases siguientes.

**Beneficio:** permite responder con evidencia — no con intuición — preguntas como: ¿la latencia mejoró o
empeoró?, ¿bajó el consumo de memoria?, ¿aumentó la concurrencia soportada?, ¿cambió el tiempo de
recuperación?, ¿se redujo el uso de tokens?, ¿cada mejora arquitectónica tuvo impacto **medible**? En
particular, da respaldo cuantitativo a las decisiones ya aprobadas: la poda de `messages` (Fase 1), la
reclasificación de `blueprints.state` (Fase 2) y la estrategia del saver síncrono (Punto 3), que
**depende** de estas métricas para justificar —o descartar— la migración a `AsyncPostgresSaver`.

*Riesgo: nulo. No modifica código, arquitectura ni datos; sólo observa. Es condición previa recomendada
para poder atribuir causalidad a los cambios de las fases siguientes.*

### Fase 1 — Correcciones de bajo riesgo (no tocan la arquitectura)

- Actualizar el docstring desactualizado de `build_graph.py:6-12` (R6).
- Documentar variables `LANGSMITH_*` en `.env.example`.
- **Convertir el fallback silencioso a memoria en warning explícito + health-check *degraded*** (R4).
  *Prerrequisito de la Fase 2.*
- Externalizar `MAX_REVISIONS` a `config` y fijarlo en `2`.
- Podar `messages` por conteo (ventana N con `RemoveMessage`) — **sin** resumen LLM.

*Riesgo: bajo. No modifica estado, persistencia ni topología.*

### Fase 2 — Mejoras arquitectónicas (persistencia / estado / rendimiento)

- Reclasificar `blueprints.state` como **proyección de lectura derivada** y hacer su escritura
  transaccional/idempotente respecto al checkpoint (cierra R2). *Depende de que la Fase 1 haya cerrado R4.*
- Shadow-read: validar que la proyección coincide con `graph.get_state(...)` antes de confiar en ella para
  el `GET`.
- Dimensionar el pool de conexiones (`session.py`). Ejecutar **pruebas de carga** y decidir sobre el saver
  con datos (probablemente mantenerlo).

*Riesgo: medio, acotado. No cambia BlueprintState ni los agentes.*

### Fase 3 — Preparación para RAG (dejar listo el Knowledge Service)

- Formalizar `app/catalog/service.py` como **Knowledge Service** con interfaz dual: `query_experiments`
  (exacto, se conserva) + firma para `semantic_search(query, top_k)` (aún sin backend).
- Añadir a `config` proveedor/modelo de embeddings y parámetros de recuperación (top_k, umbral).
- Habilitar la extensión `pgvector` en Postgres y definir el esquema de la tabla de conocimiento
  (columnas de metadata + columna `vector` + índice HNSW/IVFFlat), **sin** poblarla aún.

*Riesgo: bajo. Adiciones aisladas; no toca el grafo ni los otros agentes.*

### Fase 4 — Implementación de RAG (sólo componentes a desarrollar; no implementar aquí)

Componentes que comenzarían a desarrollarse:

- **Pipeline de ingestión/embeddings** del corpus (catálogo + conocimiento no catalogado del libro/casos).
- **`semantic_search`** sobre pgvector dentro del Knowledge Service, instrumentado con `@traceable`.
- **Integración en el `experiment_design`** como modo de *enriquecimiento* — preservando el anclaje
  determinista de ids (`allowed_ids`) como salvaguarda anti-alucinación.
- (Opcional) **Nuevo agente knowledge/coach** que consuma RAG; sería el único caso que justificaría un
  resumen conversacional reinyectable.

*Regla invariante: pgvector enriquece, el catálogo exacto ancla. La búsqueda semántica nunca sustituye el
grounding en código.*

---

*Documento de validación de estrategia. No se modificó, refactorizó ni ejecutó código de la aplicación.*

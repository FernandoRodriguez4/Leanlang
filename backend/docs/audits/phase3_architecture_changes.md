# Fase 3 — Cambios Arquitectónicos Aprobados (respecto al Roadmap Original)

> **Rol:** Registro de trazabilidad de decisiones.
> **Fecha:** 2026-07-05
> **Fuente de verdad comparada:** `docs/audits/backend_architecture_evolution_validation.md` (§7,
> "Fase 3 — Preparación para RAG") vs. el Contrato de Implementación de la Fase 3 aprobado en esta
> conversación.
> **Alcance de este documento:** registrar únicamente los cambios de alcance aprobados antes de
> implementar. No se modificó la auditoría, no se modificó el roadmap principal, no se implementó
> código, no se analizó código fuente.

---

## 1. Eliminación de la creación de la tabla de conocimiento en Fase 3

### Cambio
- **Roadmap original:** "Habilitar la extensión `pgvector` en Postgres y definir el esquema de la
  tabla de conocimiento (columnas de metadata + columna `vector` + índice HNSW/IVFFlat), **sin**
  poblarla aún."
- **Contrato aprobado:** no se define ni se crea ninguna tabla de conocimiento en la Fase 3. Su
  definición física se traslada íntegramente a la Fase 4.

### Motivo
- Reducción de sobreingeniería: definir el esquema de una tabla sin proveedor de embeddings
  seleccionado obliga a fijar decisiones (dimensión, columnas de metadata) que aún no tienen base.
- Mantener independencia del proveedor de embeddings hasta que exista una decisión definitiva.
- Minimizar riesgo de tener que rehacer el esquema físico una vez elegido el proveedor real.

### Impacto
- El componente "tabla de conocimiento" se mueve completamente de Fase 3 a Fase 4.
- No hay impacto sobre `app/db/models.py`, `experiments`, ni el esquema `langgraph`.

### Estado
**Diferido a Fase 4.**

---

## 2. Eliminación del modelo ORM de conocimiento

### Cambio
- **Roadmap original:** implícito en la definición del esquema de la tabla de conocimiento (una
  tabla nueva normalmente requiere su modelo ORM correspondiente en `app/db/models.py`).
- **Contrato aprobado:** no se añade ningún modelo ORM nuevo en `app/db/models.py` durante la
  Fase 3.

### Motivo
- Consecuencia directa del cambio 1: sin tabla definida, no hay modelo ORM que mapear.
- Minimizar riesgo: evita introducir un modelo que tendría que modificarse o descartarse en cuanto
  se fije la dimensión del vector en Fase 4.

### Impacto
- `app/db/models.py` queda **sin modificar** en la Fase 3 (a diferencia de lo previsto en una
  versión anterior del contrato).

### Estado
**Diferido a Fase 4.**

---

## 3. Eliminación de la dimensión fija del vector

### Cambio
- **Roadmap original:** no especificaba una dimensión; una versión intermedia del contrato de
  implementación había propuesto fijar un valor provisional (p. ej. 1536) para poder declarar la
  columna `vector` en el esquema.
- **Contrato aprobado:** no se fija ninguna dimensión de vector en la Fase 3. La columna `vector` no
  se crea hasta que el proveedor de embeddings quede seleccionado.

### Motivo
- Mantener independencia del proveedor de embeddings: la dimensión del vector depende
  directamente del modelo de embeddings elegido, decisión que el roadmap explícitamente reserva
  para más adelante.
- Evitar una decisión irreversible o costosa de deshacer (cambiar la dimensión de una columna
  `vector` ya poblada requeriría una migración destructiva).

### Impacto
- No hay columna `vector` ni tabla en Fase 3; por tanto no hay dimensión que fijar ni migrar
  después.

### Estado
**Diferido a Fase 4.**

---

## 4. `semantic_search` pasa de stub (`NotImplementedError`) a contrato (`Protocol`)

### Cambio
- **Roadmap original:** "formalizar `app/catalog/service.py` como Knowledge Service con interfaz
  dual: `query_experiments` (exacto, se conserva) + firma para `semantic_search(query, top_k)` (aún
  sin backend)."
- **Contrato aprobado (evolución en dos pasos):**
  1. Primera versión del contrato: `semantic_search` como función invocable que levanta
     `NotImplementedError`.
  2. Versión final aprobada: `semantic_search` declarado únicamente como método de un
     `typing.Protocol` — sin cuerpo ejecutable, sin instanciación, sin `NotImplementedError`. El
     tipo de retorno se generaliza a `Sequence[Any]` (o `Iterable[Any]`) en vez de una estructura
     concreta, para no acoplar la interfaz a un diseño de datos que aún no existe.

### Motivo
- Reducción de sobreingeniería: un stub que levanta `NotImplementedError` es código ejecutable con
  una ruta de fallo real; un `Protocol` es puramente un contrato de tipado, sin superficie de
  ejecución ni riesgo de ser invocado accidentalmente en runtime.
- Mantener compatibilidad futura: un tipo de retorno flexible (`Sequence[Any]`) evita que la firma
  quede acoplada a una estructura de datos (p. ej. un schema `KnowledgeChunk`) que todavía no está
  definida y que se diseñará en Fase 4 junto con la tabla.

### Impacto
- `app/catalog/service.py` gana únicamente una declaración de tipos (`Protocol`); ninguna función
  existente (`query_experiments`, `get_experiment`, `get_pairings`) cambia de comportamiento.
- No se introduce ninguna ruta de código que pueda fallar en runtime.

### Estado
**Se implementará en Fase 3** (como contrato de tipos únicamente).

---

## 5. El paquete Python `pgvector` se difiere a la Fase 4

### Cambio
- **Roadmap original:** no mencionaba explícitamente el paquete Python `pgvector`; se infería
  necesario para declarar una columna `Vector` en el ORM.
- **Contrato aprobado:** el paquete `pgvector` (integración SQLAlchemy) **no** se añade a
  `requirements.txt` en la Fase 3. Su incorporación, junto con la verificación de compatibilidad
  con la versión actual de SQLAlchemy y el driver PostgreSQL del proyecto, queda diferida a la
  Fase 4, cuando exista una tabla y columna `vector` reales que lo requieran.

### Motivo
- Consecuencia directa de los cambios 1–3: sin tabla ni columna `vector`, no hay uso real del tipo
  `Vector` de SQLAlchemy que justifique la dependencia.
- Minimizar riesgo: evita incorporar una dependencia nueva sin una superficie de código que la
  ejerza, y evita tener que revalidar su compatibilidad dos veces si el driver o la versión de
  SQLAlchemy cambiaran antes de la Fase 4.

### Impacto
- `requirements.txt` queda **sin modificar** en la Fase 3.

### Estado
**Diferido a Fase 4.**

---

## 6. La migración queda reducida únicamente a habilitar la extensión `pgvector`

### Cambio
- **Roadmap original:** habilitar la extensión `pgvector` **y** definir el esquema de la tabla de
  conocimiento (metadata + columna `vector` + índice HNSW/IVFFlat) en la misma fase.
- **Contrato aprobado:** la migración de la Fase 3 se limita exclusivamente a
  `CREATE EXTENSION IF NOT EXISTS vector;`. No crea tablas, no crea índices, no modifica tablas de
  dominio existentes, no modifica el esquema `langgraph`, no modifica `experiments`.

### Motivo
- Reducción de sobreingeniería: separar "habilitar la capacidad a nivel de servidor" de "modelar el
  esquema de datos" permite avanzar la infraestructura sin comprometerse a un diseño de tabla que
  depende de una decisión (proveedor de embeddings) aún no tomada.
- Respetar la arquitectura existente: mantiene el mismo criterio ya aplicado en la migración
  inicial (`82c106cacc45_initial_schema.py`) de no mezclar cambios de subsistemas distintos en una
  sola migración.
- Minimizar riesgo: una migración de una sola operación, idempotente (`IF NOT EXISTS`), es trivial
  de razonar y de revertir.

### Impacto
- Nueva migración Alembic aislada, sin dependencias sobre `experiments` ni sobre el esquema
  `langgraph` del checkpointer.
- El diseño del esquema de la tabla de conocimiento (columnas, dimensión, índice) se mueve
  íntegramente a una migración de la Fase 4.

### Estado
**Se implementará en Fase 3** (únicamente `CREATE EXTENSION IF NOT EXISTS vector;`).

---

## 7. El `downgrade` pasa a ser un `no-op` documentado

### Cambio
- **Enfoque por defecto (convención previa del repo):** un `downgrade()` simétrico normalmente
  revertiría la operación del `upgrade()` (aquí, `DROP EXTENSION vector;`).
- **Contrato aprobado:** el `downgrade()` de esta migración **no** ejecuta `DROP EXTENSION`. Queda
  como un no-op explícitamente documentado en el propio archivo de migración, dejando constancia de
  que el rollback de la extensión se difiere hasta que existan objetos reales (tabla, columnas,
  índices) que dependan de ella.

### Motivo
- Minimizar riesgo: si una migración futura de la Fase 4 crea una tabla con columna `vector` y
  alguien revierte esta migración de la Fase 3 sin darse cuenta del orden de dependencias, un
  `DROP EXTENSION` rompería esa migración posterior. Un no-op elimina esa clase de fallo por
  construcción.
- Mismo criterio ya usado en la migración inicial del repo, que tampoco elimina el esquema
  `langgraph` en su `downgrade()` por la misma razón (no arrastrar el ciclo de vida de un
  subsistema ajeno).

### Impacto
- El archivo de migración de la Fase 3 documenta explícitamente, en un comentario, por qué el
  `downgrade()` no revierte la extensión.

### Estado
**Se implementará en Fase 3.**

---

## 8. Se congela la interfaz pública del Knowledge Service para garantizar compatibilidad con la Fase 4

### Cambio
- **Roadmap original:** no especificaba una política de estabilidad de la interfaz; solo pedía
  "dejar lista" la firma de `semantic_search`.
- **Contrato aprobado:** se añade una cláusula explícita: la firma pública del `Protocol` definida
  en la Fase 3 (`query_experiments` + `semantic_search`) debe mantenerse compatible durante la
  implementación de la Fase 4. La **implementación** interna de `semantic_search` podrá cambiar
  libremente en Fase 4; la **interfaz** pública no debe romperse sin pasar de nuevo por aprobación
  explícita.

### Motivo
- Mantener compatibilidad futura: evita que otros componentes que empiecen a depender del
  `Protocol` durante la Fase 4 se vean afectados por cambios de firma no controlados.
- Respetar la arquitectura existente: es el mismo principio ya aplicado en el resto del sistema
  (p. ej. `app/catalog/service.py` como único punto de extensión aislado, según la auditoría
  §7.2) — se preserva la estabilidad del punto de extensión mientras evoluciona su implementación.

### Impacto
- No introduce ningún componente nuevo; es una restricción de proceso sobre cómo debe evolucionar
  el `Protocol` en la Fase 4.

### Estado
**Aprobado** (cláusula de gobierno para la Fase 4; no requiere código en la Fase 3).

---

## Resumen de trazabilidad

| # | Cambio | Estado |
|:--:|---|---|
| 1 | Tabla de conocimiento | Diferido a Fase 4 |
| 2 | Modelo ORM de conocimiento | Diferido a Fase 4 |
| 3 | Dimensión fija del vector | Diferido a Fase 4 |
| 4 | `semantic_search`: stub → `Protocol` | Se implementará en Fase 3 |
| 5 | Paquete `pgvector` | Diferido a Fase 4 |
| 6 | Migración reducida a `CREATE EXTENSION` | Se implementará en Fase 3 |
| 7 | `downgrade` como no-op documentado | Se implementará en Fase 3 |
| 8 | Congelamiento de la interfaz pública | Aprobado (gobierno de Fase 4) |

**Conclusión:** el alcance ejecutable de la Fase 3 queda reducido a tres cambios de código
(`app/catalog/service.py`, `app/core/config.py`, `.env.example`) y una migración de una sola
operación. Todo lo que dependía de una decisión aún no tomada (proveedor de embeddings, dimensión,
esquema físico de la tabla de conocimiento) se traslada explícitamente a la Fase 4, sin alterar el
roadmap original ni la auditoría — este documento únicamente dejar constancia de los ajustes de
alcance aprobados durante la revisión técnica de esta conversación.

---

*Documento de trazabilidad de decisiones. No se modificó la auditoría, no se modificó el roadmap
principal, no se implementó código.*

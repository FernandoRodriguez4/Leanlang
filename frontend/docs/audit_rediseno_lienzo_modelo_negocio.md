# Auditoría Técnica — Impacto del Rediseño del Lienzo Lean y Modelo de Negocio

> **Naturaleza de esta tarea:** auditoría de solo lectura. No se modificó código, prompts, agentes, LangGraph, contratos ni UI. Todo lo aquí afirmado está respaldado con `archivo:línea`.
> **Fecha:** 2026-07-11

---

## Resumen ejecutivo (TL;DR)

1. **La premisa de partida ya no se cumple.** La UI **no** muestra "grandes bloques de texto": ya renderiza **tarjetas con chips campo por campo** (`components/LienzoPanel.tsx`). El rediseño no parte de cero.
2. **El contrato Backend→Frontend es JSON tipado y estructurado**, no markdown ni texto libre. Cada sección es un objeto Pydantic con campos discretos (`schemas/lean.py` → `lib/types.ts`).
3. **La generación de contenido y la presentación ya están separadas.** Los agentes producen datos; la UI decide cómo mostrarlos. La lógica de negocio **no** depende de cómo se ve.
4. **Conclusión central:** un rediseño puramente visual (resúmenes, acordeones, tarjetas, slides, pestañas, vista ejecutiva/completa, progressive disclosure) **NO afecta a los agentes, ni al grafo, ni al contrato**, siempre que se mantengan los nombres de campo del JSON. **Riesgo: Muy Bajo.**
5. **El único acoplamiento fuerte es de nombres** (claves de campo, enums, IDs de join, nombres de nodo). El rediseño no los toca; sólo importa si además se cambia el backend.

---

## 1. Inventario de agentes

El grafo (`app/graph/build_graph.py:47-116`) tiene 19 nodos. El estado compartido es `BlueprintState` (`TypedDict`, `app/schemas/state.py:9-57`). Patrón común de los agentes Lean: leen contexto del estado → inyectan `research_context(state)` (`agents/base.py:33-41`) → invocan `get_structured_model(<Schema>)` → serializan con `.model_dump(mode="json")`.

### Agentes que construyen el Lienzo y el Modelo de Negocio (foco de esta auditoría)

| # | Agente | Archivo | Nodo | Produce (schema) | Consume |
|---|--------|---------|------|------------------|---------|
| 1 | **Problem** | `agents/problem.py:13-25` | `problem` | `Problem` (`schemas/lean.py:12-19`) | `raw_idea` + research |
| 2 | **Customer Segment** | `agents/customer_segment.py:13-26` | `customer_segment` | `CustomerSegment` (`lean.py:22-29`) | `raw_idea`, `problem` |
| 3 | **Value Proposition** | `agents/value_proposition.py:13-30` | `value_proposition` | `ValueProposition` (`lean.py:32-39`) | `raw_idea`, `problem`, `customer_segment` |
| 4 | **Business Model** | `agents/business_model.py:13-30` | `business_model` | `BusinessModel` (`lean.py:42-54`) | `raw_idea`, `customer_segment`, `value_proposition` |
| 5 | **Hypotheses** | `agents/hypotheses.py:13-33` | `hypotheses` | `HypothesisList` (`schemas/hypothesis.py:26`) | todo el lienzo |
| 6 | **Research (Tavily)** | `agents/research.py:35-66` | `research` | `ResearchReport` (`schemas/research.py:33-46`) | `research_plan.queries` |
| 7 | **Supervisor / triaje** | `agents/supervisor.py:35-62` | `supervisor` | `ResearchPlan` (`research.py:10-14`) | `raw_idea` + estado |

### Campos exactos que produce cada artefacto (el "qué genera")

- **`Problem`** → `statement`, `context` *(str)* · `root_causes`, `customer_jobs`, `pains` *(list[str])*
- **`CustomerSegment`** → `name`, `description`, `early_adopters` *(str)* · `characteristics`, `gains` *(list[str])*
- **`ValueProposition`** → `statement`, `differentiator` *(str)* · `products_services`, `pain_relievers`, `gain_creators` *(list[str])*
- **`BusinessModel`** → **7 bloques, todos `list[str]`:** `key_partners`, `key_activities`, `key_resources`, `channels`, `customer_relationships`, `revenue_streams`, `cost_structure`

### Agentes del resto del pipeline (contexto, no foco del rediseño)

`risk` → `classifications`+`prioritization` · `experiment_design` → `recommendations` · `metrics` → `metric_specs` · `success_criteria` → `success_criteria`+`test_cards` · `decision` → `decisions` · `sequencing` → `validation_roadmap` · `plan_estimate` → `plan_estimate` · `critic` → `critic_review` · `report` → `report`. (Todos con schema Pydantic tipado, mismo patrón.)

---

## 2. Mapa del Lienzo Lean

| Sección UI | Agente responsable | Estado (clave) | Archivo agente | Artefacto (schema) | Se renderiza en |
|------------|--------------------|----------------|----------------|--------------------|-----------------|
| **Problema** | Problem Agent | `state["problem"]` | `agents/problem.py` | `Problem` | `LienzoPanel.tsx:46-60` |
| **Segmento** | Customer Segment Agent | `state["customer_segment"]` | `agents/customer_segment.py` | `CustomerSegment` | `LienzoPanel.tsx:63-77` |
| **Propuesta de Valor** | Value Proposition Agent | `state["value_proposition"]` | `agents/value_proposition.py` | `ValueProposition` | `LienzoPanel.tsx:80-94` |

**Recorrido (idéntico para las 3 secciones):**
`raw_idea → Problem/Segment/ValueProp Agent → schema Pydantic → state["<clave>"] → serialize_blueprint (streaming.py:37) → API blueprint.blueprint → SSE agent_update → page.tsx setBp merge → LienzoPanel → Field/Chips → render`

> **Hallazgo:** El "Lienzo" **no lo genera un solo agente**: es un VPC distribuido en 3 nodos secuenciales (`build_graph.py:87-88`).

---

## 3. Mapa del Modelo de Negocio

**Un único agente** (`business_model_node`) genera **los 7 bloques** en una sola invocación LLM. Los otros 2 bloques del BMC canónico los cubren Segment y ValueProp.

| Sección UI (BMC) | Agente | Clave del JSON | Artefacto | Etiqueta UI |
|------------------|--------|----------------|-----------|-------------|
| Socios clave | Business Model | `key_partners` | `BusinessModel` | "Socios clave" (`LienzoPanel.tsx:26`) |
| Actividades | Business Model | `key_activities` | `BusinessModel` | "Actividades clave" (`:27`) |
| Recursos | Business Model | `key_resources` | `BusinessModel` | "Recursos clave" (`:28`) |
| Canales | Business Model | `channels` | `BusinessModel` | "Canales" (`:29`) |
| Relación | Business Model | `customer_relationships` | `BusinessModel` | "Relación con cliente" (`:30`) |
| Ingresos | Business Model | `revenue_streams` | `BusinessModel` | "Ingresos" (`:31`) |
| Costos | Business Model | `cost_structure` | `BusinessModel` | "Costos" (`:32`) |
| *(Segmento)* | Customer Segment | `customer_segment` | `CustomerSegment` | tarjeta ② |
| *(Propuesta de valor)* | Value Proposition | `value_proposition` | `ValueProposition` | tarjeta ③ |

**Reutilización documentada:** el prompt de Business Model (`prompts/__init__.py:170-171`) declara explícitamente que consume Segment + ValueProp y sólo genera los bloques que el VPC no cubre → evita duplicar la fuente de verdad.

---

## 4. Flujo completo de datos

```
Agente Lean (problem / segment / valueprop / business_model)
   ↓  get_structured_model(Schema) → objeto Pydantic
state["<clave>"] = obj.model_dump(mode="json")     [state.py:23-39]
   ↓
serialize_blueprint(values) → proyección de ARTIFACT_FIELDS   [streaming.py:16-39]
   ↓
   ├─ streaming (en vivo): evento SSE "agent_update"
   │     { node, trace?, artifacts: Partial<Blueprint> }        [streaming.py:94-101]
   │        ↓  lib/stream.ts parseBlock → JSON.parse            [stream.ts:56-87]
   │        ↓  page.tsx onEvent → setBp({...b, ...ev.artifacts}) [page.tsx:220]
   │
   └─ final / recarga: GET /blueprint/{id} → { id, project_id, status, blueprint } [blueprint.py:231-236]
   ↓
StagePanel switch → componente tipado por sección                [page.tsx:359-458]
   ↓
LienzoPanel bp={bp} → Field / Chips                              [LienzoPanel.tsx]
   ↓
Render (texto plano JSX + chips) — sin markdown
```

Esta cadena es la misma para cada sección; sólo cambia la clave (`problem`, `customer_segment`, …).

---

## 5. Contrato Backend → Frontend

**Respuesta explícita: el frontend consume un CONTRATO FIJO tipado, NO renderiza texto libre.**

- Respuesta API (`app/api/routes/blueprint.py:231-236`):
  ```json
  { "id": "...", "project_id": "...", "status": "running|awaiting_input|done", "blueprint": { … } }
  ```
- `blueprint` = proyección de `ARTIFACT_FIELDS` (`streaming.py:16-34`); cada valor es el `.model_dump(mode="json")` de un schema Pydantic.
- El contrato TS **se autodescribe como "espejo de los schemas Pydantic"** (`lib/types.ts:1`). Estructuras `Problem` (`:9-15`), `CustomerSegment` (`:16-22`), `ValueProposition` (`:23-29`), `BusinessModel` (`:30-38`), agregadas en `Blueprint` (`:195-213`) con todos los campos **opcionales** (tolera llegada incremental por stream).
- **Cero markdown:** no existe `react-markdown` / `marked` / `remark`; el único `dangerouslySetInnerHTML` es el script de tema en `app/layout.tsx:33`, no contenido. Todo string entra como texto plano JSX (`{p.statement}`, `{v.differentiator}`).

Los únicos strings de forma libre son **valores de hoja** (`statement`, `description`, `rationale`), nunca el contenedor.

---

## 6. Dependencias (¿la UI asume estructura fija?) — **SÍ**

| Tipo de dependencia | ¿Existe? | Evidencia |
|---------------------|----------|-----------|
| **Estructura de campos fija** | Sí | `LienzoPanel.tsx:53-91` accede a campos nominales (`p.statement`, `v.gain_creators`…) |
| **Orden específico (BMC)** | Sí | `BMC_BLOCKS` fija orden y claves literales (`LienzoPanel.tsx:25-33`) |
| **Títulos hardcodeados** | Sí | Etiquetas en español fijas ("Socios clave", "Dolores", "Jobs del cliente"…) |
| **Listas obligatorias** | Parcial | Campos opcionales con guardas `?.length`; ausencia se degrada a "—" o se omite |
| **Longitud de texto** | No rompe datos | Sólo decisiones de layout (`wide = hypotheses.length > 8`, `HypothesisRoadmap.tsx:164`) y truncado visual |
| **Formato markdown** | **No** | No hay parsing de markdown en ninguna parte |
| **Enums cerrados** | Sí | `QUADRANT_LABEL` (`HypothesisRoadmap.tsx:29`), `STATUS_MAP` (`ResearchPanel.tsx:6`), uniones `RiskType`/`Stage` (`types.ts:3-5`) |
| **Claves de join** | Sí | Indexado por `hypothesis_id` / `experiment_id` (`HypothesisRoadmap.tsx:36-44`) |
| **Nombres de nodo del grafo** | Sí | `AGENT_LABEL` mapea ~24 nodos (`AgentStreamPanel.tsx:5-29`); fallback al nombre crudo |
| **Nombres de gate/interrupt** | Sí | `GATE_STAGE` (`page.tsx:47-51`), `inferInterrupt` (`page.tsx:78-85`) replican la máquina de estados del backend |

> **Matiz importante para el rediseño:** todas estas dependencias son de **nombres del backend** (claves, enums, IDs, nodos). **Ninguna** depende de *cómo* se presenta la sección. Reordenar visualmente, colapsar o resumir en la UI no toca ninguna de ellas.

---

## 7. Acoplamiento

| Frontera | Nivel | Justificación |
|----------|-------|---------------|
| **Agentes ↔ Estado** | Medio | Cada agente valida/serializa su propio schema; secuencia fija en el grafo |
| **Estado ↔ API** | Bajo | `serialize_blueprint` es proyección mecánica de campos; sin lógica de presentación |
| **API ↔ Frontend (forma de datos)** | **Alto** | El frontend depende de nombres de campo, enums, IDs de join y nombres de nodo; `lib/types.ts` es espejo 1:1 de Pydantic |
| **Contenido ↔ Presentación (dentro del frontend)** | **Bajo** | La presentación (tarjetas, chips, paneles) está aislada en componentes; los datos llegan ya estructurados y sólo se pintan |

**El acoplamiento alto es de datos (nombres), no de presentación.** Esta distinción es la clave de toda la auditoría: el rediseño vive del lado "bajo".

---

## 8. Evaluación del rediseño

Para **todas** las opciones, el patrón es el mismo: los datos ya llegan estructurados campo por campo, así que reorganizarlos es puramente cliente.

| Opción | ¿Impacta backend? | ¿Impacta agentes? | ¿Impacta contrato? | Dónde se toca |
|--------|-------------------|-------------------|--------------------|---------------|
| **A. Sólo resumen** | No* | No* | No | UI (ver §10 para de dónde sale el resumen) |
| **B. Expand / Collapse** | No | No | No | UI (`LienzoPanel`, estado local) |
| **C. Tarjetas** | No | No | No | UI (ya existen tarjetas; sólo reestilar) |
| **D. Slides** | No | No | No | UI (contenedor de navegación sobre los mismos datos) |
| **E. Pestañas** | No | No | No | UI (`StagePanel` ya es un switch por sección) |
| **F. Vista Ejecutiva + Completa** | No* | No* | No | UI (dos vistas sobre el mismo `Blueprint`) |
| **G. Sólo problema/dolor/causa principal + expandir** | No | No | No | UI (renderizar `pains[0]`, `root_causes[0]` y expandir el resto) |

\* Excepción única: si el "resumen" (A, F) debe ser **texto redactado nuevo** en lugar de mostrar el primer ítem o el `statement` existente, entonces sí requiere una fuente de resumen (ver §10, Opciones 1–3). El **campo `report`** ya existe y contiene resúmenes redactados (`executive_summary`, `problem_summary`, `value_proposition_summary`, `next_steps[]` — `schemas/report.py:7-16`), por lo que incluso una "Vista Ejecutiva" puede armarse **sin tocar backend** reutilizando `bp.report`.

**Conclusión de la sección:** de las 7 opciones, **ninguna requiere cambios de backend/agentes/contrato** en su forma básica. Todas son reorganización de datos ya presentes.

---

## 9. Riesgos

| Riesgo | Probabilidad en un rediseño *sólo de presentación* | Nota |
|--------|-----------------------------------------------------|------|
| Romper el contrato | **Nula** | El rediseño no toca `lib/types.ts` ni los schemas |
| Romper serialización | **Nula** | No se toca `serialize_blueprint` ni `model_dump` |
| Afectar artefactos/agentes | **Nula** | Los agentes no saben nada de la UI |
| Romper renderizado | Baja | Riesgo local de React; mitigable con las guardas `?.` que ya existen |
| Duplicar información | Media | Si se copia texto a mano en vez de leer del campo; evitar |
| **Introducir 2ª fuente de verdad** | Media | **El riesgo real:** si el resumen se calcula/almacena aparte y diverge del artefacto. Ver §10 |
| Divergencia silenciosa de datos | Baja–Media | Ya existe hoy: si el backend renombra `revenue_streams`, ese bloque **desaparece sin error** (`LienzoPanel.tsx:107` → `return null`). No lo introduce el rediseño, pero conviene saberlo |

---

## 10. Posibilidad de resumir — ¿dónde podría vivir un resumen?

| Opción | Dónde | Ventajas | Desventajas |
|--------|-------|----------|-------------|
| **1. El propio agente** | Añadir campo `summary` al schema (`Problem`, etc.) | Una sola fuente de verdad; resumen "inteligente" | Cambia schema → cambia contrato → cambia `types.ts`. **No es sólo presentación** |
| **2. Agente adicional de resumen** | **Ya existe: `report`** (`schemas/report.py:7-16`) | Reutiliza infraestructura; resúmenes redactados por sección; **cero cambios** | El `report` se genera al final del pipeline (no disponible en estados intermedios) |
| **3. Backend (no-LLM)** | En `serialize_blueprint` o un derivador | Determinista, barato | Añade lógica de presentación al backend (rompe la separación limpia actual) |
| **4. Frontend** | Derivar en el cliente (ej. `statement` + primeros N ítems) | **Cero backend, cero contrato; recomendado para MVP visual** | Resumen "mecánico" (no redactado), salvo que use `bp.report` |
| **5. No resumir, sólo reorganizar** | Progressive disclosure sobre datos actuales | El más seguro; sin nueva fuente de verdad | No reduce la redacción, sólo la exposición simultánea |

**Recomendación:** Opción **5** (reorganización visual: expand/collapse, mostrar `statement` + ítems principales) combinada con **Opción 2** (reutilizar `bp.report` para una "Vista Ejecutiva") cubre casi todos los objetivos de UX **sin tocar backend ni contrato**.

---

## 11. Separación de responsabilidades

**Respuesta explícita:**

- **¿La lógica de negocio depende de cómo se muestra el contenido?** → **NO.** Los agentes (`agents/*.py`) sólo escriben schemas Pydantic al estado; no tienen ninguna referencia a componentes, layout ni presentación. El grafo (`build_graph.py`) es orquestación pura de datos.
- **¿La UI sólo representa información ya generada?** → **SÍ.** `LienzoPanel` recibe `bp` y pinta campos ya existentes; no genera ni transforma contenido (sólo lo agrupa en chips). El `StagePanel` (`page.tsx:359-458`) es un router de presentación.

**Evidencia de la separación:** el frontend incluso **replica** parte de la máquina de estados del backend (`inferInterrupt`, `readyFor`, `deriveTrace` — `page.tsx:53-105`) pero lo hace **leyendo presencia de campos**, no alterando la generación. La generación es indiferente a la UI.

---

## 12. Conclusión

1. **¿Qué agente genera cada parte del Lienzo?** Problema → **Problem Agent**; Segmento → **Customer Segment Agent**; Propuesta de Valor → **Value Proposition Agent**. (VPC distribuido en 3 nodos, `build_graph.py:87-88`.)

2. **¿Qué agente genera cada parte del Modelo de Negocio?** Un **único Business Model Agent** genera los 7 bloques (`key_partners`, `key_activities`, `key_resources`, `channels`, `customer_relationships`, `revenue_streams`, `cost_structure`) en una invocación (`business_model.py:13-30`, `lean.py:42-54`). Segmento y Propuesta de Valor los aportan sus propios agentes.

3. **¿Existe acoplamiento fuerte entre UI y agentes?** **No directamente.** El acoplamiento fuerte es UI ↔ **contrato de datos** (nombres de campo, enums, IDs de join, nombres de nodo). La UI no invoca ni conoce a los agentes; sólo consume el JSON. El acoplamiento **presentación ↔ contenido es bajo**.

4. **¿Rediseñar la interfaz afecta la lógica del sistema?** **No**, mientras se mantengan los nombres de campo del `Blueprint`. La lógica (agentes, grafo, serialización) es indiferente a la presentación.

5. **¿Es posible cambiar completamente la experiencia visual sin modificar la generación de contenido?** **Sí, completamente.** Los datos ya llegan estructurados campo por campo; cualquier layout (tarjetas, acordeones, slides, pestañas, vista ejecutiva) es reorganización cliente sobre el mismo `Blueprint`.

6. **Nivel de riesgo de un rediseño únicamente de presentación:** **MUY BAJO.**
   - Justificación: el contrato es fijo y ya lo consume la UI campo por campo; no hay markdown que parsear; la separación contenido/presentación ya existe; y las opciones A–G no tocan backend/agentes/contrato. El único riesgo gestionable es **no introducir una 2ª fuente de verdad** al resumir (mitigado usando `bp.report` o derivando en cliente, §10).

---

### Recomendaciones operativas (sin implementar)

- Hacer el rediseño **100% en frontend**, sobre el `Blueprint` tipado existente.
- Para "Vista Ejecutiva": reutilizar el artefacto **`report`** ya generado, en vez de crear un resumen nuevo.
- **No** copiar texto a componentes; siempre leer del campo (evita divergencia).
- Si en el futuro se renombra un campo en backend, actualizar en coordinación: `lib/types.ts`, `LienzoPanel.tsx` (`BMC_BLOCKS`), `page.tsx` (state machine) y `AgentStreamPanel.tsx` (`AGENT_LABEL`) — hoy un renombrado hace desaparecer bloques **sin error visible** (`LienzoPanel.tsx:107`).

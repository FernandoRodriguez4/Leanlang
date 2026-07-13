# Integración del Agente Investigador (Tavily) en el enjambre LeanLang

## Context

LeanLang genera un *blueprint* de validación Lean a partir de una `raw_idea` mediante un **pipeline LangGraph determinista y lineal** de 14 Lean Agents, orquestado por un supervisor determinista (routing por presencia de campos en el estado), con un bucle del Crítico y 3 interrupts human-in-the-loop. **Hoy no existe ninguna integración de búsqueda web ni tool calling**: cada agente es un nodo que invoca un LLM con salida estructurada (Pydantic vía function-calling) y nada más. Toda la selección de experimentos es determinista sobre un catálogo JSON curado; los embeddings/RAG son solo andamiaje (Protocol sin implementación).

El objetivo es incorporar un **Agente Investigador** que aporte evidencia externa (competidores, mercado, tendencias, benchmarks, regulaciones, estudios) para que las recomendaciones del enjambre estén respaldadas por datos y no solo por el LLM. Debe integrarse **desacoplado**, ejecutarse **solo cuando aporte valor** (es costoso: tiempo + tokens + búsquedas) y ser **transparente en el frontend**.

**Decisiones de diseño confirmadas por el usuario:**
1. El Investigador corre **al inicio**, tras `raw_idea` y antes de los Lean Agents, para que todos trabajen con la misma evidencia.
2. La decisión de investigar y la **generación de queries vive en el propio Supervisor** (`supervisor_node`), no en un nodo separado. Se implementa como un **gate híbrido**: guarda determinista (cachea: no repite si ya hay `research`; respeta `research_enabled` de config y `include_research` del request para corridas reproducibles de la tesis) + una llamada LLM que decide `execute` y genera **3–5 queries complementarias**.
3. El Investigador **no decide nada**: solo ejecuta Tavily, resume y devuelve un **Research Report** estructurado. Un fallo de Tavily nunca detiene el pipeline.
4. El Research Report se guarda en el estado y se emite como artefacto (`research`), reutilizando el mecanismo de streaming existente; además se inyecta como contexto a los agentes del canvas + hipótesis.
5. El `ResearchReport` **no es un agente**: es el resultado estructurado que produce el Investigador. Una vez generado pasa a formar parte del **contexto inicial del Blueprint**, al mismo nivel conceptual que `raw_idea`. Todos los agentes posteriores que lo consumen reutilizan exactamente el mismo reporte — no se vuelve a invocar Tavily bajo ninguna circunstancia dentro del mismo Blueprint.

---

## Ciclo de vida del Agente Investigador

El Investigador únicamente puede ejecutarse **durante la construcción inicial del Blueprint**: inmediatamente después del Supervisor, antes de `problem`, y **una única vez por Blueprint** (una única vez por `thread_id`).

```
START
   │
   ▼
Supervisor
   │
¿Necesita evidencia externa? (solo si aún no hay `problem` ni `research`)
   │
 ┌──────────────┴──────────────┐
 │                              │
 No                            Sí
 │                              │
 ▼                              ▼
Problem                   research (Tavily)
                                 │
                                 ▼
                          ResearchReport → BlueprintState + artifact
                                 │
                                 ▼
                              Problem
```

**Regla de ejecución.** El Supervisor es el único responsable de decidir si corresponde ejecutar el Investigador, y esa decisión solo puede tomarse en la primera construcción del Blueprint. En cualquier reentrada del pipeline la ejecución se omite automáticamente. Conceptualmente:

```python
if state.get("problem") or state.get("research"):
    skip research  # ya hay Blueprint en curso o evidencia ya recolectada
```

Esto es exactamente lo que ya implementa el gate de `supervisor_node` (sección "Agente y lógica del Supervisor"): el guard determinista (`no hay problem ni research`) antecede a la llamada LLM que decide `execute`.

**Escenarios donde el Investigador NO vuelve a ejecutarse** (se reutiliza el `ResearchReport` ya almacenado en el estado):
- Reentrada por `hypotheses` o por `risk`.
- Revisiones y rechazos del Crítico (`critic` → `experiment_design` → ... → `critic`).
- `Bump Revision`.
- Nuevas pasadas de `experiment_design` posteriores a la primera.
- Resumes de cualquiera de los 3 Human Interrupts (p. ej. `Hypotheses → Human Interrupt → Hypotheses`): el usuario está modificando información del mismo Blueprint, no proponiendo una idea de negocio nueva, por lo que no corresponde investigar de nuevo.

**Único escenario donde vuelve a ejecutarse.** Cuando comienza una nueva ejecución de Blueprint (nuevo `thread_id`) con una `raw_idea` distinta. Cada Blueprint genera su propio `ResearchReport`, independiente de los demás.

---

## Arquitectura objetivo (topología)

Se inserta **un único nodo nuevo** (`research`) al frente del backbone. La decisión + generación de queries se hace **dentro de `supervisor_node`**; `route_entry` solo lee el flag ya escrito en el estado (una función de conditional edge no puede escribir estado, por eso el LLM corre en el nodo Supervisor).

```
START → supervisor            (supervisor_node: decide execute + genera queries → escribe research_plan)
supervisor ─(route_entry)→ research | problem | hypotheses | risk
research → problem
problem → customer_segment → value_proposition → business_model → hypotheses → ... → critic → report → END   (sin cambios)
```

- **`supervisor_node`** (`app/agents/supervisor.py`): además de podar `messages`, en la **primera entrada** (cuando no hay `problem` ni `research`, `settings.research_enabled` es `True` y el request no trae `include_research=False`) hace **una** llamada LLM con salida estructurada `ResearchPlan` y escribe `state["research_plan"] = {execute, queries}`. En re-entradas (ya hay `problem`) o si está desactivado, no hace la llamada (queda trivial como hoy).
- **`route_entry`** (`app/agents/supervisor.py:23`): lee el estado ya actualizado por el nodo:
  - si no hay `problem`: `"research"` si `research_plan.execute` y aún no existe `research`; si no, `"problem"`.
  - si no hay `hypotheses`: `"hypotheses"`. Si no: `"risk"` (re-entradas, sin cambios).
- **`research`** (Investigador): lee `state["research_plan"]["queries"]`, ejecuta Tavily (en paralelo), sintetiza con `get_structured_model(ResearchReport)` y retorna `{"research": report}`. No modifica ningún otro campo del blueprint. Ante fallo de Tavily devuelve un `ResearchReport` vacío/parcial (`status="failed"`) y continúa.

Se elimina el nodo `research_gate` y su conditional `route_research`: el Supervisor concentra toda la orquestación. El grafo queda **determinista salvo un único punto opcional y desactivable** (el gate LLM dentro del Supervisor), respetando la reproducibilidad de la tesis.

---

## Cambios en el Backend

### 1. Dependencia y configuración
- **`requirements.txt`**: añadir `tavily-python`.
- **`app/core/config.py`** (`Settings`, tras el bloque LLM): añadir
  `tavily_api_key: str | None = None`, `research_enabled: bool = True`,
  `research_max_queries: int = 5`, `research_results_per_query: int = 5`.
- **`.env.example`**: documentar `TAVILY_API_KEY` y `RESEARCH_ENABLED`.

### 2. Estado compartido
- **`app/schemas/state.py`** (`BlueprintState`): añadir
  - `research: dict[str, Any]` — el Research Report serializado (artefacto).
  - `research_plan: dict[str, Any]` — control efímero (`execute` + `queries`) que escribe el Supervisor y leen `route_entry` y el nodo `research`.
  - `include_research: bool` — flag opcional por corrida.
  Todos sin reducer (last-write-wins, como el resto de artefactos).

### 3. Schemas Pydantic (nuevo archivo `app/schemas/research.py`)
Siguiendo el estilo de `app/schemas/lean.py`:

```python
class ResearchPlan(BaseModel):
    execute: bool          # ¿ejecutar el Investigador?
    queries: list[str]     # 3–5 consultas complementarias (acotar a research_max_queries)

class Source(BaseModel):
    title: str
    url: str
    snippet: str = ""

class Competitor(BaseModel):
    name: str
    description: str = ""
    url: str | None = None

class ResearchReport(BaseModel):
    status: str = "completed"        # completed | partial | failed | empty
    confidence: str = ""             # nivel de confianza: "High"/"Medium"/"Low" o "0.82"
    generated_at: str = ""           # ISO timestamp de la investigación
    queries: list[str] = []          # queries efectivamente ejecutadas (para transparencia)
    market_summary: str = ""
    competitors: list[Competitor] = []
    trends: list[str] = []
    benchmarks: list[str] = []
    regulations: list[str] = []
    studies: list[str] = []
    sources: list[Source] = []
```

`ResearchPlan` es mínimo (sin `rationale` ni `needs_research`): solo controla la ejecución y transporta las queries. El nodo `research` rellena `status`, `confidence`, `generated_at` y `queries` (estos tres los fija el propio nodo con `datetime.now(timezone.utc).isoformat()` y no dependen del LLM).

### 4. Prompts (`app/agents/prompts/__init__.py`)
Añadir, con su `*_PROMPT_VERSION`:
- `RESEARCH_PLAN_SYSTEM` (usado por el Supervisor): decide si la idea requiere evidencia externa (SÍ: idea nueva, competidores, mercado, tendencias, regulaciones, benchmarks; NO: solo diseñar experimentos/entrevistas/hipótesis sobre info del usuario) y genera **entre 3 y 5 queries complementarias**, cada una enfocada en un aspecto distinto (competidores, tamaño de mercado, tendencias, modelos de negocio, regulaciones). Ejemplo para "app de estacionamientos": `parking app competitors`, `parking market size`, `parking startup trends`, `parking business models`, `parking regulations`.
- `RESEARCH_SYSTEM` (usado por el Investigador): sintetiza los resultados de Tavily en el `ResearchReport`, sin inventar (anclarse a las fuentes), citando URLs, y estimando `confidence` según la cantidad/consistencia de la evidencia.

### 5. Agente y lógica del Supervisor
- **`app/agents/supervisor.py`**:
  - `supervisor_node(state)`: poda `messages` (como hoy) + gate. Si es primera entrada elegible → `get_structured_model(ResearchPlan)` con `RESEARCH_PLAN_SYSTEM` y `raw_idea`; retorna `{"messages":[...], "research_plan": plan.model_dump()}`. Si no, retorna solo `{"messages":[...]}`.
  - `route_entry(state)`: nueva lógica descrita arriba (añade la rama `"research"`).
- **`app/agents/research.py`** (nuevo — solo el Investigador):
  - `research_node(state)`: cliente Tavily (`from tavily import TavilyClient`), ejecuta `state["research_plan"]["queries"]` en paralelo con `ThreadPoolExecutor`, agrega resultados y los pasa a `get_structured_model(ResearchReport)`. Fija `queries`, `generated_at`, `status`. Retorna `{"research": report, "messages":[trace("research", ...)]}`. **Tolerancia a fallos**: envuelve Tavily y el LLM en try/except; ante error devuelve `ResearchReport(status="failed", generated_at=..., queries=...)` vacío y traza el error, permitiendo que el pipeline continúe a `problem`.

### 6. Distribución de la evidencia a los agentes
- **`app/agents/base.py`**: helper `research_context(state) -> str` que devuelve `jdump(state["research"])` formateado o `""` si no hay research.
- Inyectar ese bloque en el `HumanMessage` de **`problem.py`, `customer_segment.py`, `value_proposition.py`, `business_model.py`, `hypotheses.py`** (anteponer "Evidencia externa disponible:\n{research_context(state)}"). Aditivo: sin research, el prompt queda idéntico al actual.
- **`report.py` queda explícitamente excluido**: el agente `Report` **no** debe leer ni reinterpretar `state["research"]` (no se le agrega `research_context`). Su responsabilidad continúa siendo exclusivamente resumir el Blueprint ya construido; la evidencia externa ya fue incorporada por los cinco agentes anteriores durante la construcción del Blueprint, así que volver a pasársela sería redundante.

### 7. Grafo (`app/graph/build_graph.py`)
- `g.add_node("research", research_node)` (NO se añade `research_gate`).
- Ampliar el mapa de `route_entry`: `{"research": "research", "problem": "problem", "hypotheses": "hypotheses", "risk": "risk"}`.
- `g.add_edge("research", "problem")`.
- Actualizar el docstring de topología (líneas 6-12).

### 8. Streaming al frontend (artefacto `research`)
- **`app/api/streaming.py`**: añadir `"research"` a `ARTIFACT_FIELDS` (línea 16). El nodo `research` emite automáticamente un `agent_update` con `artifacts.research` — **mismo mecanismo que los demás agentes** (no se introduce un tipo de evento nuevo; el frontend hace merge como con cualquier artefacto).

### 9. Flag por request
- **`app/api/routes/blueprint.py`** / `BlueprintRunRequest`: añadir `include_research: bool = True` y propagarlo a `initial_state` (línea 165-172).

---

## Cambios en el Frontend

### 1. Tipos y stream
- **`frontend/lib/types.ts`**: añadir `ResearchReport` (con `status`, `confidence`, `generated_at`, `queries`, `market_summary`, `competitors`, `trends`, `benchmarks`, `regulations`, `studies`, `sources`), `Competitor`, `Source`, y `research?: ResearchReport` en `Blueprint`.
- **`frontend/lib/stream.ts`**: sin cambios de protocolo — `research` llega dentro de `agent_update.artifacts` y se mergea igual que los demás artefactos.

### 2. Estación y panel
- **`frontend/app/projects/[id]/page.tsx`**: añadir estación `investigacion` como **primera** en `STAGE_DEFS`, incluirla en `readyFor()` (`bp.research`), enrutar en `StagePanel` a `ResearchPanel`, y auto-enfocarla cuando llega el nodo `research`.
- **`frontend/components/ResearchPanel.tsx`** (nuevo): tarjeta con el patrón `.card` (ver `PlanEstimateCard.tsx`/`OverviewPanel.tsx`), mostrando:
  ```
  🔎 Investigación
  Estado        ✓ Completada        (deriva de status; failed → aviso)
  Confianza     High                (research.confidence)
  Consultas realizadas              (research.queries → lista)
    • parking competitors ...
  Competidores  (research.competitors)
  Mercado       (research.market_summary + trends/benchmarks/regulations)
  Fuentes       (research.sources → links a url)
  ```
- **`frontend/components/AgentStreamPanel.tsx`**: añadir `research` a `AGENT_LABEL` para la bitácora.

---

## Cómo se evitan búsquedas repetidas
- El `ResearchReport` se persiste en el checkpointer como el campo `research`.
- El gate del Supervisor cortocircuita si ya hay `research` o `problem` en el estado → cubre, sin excepción, reentrada por `hypotheses`, reentrada por `risk`, revisiones/rechazos del Crítico, `Bump Revision`, nuevas pasadas de `experiment_design` y resumes de los 3 Human Interrupts (detalle en "Ciclo de vida del Agente Investigador" más arriba).
- Se de-duplican queries antes de llamar a Tavily.
- Un cambio importante de idea implica un nuevo blueprint (nuevo `thread_id`) → la investigación se rehace de forma natural; es el único caso en que el Investigador vuelve a correr.

## Garantía de no-regresión sobre el pipeline actual
El único cambio estructural permitido en el grafo es la inserción del nodo `research` entre `supervisor` y `problem`, activo solo cuando el gate lo decide. Todo lo demás permanece exactamente igual al pipeline vigente:
- orden de los 14 Lean Agents (`problem → customer_segment → value_proposition → business_model → hypotheses → risk → experiment_design → metrics → success_criteria → decision → sequencing → plan_estimate → critic → report`);
- comunicación/estado entre agentes existentes;
- los 3 Human Interrupts;
- el ciclo de revisión del Crítico;
- el agente `Report` (no consume `research`, ver sección 6).

## Costo y latencia
- El gate es **una** llamada LLM barata dentro del Supervisor; el Investigador solo corre si `execute=true` y solo en la primera pasada.
- Búsquedas Tavily en **paralelo** (3–5 queries) + **una** llamada LLM de síntesis.
- Desactivable global (`research_enabled=False`) o por request (`include_research=False`) para corridas reproducibles.

---

## Verificación (end-to-end)
1. **Config**: `TAVILY_API_KEY` en `.env`; `RESEARCH_ENABLED=true`.
2. **Camino feliz**: `POST /projects/{id}/blueprint/run` con "app para encontrar estacionamientos". En el SSE debe verse `node: "supervisor"` (con `research_plan`) → `node: "research"` con `artifacts.research` poblado (status=completed, confidence, 3–5 queries, competidores, fuentes). Confirmar que `problem`/`hypotheses` usan la evidencia.
3. **Gate NO**: idea que no requiere evidencia (o `include_research=false`) → `research_plan.execute=false`, no aparece el nodo `research`, salta directo a `problem`.
4. **Caché**: `resume` tras interrupt o revisión del Crítico → `research` NO se re-ejecuta.
5. **Fallo tolerante**: `TAVILY_API_KEY` inválida → el nodo `research` devuelve `status="failed"` vacío y el pipeline continúa hasta el blueprint sin romperse; el panel muestra el estado de fallo.
6. **Frontend**: la estación **Investigación** aparece primera y muestra estado, confianza, consultas realizadas, competidores, mercado y fuentes.
7. **Observabilidad**: en LangSmith se ven los runs del gate (dentro de `supervisor`) y `research` con su `*_PROMPT_VERSION`.

---

## Archivos clave
**Nuevos**: `app/agents/research.py`, `app/schemas/research.py`, `frontend/components/ResearchPanel.tsx`.
**Modificados (backend)**: `app/agents/supervisor.py` (gate + route_entry), `app/graph/build_graph.py`, `app/schemas/state.py`, `app/agents/prompts/__init__.py`, `app/agents/base.py`, `app/api/streaming.py`, `app/core/config.py`, `requirements.txt`, `.env.example`, `app/api/routes/blueprint.py` (+ `BlueprintRunRequest`), y los 5 consumidores (`problem.py`, `customer_segment.py`, `value_proposition.py`, `business_model.py`, `hypotheses.py`).
**Modificados (frontend)**: `frontend/lib/types.ts`, `frontend/app/projects/[id]/page.tsx`, `frontend/components/AgentStreamPanel.tsx`.

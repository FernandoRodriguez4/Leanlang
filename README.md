# Validation Blueprint — Sistema Multiagente para el Diseño de Experimentos de Validación

Sistema multiagente (LangGraph) que asiste a equipos —solopreneurs, startups e innovadores
corporativos— en el **diseño de la estrategia de validación** de una idea de negocio,
fundamentado en *Testing Business Ideas* (Bland & Osterwalder).

> **Alcance (esta fase):** el sistema cubre **solo la etapa de DISEÑO**, no la ejecución.
> Genera un *Validation Blueprint*: identifica hipótesis, clasifica riesgos (D/F/V),
> prioriza supuestos (mapa 2×2), selecciona experimentos de la biblioteca de **44** y
> define **métricas y criterios de éxito** (Test Cards). **No** ejecuta experimentos ni
> espera resultados de mercado → la evaluación se concentra en la **calidad del diseño**,
> lo que permite obtener resultados de investigación en menor tiempo.

---

## Arquitectura de agentes (triaje / supervisor)

Un **Supervisor/Triaje** decide qué agente especialista actúa. El backbone es determinista
(reproducible para la tesis) con re-enrutamiento del Crítico y 3 puntos *human-in-the-loop*.

```
START → Supervisor ─(triaje)→ Intake → Hipótesis ─[interrupt]→ Riesgo → Priorización
        ─[interrupt]→ Selector → Métricas → Crítico ─(loop si falla)→ Selector
                                                     └→ [interrupt] Aprobación → END
```

| Agente | Rol | Salida (Pydantic) | Anclaje en el libro |
|--------|-----|-------------------|---------------------|
| Supervisor/Triaje | Enruta; controla el loop del crítico | `next` | Ceremonias / Decidir |
| Intake | Estructura VPC + BMC | `Canvas` | Business Model / Value Proposition Canvas |
| Hipótesis | "Creemos que…" + contra-hipótesis | `HypothesisList` | Hipotetizar |
| Riesgo | Clasifica D/F/V + bloque | `ClassificationList` | Deseable/Factible/Viable |
| Priorizador | Mapa 2×2 (importancia × evidencia) | `PrioritizationList` | Assumptions Map |
| Selector | Experimentos del catálogo (anclado) | `ExperimentRecList` | Reglas del juego / secuencias |
| Métricas | Test Cards (métrica + criterio) | `TestCardList` | Test Card |
| Crítico (QA) | Audita trampas; puntúa calidad | `CriticReview` | "Evite las trampas" |

El **Selector está anclado al catálogo**: solo puede recomendar experimentos existentes
(post-validación de ids contra los 44). No alucina experimentos.

---

## Stack

- **Backend:** Python 3.11, FastAPI, LangGraph + LangChain (`init_chat_model`, LLM agnóstico),
  Pydantic v2, SQLAlchemy + Postgres, checkpointer Postgres (con fallback en memoria), JWT.
- **Frontend:** Next.js 14 (App Router) + React + TypeScript + Tailwind. Streaming SSE del
  razonamiento de los agentes, mapa 2×2 interactivo, edición human-in-the-loop, export MD/JSON.
- **Catálogo:** 44 experimentos curados (`backend/app/catalog/experiments.json`) → Postgres.

---

## Cómo ejecutar

### Opción A — Docker Compose (todo)
```bash
cp backend/.env.example backend/.env        # ajusta claves de LLM
export ANTHROPIC_API_KEY=sk-ant-...          # o OPENAI_API_KEY
docker compose up --build
# Frontend: http://localhost:3000   ·   API: http://localhost:8000/docs
```

### Opción B — Manual (dev)
**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -e ".[dev]"
cp .env.example .env                                     # configura LLM_PROVIDER/MODEL + API key + DATABASE_URL
alembic upgrade head                                      # crea el esquema de negocio en Postgres
uvicorn app.main:app --reload
```
**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev      # http://localhost:3000
```

### Configuración del LLM (agnóstico)
En `backend/.env`:
```
LLM_PROVIDER=anthropic        # o "openai"
LLM_MODEL=claude-sonnet-4-5   # o "gpt-4o", etc.
ANTHROPIC_API_KEY=...         # o OPENAI_API_KEY
```
Cambiar de modelo no requiere tocar código (útil para comparar modelos en la tesis).

---

## API (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register`, `/auth/login` | Registro / login (JWT) |
| GET/POST | `/projects` | Listar / crear proyectos |
| GET/DELETE | `/projects/{id}` | Ver / borrar proyecto |
| GET | `/experiments` | Catálogo de los 44 |
| POST | `/projects/{id}/blueprint/run` | Corre el grafo (**SSE**) |
| POST | `/blueprint/{id}/resume` | Reanuda tras interrupt (human-in-the-loop) |
| GET | `/blueprint/{id}` | Estado del blueprint |
| GET | `/blueprint/{id}/export?format=md\|json` | Exporta |

Eventos SSE: `started` · `agent_update` · `interrupt` · `awaiting_input` · `done` · `error`.

---

## Evaluación (Design Science Research)

El alcance es la **calidad del diseño** generado. La rúbrica estructural
(`backend/app/eval/rubric.py`) es **determinista** (no requiere LLM) y mide 6 dimensiones:
calidad de hipótesis, cobertura de riesgo D/F/V, solidez de priorización, selección de
experimentos (validez/triangulación/presupuesto), métricas/criterios comparables y trampas
evitadas. Pesos en `WEIGHTS`.

```bash
cd backend
python -m app.eval.run_eval     # corre el golden set y escribe app/eval/results.json
```
`golden_set.json` trae ideas de referencia (B2C, B2B, SaaS). Para la tesis, complementa con
un **panel de expertos** que puntúe blueprints generados vs. baseline humano (ciego), mide
tiempo-de-diseño y aplica SUS de usabilidad.

---

## Tests
```bash
cd backend
python -m pytest -q
```
`tests/conftest.py` fija `JWT_SECRET` y una BD de test PostgreSQL aislada (`blueprint_test`,
derivada del `DATABASE_URL` de tu `.env`) automáticamente — no requiere variables manuales.
Cubre: catálogo (44), grafo completo con LLM falso (interrupts + loop del crítico + anclaje
del selector), API (auth/proyectos) y la rúbrica DSR. **47 tests.**

---

## Estructura
```
backend/app/
  core/        config + llm (agnóstico)
  db/          modelos + sesión
  auth/        JWT
  schemas/     Pydantic (dominio + estado + API)
  catalog/     44 experimentos + servicio + tools + seed
  agents/      7 especialistas + supervisor + prompts
  graph/       build_graph + runtime (checkpointer)
  api/routes/  auth · projects · blueprint(SSE) · export
  eval/        rúbrica DSR + golden set + runner
frontend/
  app/         login · register · dashboard · projects/new · projects/[id]
  components/   AgentStreamPanel · HypothesisList · AssumptionsMap2x2 · ExperimentSequence · TestCardView · CriticReview
  lib/         api · auth · stream(SSE) · types
```

---

## Alcance y trabajo futuro
- **Incluido:** diseño completo de la estrategia de validación (hipótesis → Test Cards) con
  human-in-the-loop y export.
- **Fuera (futuro):** ejecución autónoma de experimentos ("enjambre ejecutor"), recolección
  de evidencia real de mercado, experimentos físicos. El sistema los *recomienda*, no los ejecuta.

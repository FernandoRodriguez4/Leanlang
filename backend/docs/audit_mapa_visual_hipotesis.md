# Auditoría Técnica: Factibilidad del Mapa Visual de Hipótesis

## Objetivo

Determinar si es posible implementar un **Mapa Visual de Hipótesis** dentro del apartado **Hipótesis**, utilizando exclusivamente la información que ya produce el sistema, sin modificar la arquitectura existente (LangGraph, Supervisor, Runtime, Checkpointer, Persistencia, Pipeline de agentes ni el flujo del Blueprint).

El objetivo **NO** es implementar todavía, sino verificar la factibilidad técnica.

Esta auditoría es de **solo lectura** (no se modificó código). Toda afirmación está respaldada con evidencia `archivo:línea`.

---

## Resumen Ejecutivo

**Sí, es técnicamente viable.** El sistema ya produce y persiste toda la información que el mapa necesita, y cada artefacto de la cadena de validación (clasificación, riesgo, experimento, métrica, criterio, decisión) está enlazado a su hipótesis mediante un campo `hypothesis_id` explícito. El backend ya expone estos artefactos tal cual en `GET /blueprint/{id}` (`serialize_blueprint`, `app/api/streaming.py:37-39`). El mapa puede construirse como una **representación visual pura en el frontend**, sin tocar LangGraph, Supervisor, Runtime, Checkpointer, Persistencia ni el pipeline de agentes.

**Salvedad importante de timing** (que el alcance pedía verificar explícitamente): en el momento en que el usuario *revisa las hipótesis* (primer `interrupt`), **solo existen las hipótesis** — ningún nodo de la cadena de validación se ha ejecutado todavía. La cadena vertical del ejemplo (H → Clasificación → Riesgo → Experimento → Métrica → Criterio → Decisión) solo está **completa al final del grafo**. Se llena progresivamente conforme el usuario hace `resume`.

---

## 1. Momento de disponibilidad de la información

El flujo tiene **tres** interrupts, no uno. Evidencia: `app/graph/build_graph.py:93-113` y los nodos `interrupt()` en `app/agents/supervisor.py:116,128,140`.

| Punto del flujo | Estado disponible en ese momento |
|---|---|
| **Interrupt #1 — `review_hypotheses`** (el usuario revisa las hipótesis) | `research`, `problem`, `customer_segment`, `value_proposition`, `business_model`, **`hypotheses`** |
| Tras `resume(stage="hypotheses")` → nodo `risk` → **Interrupt #2 — `review_prioritization`** | Se añaden **`classifications`** y **`prioritization`** |
| Tras `resume(stage="prioritization")` → `experiment_design → metrics → success_criteria → decision → sequencing → plan_estimate → critic → report` → **Interrupt #3 — `approve_blueprint`** | Se añaden **`recommendations`**, **`metric_specs`**, **`success_criteria`**, **`decisions`**, `test_cards`, `validation_roadmap`, `plan_estimate`, `critic_review`, **`report`** |

**¿Qué podría mostrarse inmediatamente (interrupt #1)?**
Solo los nodos de hipótesis con sus atributos estáticos: `statement`, `source_block`, `is_counter_hypothesis` (`app/schemas/hypothesis.py:10-18`). La cadena de validación estaría vacía.

**¿Qué solo existe después de los resume?**
Todo lo demás. `classifications`/`prioritization` tras el primer resume; `recommendations`, `metric_specs`, `success_criteria`, `decisions`, `report` tras el segundo. Por eso el mapa completo del ejemplo solo se puede renderizar cuando el blueprint ha avanzado más allá de los interrupts (o parcialmente, capa a capa, según el estado).

---

## 2. Productores de información

| Información | Agente productor | Evidencia | Ya existe |
|---|---|---|---|
| Hypotheses | Hypothesis Agent | `app/agents/hypotheses.py:30` | Sí |
| Classification | Risk Agent | `app/agents/risk.py:26,37` | Sí |
| Prioritization | Risk Agent | `app/agents/risk.py:34,38` | Sí |
| Experiment Recommendations | Experiment Design Agent | `app/agents/experiment_design.py:110` | Sí |
| Metric Specs | Metrics Agent | `app/agents/metrics.py:26` | Sí |
| Success Criteria | Success Criteria Agent | `app/agents/success_criteria.py:63` | Sí |
| Decisions | Decision Agent | `app/agents/decision.py:27` | Sí |
| Report | Report Agent | `app/schemas/report.py:7` | Sí |

Nota: "Clasificación" y "Riesgo" (dos nodos separados en el diagrama conceptual) provienen ambos del **mismo Risk Agent**: la *clasificación* es `risk_type` + `bmc_block`, y el *riesgo* es `risk_level` (en `classifications`) más el cuadrante 2×2 `quadrant`/`is_riskiest` (en `prioritization`). Evidencia: `app/agents/risk.py:17-41`.

---

## 3. Relaciones con la hipótesis

**Sí, casi todos usan `hypothesis_id` como clave de enlace.** Evidencia en los schemas Pydantic:

| Artefacto | Relación con Hypothesis | Método | Evidencia |
|---|---|---|---|
| Classification | N:1 | `hypothesis_id` | `app/schemas/hypothesis.py:33` |
| Prioritization | 1:1 | `hypothesis_id` | `app/schemas/hypothesis.py:62` |
| ExperimentRec | N:1 | `hypothesis_id` (+ `experiment_id`) | `app/schemas/experiment.py:32` |
| MetricSpec | N:1 | `hypothesis_id` (+ `experiment_id`) | `app/schemas/measurement.py:11-12` |
| SuccessCriterion | N:1 | `hypothesis_id` (+ `experiment_id`) | `app/schemas/measurement.py:25-26` |
| DecisionRule | N:1 | `hypothesis_id` (+ `experiment_id`) | `app/schemas/decision.py:17-18` |
| **Report** | **No enlazable por id** | Listas de **texto libre** | `app/schemas/report.py:13-14` |

- **¿Todos usan `hypothesis_id`?** Todos los de la cadena de validación, sí. La consistencia del enlace está reforzada porque los propios agentes hacen `join` por `hypothesis_id` internamente (`experiment_design.py:27-28,63-69`; `success_criteria.py:20,34`).
- **¿Alguno usa otro mecanismo?** Los artefactos por experimento añaden un segundo eje (`experiment_id`), lo que crea una jerarquía natural **hipótesis → experimento → {métrica, criterio, decisión}**.
- **¿Algún artefacto imposible de relacionar?** Sí: **`report`**. Sus campos `riskiest_hypotheses` y `recommended_sequence` son `list[str]` de texto libre, sin `hypothesis_id` (`app/schemas/report.py:13-14`). No es un nodo por-hipótesis; es un resumen global. No pertenece al eje del mapa.

---

## 4. Información disponible en el estado

- **¿Qué ya existe?** El `BlueprintState` declara explícitamente todos los campos: `hypotheses`, `classifications`, `prioritization`, `recommendations`, `metric_specs`, `success_criteria`, `decisions`, `report` (`app/schemas/state.py:28-39`). Todos se serializan a dict/list JSON-safe vía `.model_dump(mode="json")` en cada nodo.
- **¿Qué falta?** Nada para el eje hipótesis-céntrico. La única "ausencia" es de timing, no de datos: los artefactos aguas abajo no existen hasta que el grafo avanza.
- **¿Qué no podría representarse?** El `report` como nodo por-hipótesis (es global y de texto libre). Puede mostrarse como panel aparte, no como hoja del árbol.

---

## 5. Impacto arquitectónico

| Componente | ¿Debe modificarse? |
|---|---|
| LangGraph | No |
| Supervisor | No |
| Runtime | No |
| Checkpointer | No |
| Persistencia | No |
| Pipeline de agentes | No |
| Endpoints actuales | No |

Justificación: no hay ningún "Sí". Todo el dato que el mapa consume ya se produce, se persiste en el checkpointer y se proyecta a `blueprints.state`, y `GET /blueprint/{id}` ya devuelve `bp.state` completo (`app/api/routes/blueprint.py:236`), que es exactamente la salida de `serialize_blueprint` con todos los `ARTIFACT_FIELDS` (`app/api/streaming.py:16-39`). El frontend ya recibe estos mismos artefactos vía SSE (`event: agent_update` con `payload_out["artifacts"]`, `app/api/streaming.py:98-101`).

---

## 6. Responsabilidad por capas

### Backend
- **¿Qué información debería entregar?** La que ya entrega. Ningún endpoint nuevo es necesario.
- **¿La información actual ya es suficiente?** Sí. `GET /blueprint/{id}.blueprint` contiene `hypotheses` + todos los artefactos enlazados por `hypothesis_id`.

### Frontend
El mapa es **exclusivamente** trabajo de presentación:
- Transformar `hypotheses[]` en **Nodes** raíz.
- Indexar `classifications`, `prioritization`, `recommendations`, `metric_specs`, `success_criteria`, `decisions` por `hypothesis_id` (`groupBy`) y crear **Nodes hijos / Edges**.
- Construir el **layout** (árbol jerárquico).
- **Renderizar** el mapa.
- Mostrar el **detalle** de la hipótesis seleccionada.

Todo se resuelve con los datos ya presentes; no requiere lógica de negocio nueva.

---

## 7. Riesgos

- **`report` sin `hypothesis_id`** → referencias por texto libre. Mitigación: tratarlo como panel-resumen, no como nodo del árbol.
- **Datos parciales por timing** → si el mapa se pinta durante un interrupt temprano, las ramas inferiores estarán vacías. No es una referencia rota, es estado incompleto legítimo; el mapa debe renderizar niveles condicionalmente (mostrar solo lo que existe).
- **`hypothesis_id` huérfano tras edición humana** → el usuario puede editar/eliminar hipótesis en el interrupt #1 (`human_hypotheses_node`, `app/agents/supervisor.py:100-123`). Los `classifications`/etc. se generan *después* sobre las hipótesis ya editadas, así que la clave se mantiene consistente; el riesgo real solo aparecería si se re-editaran hipótesis *después* de generar la cadena (no ocurre en el flujo actual). El endpoint ya valida ids únicos y ≥1 hipótesis (`app/api/routes/blueprint.py:43-65`).
- **Cardinalidad N:1** → una hipótesis puede tener varias recomendaciones/métricas (varios `experiment_id`). El layout debe soportar múltiples hijos por nivel, no asumir 1:1.
- **Información duplicada** → ninguna; cada lista es plana y se desnormaliza por `hypothesis_id`.

---

## 8. Compatibilidad

**Sí.** La lista actual de hipótesis puede mantenerse intacta y añadir el mapa encima como vista complementaria. Ambos consumen la misma estructura (`blueprint.hypotheses` + artefactos). Al ser el mapa una proyección de solo lectura sobre datos ya entregados, no interfiere con el flujo `run`/`resume`/`interrupt` existente.

---

## Entregable

### Disponibilidad de información

| Información | Antes del interrupt #1 (review_hypotheses) | Después del resume |
|---|---|---|
| hypotheses | Sí | — |
| problem / customer_segment / value_proposition / business_model | Sí | — |
| research | Sí (si se ejecutó) | — |
| classifications | No | Tras `resume(hypotheses)` (nodo `risk`) |
| prioritization | No | Tras `resume(hypotheses)` (nodo `risk`) |
| recommendations | No | Tras `resume(prioritization)` |
| metric_specs | No | Tras `resume(prioritization)` |
| success_criteria | No | Tras `resume(prioritization)` |
| decisions | No | Tras `resume(prioritization)` |
| report | No | Tras `resume(prioritization)`, al final del grafo |

### Productores

| Información | Agente productor | Ya existe |
|---|---|---|
| Hypotheses | Hypothesis Agent | Sí |
| Classification | Risk Agent | Sí |
| Prioritization | Risk Agent | Sí |
| Experiment Recommendations | Experiment Design Agent | Sí |
| Metric Specs | Metrics Agent | Sí |
| Success Criteria | Success Criteria Agent | Sí |
| Decisions | Decision Agent | Sí |
| Report | Report Agent | Sí (no enlazable por hypothesis_id) |

### Relaciones

| Artefacto | Relación con Hypothesis | Método |
|---|---|---|
| Classification | N:1 | `hypothesis_id` |
| Prioritization | 1:1 | `hypothesis_id` |
| ExperimentRec | N:1 | `hypothesis_id` + `experiment_id` |
| MetricSpec | N:1 | `hypothesis_id` + `experiment_id` |
| SuccessCriterion | N:1 | `hypothesis_id` + `experiment_id` |
| DecisionRule | N:1 | `hypothesis_id` + `experiment_id` |
| Report | No enlazable | texto libre (`list[str]`) |

### Arquitectura recomendada

**Sí**, puede implementarse el mapa visual como una nueva representación del apartado **Hipótesis**, sin modificar LangGraph, Supervisor, Runtime, Checkpointer, Persistencia ni el pipeline de agentes. Evidencia: los artefactos ya se exponen completos vía `GET /blueprint/{id}` (`app/api/routes/blueprint.py:236` → `serialize_blueprint`, `app/api/streaming.py:37-39`) y por SSE (`app/api/streaming.py:98-101`), todos enlazados por `hypothesis_id` en sus schemas (`app/schemas/`).

---

## Conclusión Final

1. **¿La información actual es suficiente para construir el mapa visual?** **Sí**, para el eje hipótesis-céntrico. Todos los artefactos existen y están enlazados por `hypothesis_id` (schemas en `app/schemas/`). Única excepción: `report` (texto libre, tratable como panel aparte).

2. **¿Qué agentes producen la información?** Hypothesis, Risk (clasificación + priorización), Experiment Design, Metrics, Success Criteria, Decision, Report. (Ver §2, con evidencia por línea.)

3. **¿Hace falta modificar algún agente?** **No.**

4. **¿Hace falta modificar LangGraph?** **No.**

5. **¿Hace falta modificar el Supervisor?** **No.**

6. **¿Hace falta modificar la persistencia?** **No.** `GET /blueprint/{id}` ya devuelve el estado completo (`app/api/routes/blueprint.py:236`, `app/api/streaming.py:37-39`).

7. **¿Puede implementarse únicamente agregando una nueva representación visual dentro del apartado Hipótesis, manteniendo intacta la arquitectura actual?** **Sí.** Es puramente trabajo de frontend (Nodes/Edges/layout/render) sobre datos ya expuestos.

**Advertencia operativa clave:** el mapa *completo* (con las 7 capas) solo está disponible cuando el grafo ha avanzado más allá de los interrupts. En el momento exacto de "revisar hipótesis" (interrupt #1) solo existen las hipótesis; el resto se rellena tras cada `resume`. El diseño del mapa debe renderizar las capas **condicionalmente según los campos presentes en el estado**.

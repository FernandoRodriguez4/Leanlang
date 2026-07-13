# Auditoría Rápida: Consumidores de las Hipótesis

## Objetivo

Verificar que eliminar una hipótesis durante la revisión humana no rompa el flujo del sistema, respondiendo: **¿qué componentes consumen `hypotheses` y cómo las utilizan?**

Auditoría de solo lectura. Búsqueda exhaustiva de `hypotheses`, `state["hypotheses"]`, `state.get("hypotheses")` y `BlueprintState.hypotheses` en todo `app/` (fuera de `venv/`).

---

## Inventario completo de coincidencias

### 1. `app/agents/hypotheses.py:13` — `hypotheses_node` (origen, no consumidor)
- Nodo/agente: Hypothesis Agent.
- Solo lee: No (es el origen — no hay `hypotheses` previo que leer).
- Modifica: Escribe `state["hypotheses"]` por primera vez.
- Genera artefacto derivado: N/A (es el artefacto mismo).
- Guarda copia: No aplica.

### 2. `app/agents/supervisor.py:76-77` — `route_entry` (triaje)
```python
if not state.get("hypotheses"):
    return "hypotheses"
```
- Solo lee: Sí, solo comprueba truthiness (`bool([])` es `False`) para decidir si reentra a `hypotheses_node` o avanza a `risk`.
- Modifica: No.
- Genera artefacto derivado: No.
- Guarda copia: No.
- Nota: si el usuario elimina TODAS las hipótesis y de algún modo se re-disparara `route_entry` (no ocurre en el flujo normal post-interrupt, pero es la única lógica que reacciona al *conteo/vacío* de `hypotheses`), volvería a `hypotheses_node`. No es un riesgo del camino normal de edición (`human_hypotheses` → `risk` es un edge fijo, no pasa por `route_entry` de nuevo).

### 3. `app/agents/supervisor.py:100-109` — `human_hypotheses_node`
```python
edited = interrupt({"type": "review_hypotheses", "hypotheses": state.get("hypotheses", [])})
if isinstance(edited, dict) and edited.get("hypotheses"):
    return {"hypotheses": edited["hypotheses"], ...}
return {"messages": [...]}
```
- Solo lee: No.
- Modifica: Sí — es el único nodo que **reemplaza** `state["hypotheses"]` (sobreescritura completa del array si el usuario envía una edición).
- Genera artefacto derivado: No.
- Guarda copia: No (usa el array recibido tal cual).

### 4. `app/agents/risk.py:17-40` — `risk_node`
```python
hyps = state.get("hypotheses", [])
...
HumanMessage(content=f"Clasifica estas hipotesis por tipo y nivel de riesgo:\n\n{jdump(hyps)}")
...
HumanMessage(content=f"Prioriza en el mapa 2x2:\n\n{jdump({'hypotheses': hyps, 'classifications': classifications})}")
```
- Solo lee: Sí.
- Modifica: No.
- Genera artefacto derivado: Sí — `classifications` (`Classification.hypothesis_id: str`) y `prioritization` (`Prioritization.hypothesis_id: str`), ambos **por referencia de id**, no copian el texto (`statement`) de la hipótesis.
- Guarda copia: No — el LLM ve el texto completo momentáneamente (dentro del prompt), pero el schema persistido (`Classification`, `Prioritization`) solo guarda `hypothesis_id`.
- Momento clave: corre **después** de `human_hypotheses_node`, por lo que siempre ve la lista ya editada/confirmada por el usuario (ver diagrama de `build_graph.py`: `hypotheses -> human_hypotheses -> risk`).

### 5. `app/agents/experiment_design.py:21-112` — `_build_candidate_pool` + `experiment_design_node`
```python
hyp_by_id = {h["id"]: h for h in state.get("hypotheses", [])}
...
enriched = [{"hypothesis_id": p["hypothesis_id"], "statement": hyp_by_id.get(p["hypothesis_id"], {}).get("statement", ""), ...} for p in riskiest]
```
- Solo lee: Sí.
- Modifica: No.
- Genera artefacto derivado: Sí — `recommendations` (`ExperimentRec.hypothesis_id: str`), solo referencia de id; **no** persiste el texto de la hipótesis en el schema (`ExperimentRec` no tiene campo `statement`/`hypothesis_statement`).
- Guarda copia: `enriched` es una estructura **transitoria** (vive solo dentro de la función, se usa para construir el prompt del LLM y se descarta — nunca se guarda en `state`).
- Riesgo de `.get(..., {})`: si `hypothesis_id` no está en `hyp_by_id` (por ejemplo, porque esa hipótesis fue eliminada en la edición pero `prioritization`/`classifications` aún la referencian — escenario que hoy no ocurre porque `risk_node` corre después de la edición), `statement` cae a `""` silenciosamente. No hay excepción, pero el prompt quedaría con una hipótesis sin enunciado.

### 6. `app/agents/metrics.py:13-28` — `metrics_node`
```python
context = {"hypotheses": state.get("hypotheses", []), "recommendations": state.get("recommendations", [])}
```
- Solo lee: Sí (contexto completo del LLM).
- Modifica: No.
- Genera artefacto derivado: Sí — `metric_specs` (`MetricSpec.hypothesis_id: str`), solo id.
- Guarda copia: No.

### 7. `app/agents/success_criteria.py:19-66` — `_assemble_test_cards` + `success_criteria_node`
```python
hyp_by_id = {h["id"]: h for h in state.get("hypotheses", [])}
...
cards.append({..., "hypothesis_statement": hyp_by_id.get(r.get("hypothesis_id"), {}).get("statement", ""), ...})
```
- Solo lee: Sí.
- Modifica: No.
- Genera artefacto derivado: Sí — `success_criteria` (`SuccessCriterion.hypothesis_id: str`, solo id) **y** `test_cards` (`TestCard.hypothesis_statement: str`, `app/schemas/testcard.py:15`).
- Guarda copia: **Sí — es el único punto donde el TEXTO de la hipótesis (`statement`) se copia de forma permanente a otro artefacto del state** (`test_cards[i].hypothesis_statement`). A partir de aquí, `test_cards` vive como una copia independiente; si la hipótesis original cambiara después, `test_cards` no se actualizaría (pero en el flujo actual esto no puede pasar, porque la edición de hipótesis ya ocurrió antes, en `human_hypotheses_node`).

### 8. `app/agents/decision.py:13-29` — `decision_node`
```python
context = {"hypotheses": state.get("hypotheses", []), "recommendations": ..., "success_criteria": ...}
```
- Solo lee: Sí.
- Modifica: No.
- Genera artefacto derivado: Sí — `decisions` (`DecisionRule.hypothesis_id: str`, solo id).
- Guarda copia: No.

### 9. `app/agents/critic.py:13-39` — `critic_node`
```python
blueprint = {"hypotheses": state.get("hypotheses", []), "classifications": ..., "prioritization": ..., ...}
```
- Solo lee: Sí (contexto de auditoría del LLM).
- Modifica: No.
- Genera artefacto derivado: `critic_review` (`CriticReview`: `quality_score`, `passed`, `issues`, `summary`) — **no** referencia `hypothesis_id` ni copia texto de hipótesis en su schema (`app/schemas/testcard.py:33-46`).
- Guarda copia: No.

### 10. `app/agents/report.py:13-37` — `report_node`
```python
blueprint = {..., "hypotheses": state.get("hypotheses", []), ...}
```
- Solo lee: Sí.
- Modifica: No.
- Genera artefacto derivado: Sí — `report.riskiest_hypotheses: list[str]` (`app/schemas/report.py:13`), texto libre generado por el LLM (paráfrasis, no ids).
- Guarda copia: **Sí, en texto libre** — el LLM decide qué "hipótesis más riesgosas" mencionar y las redacta como strings sueltos, sin vínculo estructural (`id`) a la lista original. Es la copia menos trazable de todas (no hay forma programática de saber a qué `hypothesis_id` corresponde cada string).

### 11. `app/api/routes/export.py:17-119` (`_to_markdown`) y `:42`
```python
hyps = {h["id"]: h for h in bp.get("hypotheses", [])}
```
- Solo lee: Sí, y lo hace **directamente sobre `bp.state`** (la proyección persistida), en el momento del `GET /blueprint/{id}/export` — no sobre el `BlueprintState` del grafo.
- Modifica: No.
- Genera artefacto derivado: Genera el Markdown/JSON de salida (no persistido, se sirve on-the-fly en la respuesta HTTP).
- Guarda copia: No — se recalcula en cada request de export.

### 12. `app/eval/rubric.py:33-42` — `_hypotheses_quality` (fuera del grafo, arnés de evaluación offline)
```python
hyps = bp.get("hypotheses", [])
if not hyps: return 0.0
score += 0.4 if len(hyps) >= 6 else len(hyps) / 6 * 0.4
testable = sum(1 for h in hyps if h.get("statement", "").lower().startswith("creemos"))
score += 0.3 * (testable / len(hyps))
score += 0.3 if any(h.get("is_counter_hypothesis") for h in hyps) else 0.0
```
- Solo lee: Sí.
- Modifica: No.
- Genera artefacto derivado: Un puntaje 0..1 (`hypotheses_quality`) usado solo por `app/eval/run_eval.py` (arnés de evaluación de la tesis) y `tests/test_rubric.py` — **no forma parte del grafo LangGraph ni de ningún endpoint HTTP de producción** (`build_graph.py` no lo importa).
- Guarda copia: No.
- Riesgo: es la única función de todo el repo con una fórmula sensible a la **cantidad** de hipótesis (`len(hyps) >= 6`), pero es un umbral de puntaje suave (no bloquea nada, no lanza excepción, nunca corre en el path de `POST /run` o `POST /resume`), y no exige ningún número exacto — solo pondera mejor a partir de 6.

---

## Verificaciones específicas

### 1. ¿Existe algún nodo que haga una copia permanente de las hipótesis?

Sí, dos casos, ambos parciales (no copian el array completo, solo campos puntuales) y ambos ocurren **después** del único punto de edición (`human_hypotheses_node`):

- `success_criteria.py:36` → `test_cards[i].hypothesis_statement` (copia del texto `statement`, por `hypothesis_id`).
- `report.py` → LLM produce `report.riskiest_hypotheses: list[str]` (paráfrasis libre, sin vínculo por id).

No existe ningún `artifacts.hypotheses`, `risk.hypotheses` ni `experiment.hypotheses` como tal — los nombres de ejemplo del objetivo no corresponden a estructuras reales del repo. Todos los demás artefactos (`classifications`, `prioritization`, `recommendations`, `metric_specs`, `success_criteria`, `decisions`) solo guardan `hypothesis_id` (referencia), no una copia de la hipótesis.

### 2. ¿Existe algún nodo que dependa de la posición del array?

**No.** No se encontró ningún `hypotheses[0]`, `hypotheses[N]`, `enumerate(hypotheses...)` ni mapeo por índice en ningún archivo de `app/`. Todo acceso es por **id** (`h["id"]`, `hypothesis_id`), vía diccionarios `{h["id"]: h for h in ...}` construidos en caliente en cada nodo (`experiment_design.py:62`, `success_criteria.py:24`, `export.py:42`). El `id` (`"h1"`, `"h2"`, ...) lo asigna el LLM en `hypotheses_node`, es un string arbitrario, no una posición de array ni una PK de base de datos.

### 3. ¿Existe alguna validación que espere exactamente 11 hipótesis?

**No.** No hay `len(hypotheses) == 11`, ni mínimo/máximo obligatorio en código, en ningún archivo de `app/`. Lo único relacionado con cantidad:
- El prompt `HYPOTHESES_SYSTEM` (`app/agents/prompts/__init__.py:68`) instruye al LLM: *"Genera entre 6 y 12 hipotesis"* — un rango orientativo para el LLM, no una validación de código; "11" (visto en auditorías previas) fue simplemente el resultado de una corrida concreta, no un número fijado en ningún esquema (`HypothesisList` no tiene `min_length`/`max_length` en `app/schemas/hypothesis.py:26-27`).
- `app/eval/rubric.py:38` usa `len(hyps) >= 6` como umbral de puntaje suave, offline, fuera del grafo — no bloquea ni valida nada del flujo de producción.

### 4. ¿Los agentes posteriores consumen siempre el estado actual?

**Sí.** Todos los nodos posteriores a `human_hypotheses_node` (`risk`, `experiment_design`, `metrics`, `success_criteria`, `decision`, `critic`, `report`) leen `state.get("hypotheses", [])` **directamente del `BlueprintState` recibido como argumento en cada invocación de nodo** — nunca de una variable capturada de una ejecución anterior, nunca de un caché externo. Como LangGraph pasa el estado actualizado (post-`human_hypotheses_node`) a cada nodo siguiente en la topología (`app/graph/build_graph.py:93-96`), y ningún nodo posterior vuelve a tocar `hypotheses` (ninguno lo escribe de nuevo), todos ven exactamente el mismo array — el que resultó de la revisión humana — de forma consistente entre sí.

Adicionalmente, **todo acceso usa `.get("hypotheses", [])` con default seguro** (no se encontró ningún `state["hypotheses"]` con corchetes directos en `app/`) — si el array quedara vacío tras eliminar todas las hipótesis, ningún nodo lanzaría `KeyError`; simplemente procesarían una lista vacía (p. ej. `risk_node` pediría al LLM clasificar `[]`, `experiment_design_node` caería a su rama de fallback `risk_types = {"desirability"}` en `experiment_design.py:36-37`).

---

## Tabla resumen

| Nodo / Agente | Solo lee | Modifica | Guarda copia | Genera artefacto | Riesgo |
|---|---|---|---|---|---|
| `hypotheses_node` (origen) | — | Escribe por primera vez | — | Es el artefacto | Ninguno (no es consumidor) |
| `route_entry` (supervisor) | Sí (solo truthiness) | No | No | No | Bajo — no usa contenido, solo vacío/no-vacío |
| `human_hypotheses_node` | No | **Sí (reemplazo completo)** | No | No | Ninguno — es el punto de edición legítimo |
| `risk_node` | Sí | No | No | `classifications`, `prioritization` (por id) | Bajo — corre después de la edición |
| `experiment_design_node` | Sí | No | No (transitorio, no persistido) | `recommendations` (por id) | Bajo — `.get(..., {})` degrada a `""` si el id no existe, sin excepción |
| `metrics_node` | Sí | No | No | `metric_specs` (por id) | Bajo |
| `success_criteria_node` | Sí | No | **Sí — `test_cards[].hypothesis_statement`** | `success_criteria` (por id), `test_cards` (con texto copiado) | Bajo — copia hecha después de la edición, no reversible pero no depende de eliminación futura |
| `decision_node` | Sí | No | No | `decisions` (por id) | Bajo |
| `critic_node` | Sí | No | No | `critic_review` (sin refs a id) | Bajo |
| `report_node` | Sí | No | **Sí — `report.riskiest_hypotheses` (texto libre)** | `report` | Bajo — texto libre generado al final del flujo, ya sobre el estado final |
| `export._to_markdown` (HTTP) | Sí (sobre `bp.state`) | No | No (recalculado por request) | Markdown/JSON de exportación | Ninguno |
| `eval.rubric._hypotheses_quality` (offline) | Sí | No | No | Puntaje de calidad (fuera del grafo) | Ninguno para producción — no corre en `POST /run`/`resume` |

---

## Conclusión

1. **¿Todos los agentes consumen el estado actual de `hypotheses`?**
   Sí. Todos leen `state.get("hypotheses", [])` en el momento de su propia ejecución dentro del grafo LangGraph; ninguno usa una copia cacheada de una ejecución previa. El único artefacto de exportación externo al grafo (`export._to_markdown`) también lee el estado más reciente, directamente de `bp.state` (la proyección persistida), en el momento del request.

2. **¿Existe alguna copia persistente de las hipótesis distinta del `BlueprintState`?**
   No existe una copia del array completo. Existen dos copias **parciales** de campos puntuales, ambas generadas después del único punto de edición humana: `test_cards[].hypothesis_statement` (texto exacto, ligado a un `hypothesis_id`) y `report.riskiest_hypotheses` (texto libre, sin id). Ninguna vive fuera del propio `BlueprintState`/`blueprints.state` — no hay tabla ni caché externa.

3. **¿Existe alguna dependencia de la posición o de que existan exactamente 11 hipótesis?**
   No. Cero dependencias por índice de array (todo es por `id` string). Cero validaciones de conteo exacto en el código de producción; el único número fijo (11) fue una observación empírica de una corrida, no una regla del sistema. El único código sensible a la *cantidad* es un umbral suave (`>= 6`) en un arnés de evaluación offline (`app/eval/rubric.py`) que no participa del flujo `POST /run`/`POST /resume`.

4. **¿Puede eliminarse una hipótesis durante la revisión sin romper el contexto de los siguientes agentes?**
   Sí, estructuralmente el código lo soporta: como la edición ocurre en `human_hypotheses_node` — antes de que cualquier otro nodo lea o derive algo de `hypotheses` — todos los consumidores posteriores (`risk`, `experiment_design`, `metrics`, `success_criteria`, `decision`, `critic`, `report`) verían directamente el array ya reducido, sin ninguna referencia colgante a un `hypothesis_id` eliminado (porque `classifications`/`prioritization`/`recommendations`/etc. se generan *después* de la edición, a partir de la lista ya editada, no antes). El uso universal de `.get(..., default)` en vez de indexado directo hace que, incluso en el caso extremo de eliminar todas las hipótesis, ningún nodo lance una excepción — el peor caso observado es degradación silenciosa (campos vacíos, listas vacías, fallback a un tipo de riesgo por defecto en `experiment_design.py:36-37`).

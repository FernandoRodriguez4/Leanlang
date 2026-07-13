# Estrategia de Rediseño — Lienzo Lean y Modelo de Negocio

> **Rol:** Principal Product Designer · Senior UX Architect · Staff Frontend Engineer.
> **Naturaleza:** documento **estratégico**, no técnico ni de implementación. No contiene código, componentes, tecnologías, wireframes ni mockups.
> **Fuentes de verdad (únicas):**
> - `AUDITORIA_UX_LIENZO_Y_MODELO_NEGOCIO.md` (auditoría UX) → citada como **[UX §n]**
> - `audit_rediseno_lienzo_modelo_negocio.md` (auditoría técnica) → citada como **[TEC §n]**
> - No se re-audita ni se cuestionan sus conclusiones; se transforman en hoja de ruta.
> **Fecha:** 2026-07-11

---

## Marco de partida (síntesis de las dos auditorías)

Dos conclusiones de las auditorías gobiernan toda esta estrategia y explican por qué es viable:

1. **El rediseño es de riesgo Muy Bajo a nivel de sistema.** El contrato Backend→Frontend es JSON tipado y fijo, la generación de contenido y la presentación ya están separadas, y ninguna opción de reorganización visual toca agentes, grafo ni contrato **[TEC §8, §11, §12]**. El único acoplamiento fuerte es de *nombres* de campo, no de presentación **[TEC §7]**.

2. **El problema UX está localizado y bien diagnosticado.** No es la navegación (por estaciones, ya resuelta), sino el interior de la estación "Lienzo", que vuelca VPC (15 campos) + BMC (7 bloques) simultáneamente, completos y con peso visual uniforme; el Progressive Disclosure existe a nivel macro pero se abandona ahí dentro **[UX §12, §15 P10]**. Además, la propia app **ya contiene un patrón de referencia en materia de jerarquía de información y Progressive Disclosure: el panel "Resumen"**, cuyos principios —no su estructura literal— deben inspirar la evolución del Lienzo **[UX §11, §13]**.

**Tesis estratégica:** *evolucionar el Lienzo/BMC llevando a su interior la lógica "resumen → detalle" que la app ya aplica a nivel macro, reordenando por prioridad de decisión y graduando la exposición de la información — todo sobre los datos que ya llegan estructurados, sin tocar el sistema.*

---

## Visión

El rediseño del Lienzo Lean y del Modelo de Negocio no persigue reducir la cantidad de información disponible para el usuario, sino resolver el momento y la forma en que esa información se presenta. Todo lo que hoy exponen el VPC y el BMC seguirá estando disponible; lo que cambia es la secuencia y la graduación con que se revela, de modo que el usuario acceda primero a lo que le permite comprender y decidir, y solo después —si lo necesita— al detalle completo.

Este principio de mostrar *la información correcta en el momento correcto* es el criterio que gobierna cada una de las fases siguientes: prioriza qué se ve primero, no qué se elimina; organiza el detalle en niveles de profundidad, no lo descarta; y toma como inspiración los patrones de jerarquía y revelación progresiva que la propia aplicación ya utiliza con éxito en otras estaciones.

---

## Fuera del alcance

Esta estrategia es exclusivamente de **experiencia de usuario y presentación**. Explícitamente, quedan fuera de su alcance y no se ven afectados por ninguna de las fases siguientes:

- Los **agentes** y su lógica de razonamiento.
- Los **prompts** utilizados por los agentes.
- **LangGraph** y el **flujo del grafo** de ejecución.
- El **backend** en general.
- Los **contratos Backend → Frontend** (nombres de campo, forma y tipado del JSON).
- Los **schemas** de datos.
- La **arquitectura** del sistema.
- El **contenido generado por IA** (redacción, alcance o profundidad de lo que los agentes producen).
- El **pipeline de generación**.
- El **estado compartido** de la aplicación.

Cualquier cambio a alguno de estos elementos queda fuera del propósito de este documento y, de ser necesario, debe abordarse mediante un proceso de decisión independiente.

---

## Fase 0 — Principios de diseño

Principios rectores (cada uno anclado a evidencia). Gobiernan todas las decisiones posteriores; ninguno prescribe componentes.

| # | Principio | Justificación |
|---|-----------|---------------|
| P-1 | **Comprensión antes que exhaustividad.** Mostrar primero lo que permite decidir, no todo lo disponible. | La carga cognitiva Alta/Muy Alta del Lienzo nace de mostrarlo todo a la vez **[UX §1, §15 P1]**. |
| P-2 | **Jerarquía por prioridad de decisión, no por convención del framework.** El orden lo dicta el valor para decidir, no la disposición canónica del VPC/BMC. | Diferenciador, ingresos y costos quedan relegados al final por seguir la convención **[UX §6, §9]**. |
| P-3 | **Progressive Disclosure también dentro de las tarjetas**, no solo entre estaciones. | El principio hoy se aplica al macro y se abandona en el Lienzo **[UX §12]**. |
| P-4 | **Una sola fuente de verdad.** La presentación deriva del artefacto; nunca se copia ni se recalcula contenido en paralelo. | El riesgo real del rediseño es introducir una 2ª fuente de verdad **[TEC §9, §10]**. |
| P-5 | **No alterar el flujo de agentes ni el contenido generado.** El rediseño es 100% de presentación. | La generación es indiferente a la UI; la separación ya existe **[TEC §11]**. |
| P-6 | **Preservar la separación contenido/presentación.** No trasladar lógica de presentación al backend. | Mantener la frontera limpia evita acoplar backend a la UI **[TEC §7, §10 Opción 3]**. |
| P-7 | **Consistencia con los patrones que ya funcionan.** El "Resumen" es la referencia interna de jerarquía de información y Progressive Disclosure; sus principios deben inspirar al Lienzo, adaptados a la naturaleza de su propio contenido — no copiar su estructura literal. | Es el patrón mejor valorado de la app **[UX §11, §13]**. |
| P-8 | **Robustez ante los nombres de campo.** Respetar las claves del contrato; todo cambio de nombre exige coordinación explícita. | Renombrar un campo hace desaparecer bloques de la UI sin error visible **[TEC §6, §9, §12]**. |
| P-9 | **Reducir redundancia percibida.** Vincular conceptos emparejados en vez de repetirlos sueltos. | Dolor↔alivio y ganancia↔creación se muestran duplicados y desconectados **[UX §7]**. |
| P-10 | **Cambios graduales y reversibles.** De menor a mayor impacto, cada paso con rollback. | El riesgo es bajo pero se gestiona por incrementos **[TEC §9]**. |

---

## Fase 1 — Priorización de la información

Clasificación de exposición por campo: **Siempre visible** · **Visible inicialmente** · **Visible bajo demanda** · **Solo vista detallada**. Base: importancia de campo **[UX §6]** y resumibilidad **[UX §10]**.

### Problema
| Campo | Clasificación | Justificación (evidencia) |
|-------|--------------|---------------------------|
| `statement` | **Siempre visible** | Crítico; sin él no hay idea **[UX §6]**. |
| `pains` | **Visible inicialmente** (primeros ~3) | Importante; justifica urgencia; lista resumible **[UX §6, §10]**. |
| `customer_jobs` | **Visible inicialmente** (primeros ~3) | Importante; define qué busca el cliente **[UX §6]**. |
| `context` | **Visible bajo demanda** | Complementario; hoy ocupa posición privilegiada indebida **[UX §6, §9]**. |
| `root_causes` | **Solo vista detallada** | Complementario/detalle; útil para diseñar, no para comprender **[UX §6, §10]**. |

### Segmento
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `name` | **Siempre visible** | Crítico; identifica a quién servimos **[UX §6]**. |
| `early_adopters` | **Visible inicialmente** | Importante para saber por dónde validar; hoy queda al final **[UX §6, §9]**. |
| `description` | **Visible inicialmente** | Importante; aclara el segmento **[UX §6]**. |
| `gains` | **Visible bajo demanda** (primeros ~3) | Complementario; se solapa con `gain_creators` **[UX §6, §7]**. |
| `characteristics` | **Solo vista detallada** | Detalle demográfico/conductual **[UX §6, §10]**. |

### Propuesta de Valor
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `statement` | **Siempre visible** | Crítico **[UX §6]**. |
| `differentiator` | **Siempre visible** | Crítico; es el "por qué gana"; hoy va último y tenue **[UX §6, §9, §13]**. |
| `pain_relievers` | **Visible inicialmente** (primeros ~3) | Importante; conecta con `pains` **[UX §6]**. |
| `gain_creators` | **Visible inicialmente** (primeros ~3) | Importante; conecta con `gains` **[UX §6]**. |
| `products_services` | **Visible bajo demanda** | Complementario; el "qué" tangible **[UX §6, §10]**. |

### Modelo de Negocio (BMC)
| Bloque | Clasificación | Justificación |
|--------|--------------|---------------|
| `revenue_streams` (Ingresos) | **Siempre visible** | Crítico; la viabilidad depende de cómo se cobra; hoy 6º **[UX §5, §6]**. |
| `cost_structure` (Costos) | **Siempre visible** | Crítico/importante; hoy 7º y último **[UX §6]**. |
| `channels` (Canales) | **Visible inicialmente** | Importante; cómo se llega/entrega **[UX §6]**. |
| `key_activities` | **Visible inicialmente** | Importante; núcleo de factibilidad **[UX §6]**. |
| `key_resources` | **Visible bajo demanda** | Complementario **[UX §6, §10]**. |
| `key_partners` | **Solo vista detallada** | Complementario; depende del modelo **[UX §6, §10]**. |
| `customer_relationships` | **Solo vista detallada** | Complementario/detalle **[UX §6, §10]**. |

---

## Fase 2 — Estrategia de lectura

Objetivo: el orden lo dicta la **prioridad de decisión**, no la convención del framework **[Principio P-2; UX §9]**.

| Sección | Orden actual | Problema detectado | Orden recomendado | Justificación |
|---------|-------------|--------------------|--------------------|---------------|
| **Problema** | statement → context → jobs → pains → root_causes | `context` interrumpe entre el problema y su dolor **[UX §9]** | statement → pains → jobs → (context) → (root_causes) | El dolor debe seguir al problema; el contexto es complementario **[UX §6, §9]**. |
| **Segmento** | name → description → characteristics → gains → early_adopters | `early_adopters` (accionable) llega tras `characteristics` (detalle) **[UX §9]** | name → description → early_adopters → gains → (characteristics) | Adelantar lo accionable, posponer el detalle **[UX §6, §9]**. |
| **Propuesta de Valor** | statement → products_services → pain_relievers → gain_creators → differentiator | El diferenciador (Crítico) va último y tenue **[UX §9, §13]** | statement → differentiator → pain_relievers → gain_creators → (products_services) | Acercar el diferenciador al statement **[UX §6, §9]**. |
| **Modelo de Negocio** | partners → activities → resources → channels → relationships → revenue → cost | Ingresos (6º) y Costos (7º) son Críticos pero van al final **[UX §6, §9]** | revenue → cost → channels → activities → (resources) → (partners) → (relationships) | Ordenar por valor de decisión, no por el canvas físico **[UX §6, §9]**. |

> **Nota de robustez:** reordenar es reorganización de presentación sobre datos ya estructurados; no cambia nombres de campo, por lo que no afecta el contrato **[TEC §6, §8]**.

---

## Fase 3 — Estrategia de Progressive Disclosure

Tres niveles de información, alineados con la clasificación de la Fase 1. Extienden al interior del Lienzo el principio que la app ya aplica entre estaciones **[UX §12; Principio P-3]**.

| Nivel | Contenido | Propósito | Campos que lo pueblan |
|-------|-----------|-----------|------------------------|
| **Nivel 1 — Indispensable** | Titulares + lo crítico para decidir | Comprensión en segundos | `problem.statement`, `segment.name`, `value_proposition.statement`, `value_proposition.differentiator`, `revenue_streams`, `cost_structure` |
| **Nivel 2 — Importante** | Lo que contextualiza la decisión, en forma acotada (primeros N) | Profundizar sin abrumar | `pains`, `customer_jobs`, `early_adopters`, `description`, `pain_relievers`, `gain_creators`, `channels`, `key_activities` |
| **Nivel 3 — Completo** | Todo el detalle y los complementos | Exploración a demanda / vista detallada | `context`, `root_causes`, `characteristics`, `products_services`, `gains`, `key_resources`, `key_partners`, `customer_relationships`, y las listas completas del Nivel 2 |

**Regla de gradualidad:** el Nivel 1 es la vista de entrada; el Nivel 2 se muestra acotado; el Nivel 3 vive bajo demanda. Ningún nivel duplica datos: son proyecciones del mismo artículo **[Principio P-4; TEC §10]**.

---

## Fase 4 — Estrategia de resumen

Qué hacer con cada tipo de información **[UX §10; TEC §10]**:

| Categoría | Campos | Decisión estratégica |
|-----------|--------|----------------------|
| **Nunca resumir** | `statement` (problema y propuesta), `differentiator`, `name`, `revenue_streams`, `cost_structure` | Son la esencia y el eje de viabilidad; deben verse completos **[UX §10; UX §6]**. |
| **Puede resumirse** | `context`, `description` | Prosa complementaria; admite forma condensada **[UX §10]**. |
| **Mostrarse parcialmente (primeros N)** | `pains`, `customer_jobs`, `gains`, `pain_relievers`, `gain_creators` | Listas cuyo valor está en los primeros ítems; el resto a demanda **[UX §10]**. |
| **Ocultarse inicialmente** | `root_causes`, `characteristics`, `products_services`, `key_resources`, `key_partners`, `customer_relationships` | Comprensión intacta sin ellos en la vista inicial **[UX §10, §15 P8]**. |

**Fuente del resumen (decisión estratégica, no de implementación):** priorizar **no crear resúmenes nuevos**. Dos vías sin tocar el sistema **[TEC §10]**:
- Para la *vista ejecutiva*: **reutilizar el artefacto `report` ya generado** (`executive_summary`, `problem_summary`, `value_proposition_summary`), que existe en el contrato **[TEC §10 Opción 2, §8]**.
- Para las tarjetas: **derivar en presentación** (mostrar `statement` + primeros N ítems), sin campo nuevo ni cambio de contrato **[TEC §10 Opción 4/5]**.
- **Evitar** resumen en backend o campo nuevo en schema, salvo decisión de producto posterior: rompería la separación limpia o el contrato **[TEC §10 Opción 1/3, §11]**.

---

## Fase 5 — Estrategia del Modelo de Negocio (BMC)

Análisis exclusivo del BMC, el segundo cuello de botella y el de jerarquía más plana **[UX §1, §4, §11]**.

| Bloque | Criticidad | Prioridad visual | Prioridad de decisión | Justificación |
|--------|-----------|------------------|-----------------------|---------------|
| `revenue_streams` (Ingresos) | **Crítico** | Máxima | Máxima | Determina la viabilidad; hoy en 6ª posición **[UX §5, §6, §9]**. |
| `cost_structure` (Costos) | **Crítico/Importante** | Máxima | Máxima | El otro lado de la viabilidad; hoy última **[UX §6, §9]**. |
| `channels` (Canales) | **Importante** | Alta | Alta | Cómo se llega y entrega **[UX §6]**. |
| `key_activities` | **Importante** | Alta | Media-alta | Núcleo de la factibilidad **[UX §6]**. |
| `key_resources` | **Complementario** | Media | Media | Recursos de soporte **[UX §6]**. |
| `key_partners` | **Complementario** | Baja | Baja-media | Depende del modelo **[UX §6]**. |
| `customer_relationships` | **Complementario/Detalle** | Baja | Baja | Menos decisivo al inicio **[UX §6]**. |

**Conclusión de fase:** el BMC debe dejar de presentarse como **rejilla plana de 7 bloques equivalentes** **[UX §4, §12]** y pasar a una lectura de **dos bloques críticos primero (Ingresos/Costos) → importantes → complementarios a demanda**. Es reordenar y graduar exposición; no cambia el contenido ni las claves **[TEC §6, §8]**.

---

## Fase 6 — Estrategia de reducción de carga cognitiva

Principios operativos (sin implementación) para atacar cada fuente de contaminación identificada **[UX §1, §2, §15 P1]**:

| Palanca | Principio estratégico | Hallazgo que ataca |
|---------|-----------------------|--------------------|
| **Lectura** | Un solo nivel de lectura en la vista de entrada (titulares + crítico). | Esfuerzo de lectura Difícil en Lienzo/BMC **[UX §14]**. |
| **Scrolling** | La vista inicial cabe sin recorrer los dos frameworks completos. | Lienzo completo = 2–3 viewports (5–6 en móvil) **[UX §3]**. |
| **Redundancia** | Vincular conceptos emparejados (dolor↔alivio, ganancia↔creación) en vez de repetirlos sueltos. | Redundancia media, conceptos duplicados sin conexión visual **[UX §7]**. |
| **Densidad visual** | Limitar la cantidad de chips simultáneos (primeros N + resto a demanda). | ~40–70 chips en 15 listas **[UX §2, §8]**. |
| **Esfuerzo cognitivo** | Jerarquía de al menos 3 niveles dentro de cada tarjeta (hoy hay 2, o 1 en BMC). | Jerarquía débil/plana **[UX §4]**. |
| **Información simultánea** | No mostrar VPC completo + BMC completo en el mismo golpe de vista. | Carga Muy Alta al ver todo junto **[UX §1]**. |

Meta cuantitativa cualitativa: que la estación "Lienzo" se **perciba como dashboard** (como el Resumen) y no como planilla/documento **[UX §2, §15 P10]**.

---

## Fase 7 — Estrategia de consistencia

Comparación del Lienzo con las demás estaciones para identificar qué reutilizar y qué corregir **[UX §11, §12, §13]**.

**Patrones que YA funcionan (a preservar):**
- **Resumen (`OverviewPanel`)**: titular + acceso al detalle, semáforo, KPIs como puertas a profundidad. Constituye la **referencia interna de jerarquía de información y Progressive Disclosure** **[UX §11, §13]**.
- **Navegación por estaciones**: revelación gradual según disponibilidad de datos; Progressive Disclosure macro bien resuelto **[UX §12]**.
- **Bitácora colapsable de agentes**: disclosure a demanda ya presente **[UX §12]**.

**Principios que DEBERÍAN inspirar al Lienzo/BMC (sin copiar la estructura del Resumen):**
- La lógica **"titular → detalle bajo demanda"** que el Resumen aplica, adaptada a la naturaleza propia del contenido del VPC y el BMC — no trasladada de forma literal **[Principio P-7; UX §11]**.
- El principio de **jerarquía tipográfica y de color por importancia** que el Resumen aplica a KPIs y estado, reinterpretado para los campos y bloques del Lienzo.
- El principio de **"acceso profundo" (jump)** para pasar de una vista condensada a la vista completa, adaptado a la forma que tome cada tarjeta.

**Inconsistencias a eliminar:**
- El Lienzo abandona el Progressive Disclosure que el resto de la app respeta **[UX §12]** → **inconsistencia central**.
- La jerarquía plana del BMC contradice la jerarquía clara del Resumen **[UX §4]**.
- El orden por convención (framework) en el Lienzo contradice el orden por prioridad de decisión del Resumen **[UX §6, §9]**.

---

## Fase 8 — Roadmap estratégico

Todas las mejoras, ordenadas por impacto/riesgo. El riesgo sistémico global es Muy Bajo **[TEC §9]**; la priorización distingue por impacto UX y esfuerzo relativo.

**Cadena de dependencias entre prioridades:** el roadmap no son cuatro bloques independientes, sino una secuencia acumulativa. **P2 depende de P1** porque graduar listas y reestructurar el BMC (P2) presupone que ya exista un marco de niveles y un orden por prioridad de decisión (P1) sobre el cual aplicarse. **P3 depende de P2** porque vincular pares redundantes y ofrecer una vista ejecutiva solo aportan valor una vez que la información ya está graduada y no compite por atención con el resto del Lienzo. **P4 depende de P3 cuando corresponde**: la vista detallada completa (P4.a) presupone P1–P2 consolidadas y se beneficia de que P3 ya haya resuelto la vinculación de pares y la vista ejecutiva antes de exponer el detalle exhaustivo; la salvaguarda de nombres de campo (P4.b), en cambio, es una política de proceso independiente del resto del roadmap y puede adoptarse en paralelo. Esta cadena no altera el orden de prioridades P1–P4; solo hace explícito por qué ese orden es también un orden de ejecución.

### P1 — Impacto muy alto · Riesgo muy bajo
- **P1.a — Reordenar campos por prioridad de decisión** (VPC y BMC), en especial subir `differentiator`, `early_adopters`, `revenue_streams`, `cost_structure`.
  - *Motivo:* corrige el hallazgo de orden inverso al valor **[UX §6, §9]**.
  - *Dependencia:* ninguna; sólo reorganización de presentación **[TEC §6]**. Es la base sobre la que se apoyan P2–P4.
  - *Beneficio:* descubrimiento inmediato de lo decisivo; mejora la toma rápida de decisiones **[UX §5, §15 P9]**.
- **P1.b — Introducir Nivel 1 (titulares + crítico) como vista de entrada del Lienzo.**
  - *Motivo:* la carga cognitiva nace de mostrarlo todo a la vez **[UX §1, §12]**.
  - *Dependencia:* clasificación de la Fase 1/3; ninguna dependencia externa a P1.
  - *Beneficio:* reduce densidad y percepción de "documento" **[UX §2]**.

### P2 — Impacto alto · Riesgo bajo
- **P2.a — Graduar listas (primeros N + resto a demanda)** en `pains`, `jobs`, `gains`, `pain_relievers`, `gain_creators`.
  - *Motivo:* ~40–70 chips simultáneos **[UX §2, §8]**.
  - *Dependencia:* **P2 depende de P1** — específicamente de P1.b (marco de niveles): sin un Nivel 1 definido no hay "resto" que graduar a demanda.
  - *Beneficio:* menos scrolling y densidad **[UX §3]**.
- **P2.b — Reestructurar el BMC de rejilla plana a jerarquía Ingresos/Costos-primero.**
  - *Motivo:* jerarquía plana + bloques críticos enterrados **[UX §4, §5]**.
  - *Dependencia:* Fase 5, y de **P1.a**: reestructurar el BMC presupone ya haber corregido su orden de exposición.
  - *Beneficio:* viabilidad legible de un vistazo **[UX §5]**.

### P3 — Impacto medio
- **P3.a — Vincular pares dolor↔alivio y ganancia↔creación** para eliminar redundancia percibida.
  - *Motivo:* conceptos duplicados sin conexión visual **[UX §7]**.
  - *Dependencia:* **P3 depende de P2** — en particular de P2.a: vincular pares solo es legible una vez que las listas asociadas ya están graduadas y no compiten por atención.
  - *Beneficio:* el usuario ve el "encaje" que el sistema ya modela **[UX §7]**.
- **P3.b — Vista ejecutiva del Lienzo reutilizando el artefacto `report`.**
  - *Motivo:* ofrecer resumen redactado sin crear fuente nueva **[TEC §10 Opción 2]**.
  - *Dependencia:* que exista `report` en el estado (etapa final del pipeline) **[TEC §3, §10]**; conceptualmente sigue a P2 por tratarse de una capa de resumen adicional sobre un Lienzo ya graduado, aunque no requiere P2.b para funcionar.
  - *Beneficio:* "vista ejecutiva + vista completa" sin tocar backend **[TEC §8]**.

### P4 — Mejoras futuras
- **P4.a — Vista detallada / exploración completa** (Nivel 3) como modo aparte.
  - *Motivo:* preservar acceso a todo el detalle para usuarios avanzados **[UX §10, §15 P8]**.
  - *Dependencia:* **P4 depende de P3 cuando corresponde** — presupone P1–P2 consolidadas, y se beneficia de que P3 ya haya resuelto la vinculación de pares y la vista ejecutiva antes de exponer el detalle exhaustivo.
  - *Beneficio:* exhaustividad sin penalizar la comprensión inicial **[Principio P-1]**.
- **P4.b — Salvaguarda de robustez ante nombres de campo** (proceso de coordinación cuando el backend renombre claves).
  - *Motivo:* renombrar un campo vacía bloques de la UI sin error **[TEC §6, §9, §12]**.
  - *Dependencia:* política de equipo, no de UI; a diferencia de P4.a, no depende de P1–P3 y puede adoptarse en paralelo con cualquier prioridad.
  - *Beneficio:* evita regresiones silenciosas.

---

## Fase 9 — Riesgos por fase

| Fase | Complejidad | Riesgo | Dependencias | Impacto esperado | Rollback |
|------|-------------|--------|--------------|------------------|----------|
| **F0 Principios** | Muy baja | Ninguno | — | Alinea decisiones | N/A |
| **F1 Priorización** | Baja | Muy bajo | — | Base de todas las fases | Trivial (documento) |
| **F2 Lectura (reorden)** | Baja | Muy bajo | F1 | Alto (descubrimiento) | Total: reorden reversible **[TEC §9]** |
| **F3 Niveles** | Media | Bajo | F1 | Muy alto (carga cognitiva) | Total |
| **F4 Resumen** | Media | Bajo–Medio | F3; `report` para vista ejecutiva | Alto | Total, salvo si se creara campo nuevo (evitarlo) **[TEC §10]** |
| **F5 BMC** | Media | Bajo | F1, F3 | Alto (viabilidad legible) | Total |
| **F6 Carga cognitiva** | Media | Bajo | F1–F5 | Muy alto (percepción global) | Total |
| **F7 Consistencia** | Baja | Muy bajo | Patrón "Resumen" existente | Alto (coherencia) | Total |
| **F8 Roadmap** | Baja | Ninguno | — | Orquestación | N/A |

**Riesgo transversal único a vigilar:** no introducir una **segunda fuente de verdad** al resumir **[TEC §9, §10; Principio P-4]**. Mitigación: derivar en presentación o reutilizar `report`; nunca copiar/almacenar contenido en paralelo. Todo lo demás es reorganización sobre datos ya estructurados, con rollback total **[TEC §8, §9]**.

---

## Fase 10 — Resultado esperado (percepción final)

Sin hablar de implementación, así debería *sentirse* el nuevo Lienzo:

- **Primeros 30 segundos — qué debería comprender el usuario:** de qué va la idea y si es viable — el problema central, a quién sirve, qué la hace distinta, y cómo gana/gasta dinero. Todo eso debería estar en el **Nivel 1**, sin scrolling ni lectura de listas **[UX §5, §15 P9; Fase 3]**.
- **Qué debería descubrir inmediatamente:** el problema, el segmento, la propuesta y su **diferenciador**, más **Ingresos y Costos** — hoy los tres últimos están enterrados **[UX §5, §6, §9]**.
- **Qué debería quedar para exploración posterior:** contexto, causas raíz, características, servicios, recursos, socios y relación con cliente — el detalle del Nivel 3, accesible a demanda pero fuera de la vista inicial **[UX §10, §15 P8; Fase 4]**.
- **Cómo debería percibirse frente al actual:** el Lienzo debería sentirse como un **panel ejecutivo que aplica los mismos principios de jerarquía y Progressive Disclosure que el Resumen** —sin replicar su estructura—, no como un documento/planilla que obliga a leerlo entero **[UX §2, §15 P10; Fase 7]**. La app dejaría de tener dos regímenes opuestos (dashboard fuera, documento dentro) y sería **consistente de principio a fin**.

---

## Conclusión

1. **¿Objetivo principal del rediseño?** Reducir la carga cognitiva del Lienzo y del BMC llevando a su interior la lógica "resumen → detalle" que la app ya aplica a nivel macro, para que la comprensión y la decisión ocurran en segundos — **sin tocar arquitectura, agentes ni contrato** **[UX §15 P10; TEC §12]**.

2. **¿Cambio estratégico de mayor impacto?** Sustituir la **exposición total y plana** del Lienzo/BMC por una **jerarquía de 3 niveles ordenada por prioridad de decisión** (Fase 3 + Fase 2). Ataca directamente el problema UX central **[UX §12, §15 P10]** y es de riesgo Muy Bajo **[TEC §9]**.

3. **¿Qué fases implementar primero?** Las **P1**: reordenar por prioridad de decisión (F2) e introducir el Nivel 1 como vista de entrada (F3). Máximo impacto, riesgo mínimo, sin dependencias, rollback total **[Fase 8 P1; Fase 9]**.

4. **¿Qué fases pueden esperar?** La **vista detallada completa (P4.a)** y la **salvaguarda de nombres (P4.b)**; y, con menor urgencia, la vinculación de pares redundantes (P3.a) y la vista ejecutiva vía `report` (P3.b), que dependen de fases previas **[Fase 8 P3–P4]**.

5. **¿Qué riesgos evitar durante la implementación?** (a) Introducir una **segunda fuente de verdad** al resumir **[TEC §9, §10]**; (b) **renombrar o depender de nombres de campo** sin coordinación, que vacía bloques sin error **[TEC §6, §12]**; (c) trasladar lógica de presentación al backend, rompiendo la separación limpia **[TEC §11; Principio P-6]**.

6. **¿Qué decisiones requieren validación antes de desarrollar?** (a) Los **umbrales "primeros N"** de cada lista (cuántos ítems en Nivel 2) — decisión de producto, no derivable de las auditorías; (b) si la **vista ejecutiva** usará el artefacto `report` (disponible solo al final del pipeline) o una derivación en presentación disponible siempre **[TEC §10]**; (c) el **criterio exacto de corte** entre Nivel 2 y Nivel 3 para los bloques BMC complementarios; (d) si la "vista detallada" (Nivel 3) será un modo aparte o una expansión in situ — decisión de experiencia a validar con usuarios.

---

## Objetivos de experiencia

Estos objetivos no son KPIs, ni métricas técnicas, ni pruebas funcionales: son criterios cualitativos para validar, una vez completado el rediseño, si la experiencia resultante cumple efectivamente la Visión planteada al inicio de este documento.

Al finalizar el rediseño, un usuario debería poder:

- **Comprender el problema principal en menos de 30 segundos**, sin necesidad de leer listas completas.
- **Identificar rápidamente el segmento** al que se dirige la idea.
- **Encontrar el diferenciador** de la propuesta de valor sin recorrer toda la pantalla.
- **Comprender rápidamente cómo genera ingresos** el modelo de negocio.
- **Comprender la propuesta de valor** sin necesidad de leer todos sus bloques.
- **Decidir con criterio** si necesita profundizar en el detalle o si puede continuar hacia otra etapa del proceso.

Estos objetivos son el criterio último de la Visión enunciada al inicio: si un usuario los logra, el Lienzo estará mostrando la información correcta en el momento correcto.

---

## Hito de validación (Quality Gate)

Entre esta estrategia y el futuro Diseño Funcional existe un punto de control explícito, que **no constituye una fase adicional del roadmap** ni se numera como tal.

Su propósito es revisar, antes de iniciar cualquier implementación, que el Diseño Funcional resultante:

- **Respeta las dos auditorías** que sustentan esta estrategia (UX y técnica).
- **Respeta esta estrategia**: sus principios (Fase 0), su priorización (Fase 1), su orden de lectura (Fase 2) y su modelo de niveles (Fase 3).
- **Mantiene las restricciones del proyecto** enumeradas en "Fuera del alcance".
- **No introduce una segunda fuente de verdad** al definir cómo se resume o deriva la información **[Principio P-4]**.
- **No rompe el contrato Backend → Frontend**, ni depende de renombrar o reinterpretar campos sin coordinación **[Principio P-8]**.
- **Mantiene la separación contenido/presentación**, sin trasladar lógica de presentación al backend **[Principio P-6]**.

Este hito ocurre **después** de que el Diseño Funcional esté redactado y **antes** de que comience la implementación. Es un punto de control (Quality Gate), no una etapa de diseño ni una fase del roadmap.

---

## Próximo entregable

Esta estrategia no conduce directamente a la implementación. El siguiente documento del proyecto será un **Diseño Funcional**, que tomará como base las decisiones aquí establecidas y definirá:

- el comportamiento esperado;
- la organización de la información;
- los niveles de información;
- la interacción esperada;
- la experiencia del usuario.

El contenido del Diseño Funcional queda fuera del alcance de este documento; es el siguiente paso del proyecto, sujeto al Hito de validación descrito arriba antes de avanzar a la implementación.

---

### Cierre

Esta hoja de ruta transforma los hallazgos de ambas auditorías en una secuencia gradual, de menor a mayor impacto y con rollback en cada paso, que evoluciona el Lienzo Lean y el Modelo de Negocio desde una planilla densa hacia un panel ejecutivo consistente con el resto de la aplicación — **respetando íntegramente la arquitectura, el contrato y la separación contenido/presentación ya existentes** **[TEC §11, §12]**. Toda implementación concreta (componentes, umbrales finales, modos de vista) queda deliberadamente fuera de alcance y sujeta a las validaciones de la Conclusión punto 6 y al Hito de validación que precede al Diseño Funcional.

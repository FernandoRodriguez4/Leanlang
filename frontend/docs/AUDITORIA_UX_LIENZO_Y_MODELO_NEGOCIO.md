# Auditoría UX — Lienzo Lean y Modelo de Negocio

> **Rol:** Senior UX / Product Designer + UX Researcher. **No** se auditó arquitectura, agentes, LangGraph ni backend (ya cubierto por la auditoría técnica previa, que confirmó que el rediseño visual no afecta la lógica).
> **Naturaleza:** auditoría de solo lectura. No se implementó, propuso ni modificó nada.
> **Base de evidencia:** `components/LienzoPanel.tsx`, `components/OverviewPanel.tsx`, `app/projects/[id]/page.tsx`, y los prompts de los agentes (`backend/app/agents/prompts/__init__.py`) para dimensionar el contenido.
> **Nota metodológica sobre longitudes (§8):** no existen fixtures con contenido real generado (los tests usan mocks). Las mediciones de la §8 son **estimaciones** derivadas de los prompts (nº de ítems instruido) y la semántica de cada campo, no medidas sobre datos en vivo. Se etiquetan como tales.
> **Fecha:** 2026-07-11

---

## Contexto de lo que realmente se está auditando (para calibrar todo lo demás)

Antes de las 15 secciones, un hecho estructural que cambia el diagnóstico:

**La navegación NO es un scroll infinito tipo periódico.** El workspace usa **navegación por estaciones** (`BlueprintNav` en una barra lateral fija, `page.tsx:326-337`): Resumen · Investigación · **Lienzo** · Hipótesis · Riesgo · Experimentos · Test Cards · Crítica · Informe. Cada estación se renderiza por separado en el panel derecho (`StagePanel`, `page.tsx:359-458`). Ya existe además una estación **"Resumen"** (`OverviewPanel`) que es un panel ejecutivo real (semáforo de salud + statement del problema/propuesta + KPIs).

Por tanto, **la sensación de "leer un periódico" NO viene de la navegación global** (que está bien resuelta), **sino de lo que ocurre DENTRO de la estación "Lienzo"**: `LienzoPanel` (`LienzoPanel.tsx:36-120`) despliega **simultáneamente y con el mismo peso visual todos los campos de las 3 tarjetas del VPC + los 7 bloques del BMC**. Ahí se concentra la carga cognitiva. Este matiz recorre toda la auditoría.

---

## 1. Auditoría de carga cognitiva

| Pantalla / estación | Carga cognitiva | Justificación (evidencia) |
|---------------------|-----------------|---------------------------|
| **Resumen** (`OverviewPanel`) | **Baja** | Jerarquía clara: 1 banner de estado → 2 frases (problema + propuesta) → 4 KPIs → 2 tarjetas. Progressive disclosure real: sólo muestra `statement`, oculta el detalle. `OverviewPanel.tsx:66-89` |
| **Lienzo · Problema** | **Alta** | 5 campos visibles a la vez sin jerarquía: `statement`, `context`, `customer_jobs`, `pains`, `root_causes` (`LienzoPanel.tsx:51-58`). Todo se muestra completo, todo con igual tratamiento tipográfico. |
| **Lienzo · Segmento** | **Alta** | 5 campos simultáneos: `name`, `description`, `characteristics`, `gains`, `early_adopters` (`:68-75`). |
| **Lienzo · Propuesta de valor** | **Alta** | 5 campos simultáneos: `statement`, `products_services`, `pain_relievers`, `gain_creators`, `differentiator` (`:85-92`). |
| **Lienzo (los 3 juntos en grid)** | **Muy alta** | Las 3 tarjetas conviven en un grid de 3 columnas (`:44`), sumando **~15 campos y decenas de chips en un mismo viewport**. |
| **Modelo de negocio (BMC)** | **Muy alta** | 7 bloques en grid, cada uno una lista de chips, sin ninguna distinción de importancia (`:104-115`). Es una rejilla plana de 7 categorías equivalentes. |

**Respuestas a las preguntas guía:**
- *¿Cuánta información recibe a la vez?* En Lienzo, **demasiada**: 15 campos VPC + 7 bloques BMC en una sola vista scrollable.
- *¿Sobrecarga visual?* **Sí, en Lienzo y BMC.** No en Resumen.
- *¿Sabe qué es importante?* **No** dentro del Lienzo — todo compite por atención con igual peso.
- *¿Está jerarquizada?* Sólo parcialmente: el `statement` va en negrita (`text-ink/85`, `:53`) y los sub-campos usan la etiqueta `annot`; pero todos los chips son idénticos entre sí.
- *¿Demasiados bloques visibles?* **Sí** (22 bloques de contenido entre VPC + BMC).
- *¿La lectura exige esfuerzo?* **Sí en Lienzo**, porque obliga a escanear todo para encontrar lo relevante.

**Veredicto global de carga cognitiva del Lienzo+BMC: ALTA / MUY ALTA. Resumen: BAJA.**

---

## 2. Auditoría de densidad visual

| Dimensión | Observación (evidencia) |
|-----------|-------------------------|
| **Cantidad de texto** | Media-alta. Cada tarjeta mezcla prosa (`statement`, `context`, `description`, `differentiator`, `early_adopters`) con listas de chips. |
| **Cantidad de listas** | **Alta.** VPC: 8 listas de chips (`customer_jobs`, `pains`, `root_causes`, `characteristics`, `gains`, `products_services`, `pain_relievers`, `gain_creators`). BMC: 7 listas más. **≈15 listas de chips por pantalla.** |
| **Cantidad de tarjetas** | 3 tarjetas VPC (`:46,63,80`) + 1 contenedor BMC (`:99`). |
| **Espacios en blanco** | Correctos a nivel micro (`space-y-3`, `gap-4`), pero **insuficientes a nivel macro**: no hay separación jerárquica entre "lo esencial" y "el detalle". |
| **Separación visual** | Existe entre tarjetas, pero **no dentro** de cada tarjeta: los 5 campos fluyen verticalmente sin agrupación por importancia. |
| **Bloques extensos** | Los chips crecen con el contenido (`flex-wrap`, `Chips` en `:5-14`); listas largas de `pains`/`characteristics` producen "muros" de chips. |

**¿Panel ejecutivo o documento largo?**
- **Resumen → panel ejecutivo** (KPIs, semáforo, 2 frases). ✅
- **Lienzo + Modelo de negocio → documento largo.** Es una ficha densa donde el usuario debe leer todo para extraer la esencia. La rejilla de 7 bloques BMC de igual peso refuerza la sensación de "planilla" más que de "dashboard".

**Justificación:** la ausencia de una capa de jerarquía interna (resumen vs. detalle) convierte cada tarjeta en un mini-documento. La densidad no es de estilo (el CSS es limpio), es **densidad de información simultánea**.

---

## 3. Auditoría de scrolling

Layout: contenido a `max-w-6xl` (`page.tsx:278`); en desktop el Lienzo es grid de 3 columnas (VPC) + BMC debajo a ancho completo.

| Sección | Scroll estimado (desktop) | Comentario |
|---------|---------------------------|------------|
| **Resumen** | ~1–1.5 viewports | Compacto por diseño. |
| **Problema** (aislado) | <1 viewport | 5 campos caben, pero comparte fila con Segmento y Propuesta. |
| **Segmento** | <1 viewport | Íd. |
| **Propuesta de Valor** | <1 viewport | Íd. |
| **Lienzo completo (VPC en 3 col + BMC)** | **~2–3 viewports** | El grid VPC ocupa 1 pantalla; el BMC de 7 bloques añade 1–1.5 más. **Es la vista con más scroll.** |
| **Modelo de Negocio (BMC)** | **~1–1.5 viewports** | 7 bloques en grid `lg:grid-cols-3` (`:104`) → 3 filas de bloques. |

**En móvil** el grid colapsa a 1 columna (`grid-cols-3` sólo en `lg`), por lo que **el Lienzo completo puede superar 5–6 viewports en vertical** — ahí la sensación de "periódico" es máxima.

**Conclusión:** el **Modelo de Negocio y el Lienzo completo** son los que **más scrolling exigen**. El Problema/Segmento/Propuesta por separado son manejables; el problema es verlos **todos expandidos a la vez**.

---

## 4. Auditoría de jerarquía visual

**¿Qué ve primero el usuario?** En Lienzo, los tres encabezados numerados ①②③ con su chip de color (`:47-49,64-66,81-83`) y los `statement` en negrita. Eso está bien.

**¿Qué domina visualmente?** Nada domina de forma decisiva **dentro** de una tarjeta: tras el `statement`, los 4 sub-campos y sus chips tienen tratamiento uniforme. En el BMC, **los 7 bloques son visualmente idénticos** (misma etiqueta `annot`, mismos chips) → jerarquía **plana**.

**¿Qué pasa desapercibido?** El `differentiator` (propuesta), el `early_adopters` (segmento) y las `root_causes` (problema) — van al final, con estilo tenue (`text-ink/70`), y son fáciles de saltar pese a su valor estratégico.

**¿Existe jerarquía clara?**
- **Entre estaciones:** sí (navegación lateral + Resumen destacado).
- **Dentro del Lienzo:** parcial — sólo 2 niveles (statement vs. resto).
- **Dentro del BMC:** **no** — 1 solo nivel, todo igual.

**¿Todo parece tener la misma importancia?** En el BMC, **sí** (problema). En el VPC, casi (sólo el statement se separa).

**Clasificación de jerarquía visual:**
- Resumen: **Buena.**
- Lienzo VPC: **Débil** (2 niveles insuficientes para 5 campos).
- Modelo de Negocio BMC: **Muy débil / plana.**

---

## 5. Auditoría de descubrimiento (usuario nuevo)

Simulación de tiempo hasta encontrar cada dato (usuario que aterriza en la estación correspondiente):

| Dato buscado | Dónde vive | Facilidad de descubrimiento |
|--------------|-----------|-----------------------------|
| **Problema principal** | `problem.statement`, negrita, arriba de tarjeta ① (`LienzoPanel.tsx:53`) **y** en Resumen (`OverviewPanel.tsx:78`) | **Inmediato** (<2s). Bien resuelto. |
| **Segmento** | `segment.name`, negrita, tarjeta ② (`:70`) | **Rápido** (~3s), si ya está en Lienzo. |
| **Propuesta de valor** | `value_proposition.statement`, tarjeta ③ (`:87`) **y** Resumen (`:84`) | **Inmediato** (<2s). |
| **Beneficio principal** | Diluido entre `gain_creators` (lista) y `pain_relievers` (lista) (`:89-90`) | **Lento.** No hay "el beneficio", hay una lista de 3-5 sin ranking. **Debe leer toda la lista.** |
| **Modelo de ingresos** | `revenue_streams`, 6º bloque del BMC (`:31`), como lista de chips | **Lento.** Enterrado como uno de 7 bloques equivalentes; hay que localizar el bloque "Ingresos" escaneando la rejilla. |
| **Costo principal** | `cost_structure`, 7º bloque del BMC (`:32`), lista de chips | **Lento.** Íd., y encima es el último. No hay "el costo dominante". |

**¿Debe leer demasiado para descubrir esas respuestas?**
- Para problema/segmento/propuesta: **No** — están como `statement`/`name` destacados.
- Para **beneficio, ingresos y costo principal: Sí** — no existen como campo singular "principal"; son ítems dentro de listas planas de igual peso, lo que obliga a leer y jerarquizar mentalmente.

---

## 6. Auditoría de importancia de los campos

Clasificación por valor para la toma de decisiones: **Crítico** (define la idea) · **Importante** (contextualiza la decisión) · **Complementario** (enriquece) · **Detalle** (grano fino).

### Problema (`schemas/lean.py:12-19`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `statement` | **Crítico** | Es el problema en una frase; sin él no hay idea. |
| `pains` | **Importante** | Los dolores concretos justifican la urgencia. |
| `customer_jobs` | **Importante** | Define qué intenta lograr el cliente. |
| `context` | **Complementario** | Enmarca, pero no decide. |
| `root_causes` | **Complementario / Detalle** | Útil para diseñar soluciones; no para entender el problema rápido. |

### Segmento (`lean.py:22-29`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `name` | **Crítico** | Identifica a quién servimos. |
| `early_adopters` | **Importante** | Decisivo para saber por dónde empezar a validar. |
| `description` | **Importante** | Aclara el segmento. |
| `gains` | **Complementario** | Se solapa con `gain_creators` de la propuesta (ver §7). |
| `characteristics` | **Detalle** | Rasgos demográficos/conductuales; grano fino. |

### Propuesta de Valor (`lean.py:32-39`)
| Campo | Clasificación | Justificación |
|-------|--------------|---------------|
| `statement` | **Crítico** | La propuesta en una frase. |
| `differentiator` | **Crítico / Importante** | Es la razón de existir frente a alternativas; hoy va al final y tenue. |
| `pain_relievers` | **Importante** | Conecta con los `pains`. |
| `gain_creators` | **Importante** | Conecta con los `gains`. |
| `products_services` | **Complementario** | El "qué" tangible; menos decisivo que el porqué/diferenciador. |

### Modelo de Negocio (`lean.py:42-54`)
| Bloque | Clasificación | Justificación |
|--------|--------------|---------------|
| `revenue_streams` (Ingresos) | **Crítico** | La viabilidad depende de cómo se cobra. |
| `cost_structure` (Costos) | **Crítico / Importante** | El otro lado de la viabilidad. |
| `channels` (Canales) | **Importante** | Cómo se llega/entrega. |
| `key_activities` | **Importante** | Núcleo de la factibilidad. |
| `key_resources` | **Complementario** | Recursos de soporte. |
| `key_partners` | **Complementario** | Depende del modelo. |
| `customer_relationships` | **Complementario / Detalle** | Relevante, pero menos decisivo al inicio. |

**Hallazgo transversal:** el orden de render del BMC (`BMC_BLOCKS`, `LienzoPanel.tsx:25-33`) es **partners → activities → resources → channels → relationships → revenue → cost**. Es decir, coloca los **dos bloques críticos (ingresos y costos) en las posiciones 6ª y 7ª**, al final. La UI presenta primero lo complementario y al final lo crítico — orden inverso al valor de decisión.

---

## 7. Auditoría de redundancia

Por diseño del sistema (VPC ⇄ BMC), varios campos son **espejos conceptuales** entre agentes:

| Concepto | Aparece en | Nivel de solape |
|----------|-----------|-----------------|
| **Dolores del cliente** | `problem.pains` ⇄ `value_proposition.pain_relievers` (uno describe el dolor, el otro cómo se alivia) | **Alto** — pensados para "encajar" (el prompt lo dice, `prompts/__init__.py:49`). |
| **Ganancias del cliente** | `customer_segment.gains` ⇄ `value_proposition.gain_creators` | **Alto** — mismo emparejamiento (`:50`). |
| **Jobs / necesidades** | `problem.customer_jobs` ⇄ `problem.statement` ⇄ `segment.description` | **Medio** — el "para quién y para qué" se reitera. |
| **Statement del problema** | `problem.statement` en tarjeta ① **y** en Resumen (`OverviewPanel.tsx:78`) | **Intencional** (buen eco resumen↔detalle), no es ruido. |
| **Statement de la propuesta** | `value_proposition.statement` en tarjeta ③ **y** en Resumen (`:84`) | **Intencional.** |

**Respuestas:**
- *¿Qué ideas aparecen varias veces?* Dolores (pains ↔ pain_relievers), ganancias (gains ↔ gain_creators), y el "para quién" (statement/jobs/description).
- *¿Qué conceptos se repiten?* El eje dolor↔alivio y ganancia↔creación se muestran **dos veces, en tarjetas distintas, sin conectarlos visualmente** — el usuario no ve el "encaje" que el sistema sí modela; ve dos listas parecidas separadas.
- *¿Qué podría mostrarse una sola vez?* El par dolor/alivio y ganancia/creación podrían leerse emparejados en lugar de duplicados en tarjetas separadas (esto es observación UX, no propuesta de implementación).

**Nivel de redundancia: MEDIO.** No es duplicación literal (son campos distintos por diseño), pero **conceptualmente el usuario relee las mismas nociones** (dolor, ganancia, para-quién) en 2-3 lugares sin ayuda visual que las vincule.

---

## 8. Auditoría de longitud (estimaciones)

> **Estimaciones**, no medidas: no hay fixtures reales. Derivadas de los prompts (que no fijan longitudes salvo excepciones) y de la semántica del campo. Rangos típicos de salida LLM en español.

### Problema
| Campo | Caracteres (est.) | Palabras (est.) | Elementos |
|-------|-------------------|-----------------|-----------|
| `statement` | 80–150 | 12–22 | 1 frase |
| `context` | 150–350 | 25–55 | 1–2 frases |
| `customer_jobs` | — | — | 3–6 |
| `pains` | — | — | 3–6 |
| `root_causes` | — | — | 3–5 |

### Segmento
| Campo | Caracteres (est.) | Palabras (est.) | Elementos |
|-------|-------------------|-----------------|-----------|
| `name` | 20–50 | 3–7 | 1 |
| `description` | 120–280 | 20–45 | 1–2 frases |
| `characteristics` | — | — | 4–6 |
| `gains` | — | — | 3–6 |
| `early_adopters` | 60–160 | 10–25 | 1 frase |

### Propuesta de Valor
| Campo | Caracteres (est.) | Palabras (est.) | Elementos |
|-------|-------------------|-----------------|-----------|
| `statement` | 80–150 | 12–22 | 1 frase |
| `products_services` | — | — | 3–5 |
| `pain_relievers` | — | — | 3–5 |
| `gain_creators` | — | — | 3–5 |
| `differentiator` | 80–200 | 12–30 | 1 frase |

### Modelo de Negocio (cada bloque = lista de chips; cada chip 3–8 palabras)
| Bloque | Elementos (est.) |
|--------|------------------|
| `key_partners` | 2–5 |
| `key_activities` | 2–5 |
| `key_resources` | 2–5 |
| `channels` | 2–4 |
| `customer_relationships` | 2–4 |
| `revenue_streams` | 2–4 |
| `cost_structure` | 2–5 |

**Volumen agregado del Lienzo completo (est.):** ~4–6 frases de prosa + **~40–70 chips** repartidos en 15 listas. Ese recuento de chips es la métrica que mejor explica la sensación de "muro de etiquetas".

---

## 9. Auditoría del orden de lectura

### Problema — orden actual: `statement → context → customer_jobs → pains → root_causes` (`LienzoPanel.tsx:53-57`)
- **Evaluación:** aceptable al inicio (statement primero ✅), pero `context` interrumpe entre el problema y sus dolores. Un orden más natural para comprensión rápida sería **statement → pains (síntomas que duele) → jobs → context/causas** (dolor antes que contexto). El `context` es complementario y hoy ocupa posición 2 (privilegiada).

### Segmento — orden actual: `name → description → characteristics → gains → early_adopters` (`:70-74`)
- **Evaluación:** razonable, pero `early_adopters` (Importante para validación) queda **al final**, tras `characteristics` (Detalle). El orden pone el detalle antes que lo accionable.

### Propuesta de Valor — orden actual: `statement → products_services → pain_relievers → gain_creators → differentiator` (`:87-91`)
- **Evaluación:** **subóptimo.** El `differentiator` (Crítico) va **último y con estilo tenue**, mientras `products_services` (Complementario) va segundo. Para comprender rápido "por qué esta propuesta gana", el diferenciador debería estar cerca del statement, no al final.

### Modelo de Negocio — orden actual: `partners → activities → resources → channels → relationships → revenue → cost` (`BMC_BLOCKS`, `:25-33`)
- **Evaluación:** **el orden menos favorable.** Sigue la disposición canónica del lienzo de Osterwalder (izquierda→derecha del canvas físico), pero para **lectura de decisión** entierra Ingresos (6º) y Costos (7º), que son los bloques Críticos. Un orden por valor de decisión pondría **revenue/cost primero**.

**Conclusión §9:** en las 3 de 4 secciones, los campos **más decisivos no están en las posiciones de mayor prominencia de lectura** (diferenciador, early_adopters, ingresos, costos van al final). El orden hereda convenciones del framework (VPC/BMC canónicos), no la prioridad de decisión del usuario.

---

## 10. Auditoría de resumibilidad

Clasificación por campo: **Completo** (mostrar entero) · **Resumible** (recortar/colapsar) · **Parcial** (mostrar primeros N) · **Ocultable** (fuera de la vista inicial).

### Problema
| Campo | Recomendación de exposición |
|-------|------------------------------|
| `statement` | **Completo** |
| `pains` | **Parcial** (primeros 3) |
| `customer_jobs` | **Parcial** (primeros 3) |
| `context` | **Resumible / Ocultable** |
| `root_causes` | **Ocultable** (primeros 3 al expandir) |

### Segmento
| Campo | Recomendación |
|-------|---------------|
| `name` | **Completo** |
| `description` | **Resumible** |
| `early_adopters` | **Completo** (es Importante) |
| `gains` | **Parcial** (primeros 3) |
| `characteristics` | **Ocultable** |

### Propuesta de Valor
| Campo | Recomendación |
|-------|---------------|
| `statement` | **Completo** |
| `differentiator` | **Completo** (subir su prominencia) |
| `pain_relievers` | **Parcial** (primeros 3) |
| `gain_creators` | **Parcial** (primeros 3) |
| `products_services` | **Ocultable / Parcial** |

### Modelo de Negocio
| Bloque | Recomendación |
|--------|---------------|
| `revenue_streams` | **Completo** (crítico) |
| `cost_structure` | **Completo** (crítico) |
| `channels` | **Parcial** |
| `key_activities` | **Parcial** |
| `key_resources` | **Ocultable** |
| `key_partners` | **Ocultable** |
| `customer_relationships` | **Ocultable** |

**Patrón general:** los `statement`/`name`/`differentiator` y los bloques Ingresos/Costos deben verse completos; las **listas de chips (jobs, pains, gains, characteristics, services)** admiten mostrar los primeros 3; los campos de contexto y los 3 bloques BMC complementarios pueden **ocultarse inicialmente** sin pérdida de comprensión.

---

## 11. Auditoría por componente

Árbol real (`page.tsx` → `LienzoPanel.tsx`):

```
Workspace (page.tsx)
 ├─ BlueprintNav        → navegación por estaciones (sidebar)
 ├─ AgentStreamPanel    → bitácora colapsable de agentes
 └─ StagePanel (switch por estación)
     ├─ OverviewPanel   → "Resumen" (HealthBanner + statement + KPIs + RiskBars)
     └─ LienzoPanel     → Lienzo + Modelo de negocio
          ├─ Field(label, children)   → wrapper etiqueta + contenido
          └─ Chips(items)             → lista de badges
```

> Nota: no existen componentes `SectionCard` ni `BusinessCanvas` como archivos independientes; el nombre "SectionCard" del brief corresponde a las `<section className="card">` inline dentro de `LienzoPanel` (`:46,63,80,99`), y "BusinessCanvas" al bloque BMC inline (`:98-117`). `ChipList` es `Chips` (`:5-14`).

| Componente | Datos que consume | Concentración de info | ¿Cuello de botella visual? |
|-----------|-------------------|-----------------------|-----------------------------|
| `OverviewPanel` | `problem`, `value_proposition`, `hypotheses`, `prioritization`, `recommendations`, `test_cards`, `critic_review`, `classifications` (`OverviewPanel.tsx:53-66`) | Media, pero **bien jerarquizada** | No — es el modelo a seguir. |
| `LienzoPanel` (VPC) | `problem`, `customer_segment`, `value_proposition` (`:37-39`) | **Muy alta** (15 campos) | **Sí** — principal cuello de botella. |
| `LienzoPanel` (BMC) | `business_model` (7 listas) (`:40,105-114`) | **Muy alta** (7 bloques planos) | **Sí** — segundo cuello de botella. |
| `Field` | 1 label + children | Baja (átomo de layout) | No, pero **se repite ~15 veces por pantalla**, multiplicando la densidad. |
| `Chips` | `string[]` | Baja por instancia, **alta por acumulación** | Contribuyente: ~40–70 chips totales. |
| `StagePanel` | Enruta todo el `Blueprint` | Orquestador | No (sólo enruta). |

**¿Qué componente concentra más información?** `LienzoPanel` — es el único que renderiza dos frameworks completos (VPC + BMC) en una sola estación.

**¿Cuál puede convertirse en cuello de botella visual?** `LienzoPanel`, específicamente su **repetición de `Field`+`Chips` sin capa de jerarquía**. Los átomos (`Field`, `Chips`) están bien diseñados; el problema es **cuántos se muestran a la vez y con qué uniformidad**.

---

## 12. Auditoría de Progressive Disclosure

| Estación | ¿Sigue Progressive Disclosure? |
|----------|-------------------------------|
| **Navegación global** | **Sí.** Las estaciones se revelan a medida que hay datos (`readyFor`, `page.tsx:53-65`); no se muestra todo de golpe. `AgentStreamPanel` es colapsable. |
| **Resumen** | **Sí.** Muestra `statement` y oculta el detalle; los KPIs son puertas a más profundidad (`onJump`, `OverviewPanel.tsx:92-101`). |
| **Lienzo (VPC)** | **No.** Los 5 campos de cada tarjeta se muestran **todos, completos, de una vez** (`LienzoPanel.tsx:52-58` etc.). No hay resumen→detalle, ni "ver más", ni colapso. |
| **Modelo de Negocio (BMC)** | **No.** Los 7 bloques se despliegan simultáneamente y completos (`:105-114`). Sólo se ocultan los bloques *vacíos* (`if (!items?.length) return null`), lo cual es filtrado de nulos, **no** disclosure progresivo. |

**Impacto en la experiencia:** la app tiene **dos regímenes opuestos**. A nivel macro (estaciones, Resumen) el Progressive Disclosure está bien aplicado y la experiencia es de dashboard. Pero al entrar al **Lienzo/BMC**, el principio se abandona y el usuario cae en modo "documento completo". **Esa inconsistencia es el corazón del problema UX.**

---

## 13. Auditoría de foco visual

**¿Qué atrae primero la atención?**
- En Resumen: el **HealthBanner** (semáforo grande con color de estado, `OverviewPanel.tsx:41-48`) y los KPIs de 3xl bold (`:15`). Foco claro. ✅
- En Lienzo: los **encabezados numerados ①②③** con chip de color y el `statement` en negrita. Foco inicial correcto, **pero se disuelve inmediatamente** al bajar a los 4 sub-campos de chips uniformes.
- En BMC: **ningún elemento gana el foco** — 7 bloques idénticos compiten en igualdad. El ojo no sabe dónde posarse.

**¿Identifica de inmediato problema / segmento / propuesta?**
- **Sí** para los tres `statement`/`name` (destacados en negrita). El primer nivel de lectura funciona.
- **No** para el resto: para todo lo que no sea el titular de cada tarjeta, el usuario **necesita leer varios chips/párrafos** porque nada guía el ojo.

**Conclusión:** el foco visual es **bueno para el titular de cada sección y nulo para el detalle**. El BMC carece de foco por completo.

---

## 14. Auditoría de lectura (esfuerzo)

| Sección | Esfuerzo de lectura | Justificación |
|---------|--------------------|---------------|
| **Resumen** | **Muy fácil** | Frases sueltas + números grandes; escaneo instantáneo. |
| **Problema** | **Media** | Titular fácil; los 4 sub-campos exigen leer listas. |
| **Segmento** | **Media** | Íd.; `characteristics` puede ser denso. |
| **Propuesta de Valor** | **Media / Difícil** | 3 listas paralelas (services/relievers/creators) muy similares entre sí → fatiga de comparación; el diferenciador (lo interesante) llega cansado al final. |
| **Modelo de Negocio (BMC)** | **Difícil** | 7 bloques de chips sin jerarquía; leer todo para localizar Ingresos/Costos. Máximo esfuerzo de escaneo. |
| **Lienzo completo (todo junto)** | **Difícil / Muy difícil** | Suma de todo lo anterior en una vista. |

---

## 15. Conclusiones

**1. ¿Principales fuentes de contaminación visual?**
   - Los **7 bloques del BMC con jerarquía plana** (todos iguales, `LienzoPanel.tsx:104-115`).
   - Las **~15 listas de chips (~40–70 chips)** del Lienzo mostradas simultáneamente.
   - La **repetición del patrón `Field`+`Chips` sin niveles de importancia**, que uniforma lo crítico y lo accesorio.

**2. ¿Qué secciones generan mayor carga cognitiva?** El **Modelo de Negocio (BMC)** y el **Lienzo VPC completo** (Muy alta). El Resumen es Baja.

**3. ¿Qué campos son críticos para comprender rápido la idea?** `problem.statement`, `value_proposition.statement`, `value_proposition.differentiator`, `customer_segment.name`, `revenue_streams` y `cost_structure`. (Los tres primeros ya destacan; los tres últimos no.)

**4. ¿Qué campos tienen baja prioridad visual (y deberían tenerla)?** `context`, `root_causes`, `characteristics`, `products_services`, y los bloques BMC `key_resources`/`key_partners`/`customer_relationships`.

**5. ¿Qué información se repite innecesariamente?** El eje **dolor↔alivio** (`pains` ⇄ `pain_relievers`) y **ganancia↔creación** (`gains` ⇄ `gain_creators`), mostrados en tarjetas separadas sin vincularlos; y el "para quién" (statement/jobs/description). Redundancia **media** (conceptual, no literal).

**6. ¿Qué campos podrían resumirse sin perder significado?** `context` (resumible/ocultable), `root_causes`, `characteristics`, `products_services` y los 3 bloques BMC complementarios (ocultables); las listas largas (`pains`, `jobs`, `gains`) admiten mostrar los primeros 3.

**7. ¿Qué secciones deberían mostrarse primero?** El **Resumen** (ya lo hace: es la estación por defecto, `page.tsx:119`). Dentro del Lienzo, primero los **statements + diferenciador**, y en el BMC primero **Ingresos y Costos**.

**8. ¿Qué secciones podrían ocultarse inicialmente sin afectar la comprensión?** `context` y `root_causes` del Problema; `characteristics` del Segmento; `products_services` de la Propuesta; y los bloques BMC `key_resources`, `key_partners`, `customer_relationships`. Comprensión intacta con ellos colapsados.

**9. ¿La interfaz actual favorece la toma rápida de decisiones?**
   - **A nivel de Resumen: Sí.** Semáforo + KPIs + statements dan un veredicto en segundos.
   - **A nivel de Lienzo/Modelo de Negocio: No.** Obliga a leer todo para extraer lo decisivo; los datos de viabilidad (ingresos/costos) están enterrados y sin jerarquía.

**10. ¿Cuál es el principal problema UX encontrado?**

   > **La inconsistencia de jerarquía entre niveles.** La aplicación aplica bien Progressive Disclosure y jerarquía a nivel macro (estaciones + panel Resumen), pero **la abandona por completo dentro de la estación "Lienzo"**, donde vuelca los dos frameworks completos (VPC de 15 campos + BMC de 7 bloques) **a la vez, completos y con peso visual uniforme**. El resultado es que una herramienta que arranca como *dashboard* se convierte en *documento/planilla* en cuanto el usuario abre el Lienzo. No es un problema de estilo (el CSS es limpio y los átomos están bien hechos), sino de **ausencia de una capa "resumen → detalle" dentro de las tarjetas** y de **un orden de campos que sigue la convención del framework en lugar de la prioridad de decisión** (diferenciador, ingresos y costos relegados al final).

---

### Síntesis para el equipo de diseño (sin proponer solución concreta)

- El **Resumen es el patrón de referencia** de la propia app: replicar su lógica de "titular + acceso al detalle" dentro del Lienzo resolvería la mayor parte de la carga cognitiva.
- El **cuello de botella está localizado**: `LienzoPanel` (VPC+BMC). El resto de la app no sufre el problema.
- Las tres palancas UX de mayor impacto identificadas por esta auditoría son: **(a)** introducir jerarquía interna (crítico vs. detalle) en las tarjetas; **(b)** reordenar campos por prioridad de decisión (subir diferenciador, ingresos, costos); **(c)** reducir la exposición simultánea de chips (mostrar primeros N + resto colapsado). *Su implementación queda fuera del alcance de esta auditoría.*

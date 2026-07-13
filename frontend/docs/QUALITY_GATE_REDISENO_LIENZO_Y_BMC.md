# Quality Gate — Rediseño del Lienzo Lean y Modelo de Negocio

> **Rol:** Principal Product Architect · UX Lead · Software Architect.
> **Naturaleza:** este documento **no es una auditoría, no es una estrategia y no es un diseño funcional**. Es un **Quality Gate**: un punto de control documental previo al inicio de la implementación.
> **Documentos de entrada (revisados en su totalidad):**
> - `audit_rediseno_lienzo_modelo_negocio.md` (auditoría técnica) → **[TEC §n]**
> - `AUDITORIA_UX_LIENZO_Y_MODELO_NEGOCIO.md` (auditoría UX) → **[UX §n]**
> - `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md` (estrategia) → **[EST Fase n / Principio P-n / Visión / Objetivos]**
> - `DISEÑO_FUNCIONAL_LIENZO_Y_BMC.md` (diseño funcional) → **[DF §n / RF-n]**
> **Fecha:** 2026-07-12

**Pregunta que responde este documento:** ¿toda la documentación puede interpretarse de una única manera por el equipo de desarrollo? Si la respuesta es no, se identifica exactamente dónde. Si es sí, se aprueba la implementación.

**Restricciones respetadas:** este documento no escribe código, no modifica React, frontend, backend, contratos, LangGraph, prompts, agentes ni arquitectura, no propone componentes ni genera wireframes o mockups. Únicamente valida consistencia documental y, donde detecta ambigüedad, fija la interpretación oficial — sin modificar los documentos fuente.

---

## Validación 1 — Consistencia entre Estrategia y Diseño Funcional

**Fases omitidas:** se verificaron las 11 secciones estructurales de la estrategia (Visión, Fuera del alcance, Fase 0 a Fase 10, Objetivos de experiencia, Hito de validación, Próximo entregable). El Diseño Funcional cita explícitamente cada una en al menos un punto (Visión en §1, Fuera del alcance en la declaración de cumplimiento, Fase 0 a través de los Principios P-1 a P-10, Fases 1–7 en §3–§8, Fase 8/Roadmap en RF-09/RF-10, Fase 9 en §13, Fase 10 en §1 y §9, Objetivos de experiencia en §9 y RF-16, Hito de validación en §15). **No hay fases omitidas.**

**Decisiones nuevas:** el Diseño Funcional no introduce ninguna decisión de priorización, alcance o principio que no exista ya en la estrategia. Donde la estrategia dejaba un espacio funcional abierto (p. ej. si el acceso al Nivel 3 requiere pasar por el Nivel 2), el Diseño Funcional tomó una posición y la justificó explícitamente (DF §9, caso "usuario experimentado"). Esto no constituye una decisión estratégica nueva, pero sí una interpretación funcional no explícita en el texto original — se trata en la Validación 10.

**Contradicciones, cambios de prioridad o de principios:** no se detectaron. El roadmap P1–P4 y los Principios P-1 a P-10 se citan siempre en modo referencia, nunca se reescriben ni se reordenan.

**Resultado: conforme**, con dos puntos de interpretación abierta que se resuelven en la Validación 10.

---

## Validación 2 — Contradicción de niveles (Fase 1 vs. Fase 3)

**Pregunta:** ¿existe una contradicción real entre las cuatro categorías de la Fase 1 y los tres niveles de la Fase 3, o es una proyección válida?

**Análisis:** se verificó campo por campo la correspondencia entre ambas fases:

| Categoría Fase 1 | Nivel Fase 3 | ¿Coincide? |
|---|---|---|
| Siempre visible | Nivel 1 | Sí, 1:1 exacto |
| Visible inicialmente | Nivel 2 | Sí, 1:1 exacto |
| Visible bajo demanda | Nivel 3 | Sí, incluido |
| Solo vista detallada | Nivel 3 | Sí, incluido |

Ningún campo aparece clasificado de forma opuesta entre fases (no hay ningún caso de un campo "Siempre visible" en Fase 1 que aparezca en Nivel 2 o 3, ni viceversa). Lo único que ocurre es que las dos categorías más profundas de la Fase 1 ("Visible bajo demanda" y "Solo vista detallada") se **fusionan** en un único Nivel 3.

**Respuesta:** **no existe contradicción.** Es una proyección válida: la Fase 3 declara explícitamente que sus niveles están "alineados con la clasificación de la Fase 1" **[EST Fase 3]**, no que sean idénticos en granularidad. Fusionar dos categorías que ambas exigen una acción explícita del usuario (ninguna es visible por defecto) en un solo nivel funcional ("Completo / bajo demanda") es consistente con el objetivo de simplicidad que persigue toda la estrategia **[EST Visión]**.

### Interpretación oficial

**Nivel 3 = unión de "Visible bajo demanda" ∪ "Solo vista detallada" de la Fase 1.** No se establece una jerarquía interna obligatoria entre ambas subcategorías dentro del Nivel 3 (es decir, no es obligatorio mostrar primero los campos "bajo demanda" y después los de "detalle"). Si en el futuro se necesita distinguir un orden dentro del Nivel 3, esa es una decisión de implementación posterior, no una corrección de esta estrategia. Esta interpretación queda fijada como oficial para el proyecto.

---

## Validación 3 — Campo `gains`

**Pregunta:** ¿existe una contradicción real, y cuál debe ser la clasificación oficial?

**Análisis:** las tres fases dicen lo siguiente sobre `gains` (Segmento):
- Fase 1: **"Visible bajo demanda (primeros ~3)"** — nótese que la propia Fase 1 ya incluye la anotación "(primeros ~3)" dentro de una categoría de exposición tardía.
- Fase 3: incluido explícitamente en **Nivel 3**.
- Fase 4: agrupado en **"Mostrarse parcialmente (primeros N)"**, junto a `pains`, `customer_jobs`, `pain_relievers`, `gain_creators` — todos estos últimos son campos "Visible inicialmente" (Nivel 2) según la Fase 1.

La Fase 4 mezcla dos dimensiones distintas: **cuándo** se expone un campo (su nivel/tier) y **cómo** se trunca cuando se expone (formato parcial vs. completo). Al agrupar `gains` junto a campos de Nivel 2 bajo una tabla organizada por formato de truncado, la Fase 4 da la impresión de que `gains` comparte el tier de exposición de esos campos — lo cual **sí contradice** a la Fase 1 y la Fase 3, que coinciden en ubicarlo en el tier más profundo (bajo demanda / Nivel 3).

**Respuesta:** **sí existe una contradicción**, pero es acotada: no es sobre el formato (las tres fases coinciden en que `gains` se muestra parcialmente, primeros ~3, cuando se expone), sino sobre el tier de exposición (Nivel 2 vs. Nivel 3).

### Interpretación oficial

**`gains` pertenece al Nivel 3 (tier "Visible bajo demanda"),** conforme al criterio mayoritario y más específico de la Fase 1 y la Fase 3, reforzado por la propia justificación de la Fase 1: `gains` se solapa conceptualmente con `gain_creators` de la Propuesta de Valor **[EST Fase 1; UX §7]**, lo que lo hace redundante como contenido de exposición temprana. **Cuando el usuario accede al Nivel 3 y despliega `gains`, debe mostrarse en formato parcial (primeros ~3, con acceso al resto)**, conforme a la Fase 1 y la Fase 4. Esto concilia las tres fases: el tier lo deciden la Fase 1 y la Fase 3 (Nivel 3), el formato de truncado lo decide la Fase 1 y la Fase 4 (parcial).

El Diseño Funcional (§4 y §5) ya sigue esta interpretación — `gains` aparece en Nivel 3 y no en Nivel 2 —, por lo que **no requiere ningún ajuste**. El texto que debería aclararse es el de la propia Fase 4 de la estrategia (ver "Decisiones oficiales").

---

## Validación 4 — Requisitos funcionales (RF-01 a RF-16)

Se revisaron los 16 requisitos funcionales uno a uno contra el contenido íntegro de la estrategia. Ninguno contradice una decisión explícita de la estrategia. El único punto que merece mención es **RF-12** ("acceso directo al Nivel 3 sin pasar por el Nivel 2"), que no contradice ningún texto de la estrategia pero se apoya en una interpretación de una frase ambigua de la Fase 3 — tratada en la Validación 10, no como contradicción sino como ambigüedad de origen.

**Respuesta: no existe ningún RF que contradiga la estrategia.**

---

## Validación 5 — Criterios de aceptación

Se revisó que los 16 RF tuvieran un criterio de aceptación (`DF §12`) formulado de forma coherente con su requisito. Todos lo tienen. Se identificaron tres criterios de naturaleza **cualitativa**, que no son "imposibles de validar" pero tampoco son verificables por inspección mecánica de un desarrollador en solitario:

- **RF-09** (vínculo visual dolor↔alivio / ganancia↔creación): el criterio "existe alguna forma de percibir la relación" no define qué cuenta como suficiente. Requiere revisión de diseño, no una comprobación binaria.
- **RF-14** (adopción de principios de consistencia sin copiar estructura): "identificable... sin ser idéntica" es inherentemente subjetivo. Requiere revisión de diseño/UX, no inspección de código.
- **RF-16** (decisión del usuario solo con Nivel 1): solo puede confirmarse con observación de usuarios reales, no por inspección estática.

Además, **RF-05 y RF-06** dependen de un valor numérico ("primeros N") que la propia estrategia declara pendiente de decisión de producto **[EST Conclusión, punto 6a]**. No es un defecto del Diseño Funcional: la estrategia ya identificó este umbral como no derivable de las auditorías y sujeto a validación posterior.

**Respuesta: no hay criterios imposibles de validar**, pero tres (RF-09, RF-14, RF-16) requieren revisión cualitativa/de diseño en vez de verificación mecánica, y dos (RF-05, RF-06) quedan condicionados a una decisión de producto ya señalada como pendiente por la propia estrategia. Ninguno de estos puntos bloquea el inicio de la implementación de la estructura funcional; sí deben resolverse antes de dar por completado el criterio correspondiente.

---

## Validación 6 — Restricciones (Fuera del alcance / Arquitectura / Backend / Contratos / Agentes / LangGraph / Contenido IA)

Se revisó el Diseño Funcional en busca de cualquier referencia a componentes, tecnologías, cambios de nombre de campo, backend, agentes, prompts, LangGraph o contenido generado. El documento:
- Cita nombres de campo del contrato (`statement`, `revenue_streams`, etc.) únicamente como referencia de lectura, nunca propone renombrarlos ni alterarlos — consistente con **[EST Principio P-8]**.
- No menciona ningún componente, archivo o tecnología de implementación (a diferencia de las auditorías, que sí citan `archivo:línea` porque su naturaleza es distinta).
- RF-15 declara explícitamente que ningún requisito exige cambios de contrato, schema o backend.
- No hay ninguna mención a agentes, prompts o LangGraph fuera de las citas de trazabilidad a la estrategia.

**Respuesta: no existe ninguna violación.**

---

## Validación 7 — Segunda fuente de verdad

Se verificó que ninguna decisión funcional cree datos nuevos, resuma contenido de forma distinta al artefacto, altere el contenido generado o introduzca información adicional no presente en el `Blueprint`.

- RF-10 (vista ejecutiva) exige explícitamente reutilizar `report` y prohíbe redacción nueva en cliente.
- RF-09 (vínculo dolor↔alivio) es una reorganización visual de campos ya existentes, no una fusión ni un cálculo de contenido nuevo.
- La regla funcional 9 (`DF §10`) prohíbe explícitamente cualquier resumen redactado fuera de `report`.
- El riesgo de segunda fuente de verdad está identificado y mitigado en `DF §13` como el riesgo transversal heredado de la estrategia **[EST Fase 9]**.

**Respuesta: no existe ninguna segunda fuente de verdad introducida por el Diseño Funcional.**

---

## Validación 8 — Progressive Disclosure

Se verificó que el modelo de tres niveles y el comportamiento de navegación (`DF §3–§7`) respeten el principio P-3 en su totalidad:

- El Nivel 1 es siempre el punto de entrada; ninguna sección invierte este orden.
- La expansión es aditiva (no reemplaza el titular), conforme al principio.
- Las secciones son independientes entre sí en su nivel de expansión (RF-11).
- El acceso directo al Nivel 3 sin pasar por el Nivel 2 (RF-12) **no rompe** Progressive Disclosure: el principio exige que la información no se muestre toda de golpe *por defecto*, no que el usuario esté obligado a un recorrido secuencial. Ofrecer un atajo explícito a un usuario que ya decide voluntariamente ver el detalle completo es coherente con "comprensión antes que exhaustividad" **[EST Principio P-1]**, porque la exhaustividad sigue siendo opcional y explícita.

**Respuesta: sí, los niveles definidos mantienen Progressive Disclosure. No se detectó ninguna sección que lo rompa.** Se identificó, eso sí, una ambigüedad de redacción en la estrategia sobre el comportamiento por defecto del Nivel 2, tratada en la Validación 10.

---

## Validación 9 — Trazabilidad

Se verificó la matriz de trazabilidad del Diseño Funcional (`DF §14`), confirmando que cada uno de los 16 RF cita al menos una fase, principio o sección concreta de la estrategia, y que dicha cita corresponde efectivamente al contenido real de esa fase (se contrastó cada cita contra el texto original de la estrategia, no solo contra su número).

**Respuesta: no existe ningún RF sin trazabilidad.**

---

## Validación 10 — Ambigüedad documental

Se buscaron puntos donde el orden, la prioridad, el comportamiento, la navegación, los niveles, la expansión o el resumen pudieran interpretarse de más de una manera. Se documentan **cuatro** ambigüedades — las dos ya señaladas por el propio Diseño Funcional (§13.1) y dos adicionales detectadas en esta revisión:

1. **Fusión de niveles (Fase 1 vs. Fase 3)** — ya señalada por el Diseño Funcional. Resuelta en la Validación 2: no es contradicción, es proyección válida.
2. **Clasificación de `gains`** — ya señalada por el Diseño Funcional. Resuelta en la Validación 3: sí hay contradicción de tier (no de formato); se fija Nivel 3.
3. **Comportamiento por defecto del Nivel 2** (nueva). La regla de gradualidad de la Fase 3 dice: *"el Nivel 1 es la vista de entrada; el Nivel 2 se muestra acotado; el Nivel 3 vive bajo demanda"* **[EST Fase 3]**. La frase "el Nivel 2 se muestra acotado" admite dos lecturas: (a) el Nivel 2 es visible por defecto junto al Nivel 1, solo que en forma truncada; o (b) el Nivel 2 requiere una acción explícita del usuario para revelarse, y "acotado" describe cómo se ve una vez revelado. El Diseño Funcional adoptó la lectura (b) en su flujo (`DF §2`, `DF §9`) sin señalar que la frase original era ambigua. Dos desarrolladores distintos podrían implementar comportamientos distintos a partir del mismo texto de la estrategia.
4. **Granularidad de independencia en el Modelo de Negocio** (nueva). RF-11 exige que expandir una sección no altere el nivel de las demás, y el Diseño Funcional trata "Modelo de Negocio" como una sección única (`DF §3–§6`). Sin embargo, la Fase 5 de la estrategia analiza el BMC bloque por bloque (7 bloques con su propia prioridad de decisión) **[EST Fase 5]**. El texto no aclara si la independencia de Nivel exigida por RF-11 aplica a las 4 secciones (Problema/Segmento/Propuesta/Modelo de Negocio) como unidades, o si cada uno de los 7 bloques del BMC debería tener su propio estado de expansión independiente. Ambas lecturas son defendibles con el texto actual.

**Respuesta: sí existen ambigüedades**, documentadas arriba. Las cuatro se resuelven con interpretación oficial en la siguiente sección.

---

## Decisiones oficiales

### Decisión 1 — Fusión de niveles (Fase 1 vs. Fase 3)
- **Resolución:** no es una contradicción. El Nivel 3 de la Fase 3 es la unión de "Visible bajo demanda" y "Solo vista detallada" de la Fase 1. No existe orden interno obligatorio entre ambas subcategorías dentro del Nivel 3.
- **Justificación:** ningún campo recibe clasificaciones opuestas entre fases; solo se fusionan dos categorías que ya comparten la característica de requerir acción explícita del usuario. La propia Fase 3 se declara "alineada con" la Fase 1, no idéntica en granularidad.
- **Impacto:** ninguno sobre el Diseño Funcional actual; su §5 ya refleja esta fusión correctamente.
- **Documento que debe actualizarse:** `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md`, Fase 3 — recomendable (no bloqueante) agregar una nota que aclare explícitamente esta fusión para futuros lectores.

### Decisión 2 — Clasificación oficial de `gains`
- **Resolución:** `gains` pertenece al **Nivel 3 / "Visible bajo demanda"**. Cuando se despliega, se muestra en formato parcial (primeros ~3).
- **Justificación:** dos de las tres fases (Fase 1 y Fase 3) coinciden explícitamente en el tier; la Fase 4 solo contradice el tier al agruparlo por formato de truncado junto a campos de Nivel 2, pero no contradice el formato en sí (parcial, primeros ~3), que también coincide con la Fase 1. Además, `gains` se solapa conceptualmente con `gain_creators`, lo que refuerza su carácter complementario y no indispensable en la exposición inicial **[EST Fase 1; UX §7]**.
- **Impacto:** ninguno sobre el Diseño Funcional actual; su §4 y §5 ya ubican `gains` en Nivel 3.
- **Documento que debe actualizarse:** `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md`, Fase 4 — recomendable (no bloqueante) aclarar que la fila de `gains` en "Mostrarse parcialmente" describe su formato de truncado dentro del Nivel 3, no su tier de exposición.

### Decisión 3 — Comportamiento por defecto del Nivel 2
- **Resolución:** el Nivel 2 **no** se muestra por defecto junto al Nivel 1. Requiere una acción explícita del usuario ("profundizar"), igual que el Nivel 3. "Se muestra acotado" describe cómo se ve el Nivel 2 **una vez revelado**, no un estado visible por defecto.
- **Justificación:** los Objetivos de experiencia de la estrategia exigen que un usuario pueda comprender el problema, el segmento, la propuesta y decidir **únicamente con el Nivel 1** en menos de 30 segundos **[EST Objetivos de experiencia]**. Si el Nivel 2 apareciera junto al Nivel 1 por defecto, la vista de entrada dejaría de ser "solo lo indispensable" y se diluiría el objetivo central de la Visión **[EST Visión]**. Esta lectura es además la que ya adoptó el Diseño Funcional en su flujo y sus casos funcionales.
- **Impacto:** ninguno sobre el Diseño Funcional actual, que ya asume esta interpretación; sí evita que una futura implementación divergente (Nivel 2 visible por defecto) se justifique con una lectura alternativa del mismo texto.
- **Documento que debe actualizarse:** `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md`, Fase 3 (regla de gradualidad) — recomendable (no bloqueante) reformular a "el Nivel 2, al expandirse, se muestra acotado" para eliminar la ambigüedad de origen.

### Decisión 4 — Granularidad de independencia en el Modelo de Negocio
- **Resolución:** la independencia de niveles exigida por RF-11 aplica a las **4 secciones** (Problema, Segmento, Propuesta, Modelo de Negocio) como unidades. Dentro de "Modelo de Negocio", los 7 bloques del BMC comparten un único estado de Nivel 1/2/3 (Nivel 1: Ingresos+Costos · Nivel 2: Canales+Actividades · Nivel 3: Recursos+Socios+Relación), no siete estados de expansión independientes.
- **Justificación:** la Fase 3 define los niveles a nivel de sección, no de bloque individual, y la Fase 5 usa la prioridad por bloque para justificar el **orden de lectura y de aparición por nivel**, no para fragmentar el control de expansión. Otorgar a cada uno de los 7 bloques un control de expansión propio reintroduciría exactamente el problema diagnosticado por la auditoría UX: "7 bloques equivalentes compitiendo por atención" **[UX §4, §12]**, que es lo que la Fase 5 busca corregir.
- **Impacto:** ninguno sobre el contenido del Diseño Funcional; se recomienda una aclaración de redacción para evitar que un desarrollador infiera niveles independientes por bloque.
- **Documento que debe actualizarse:** `DISEÑO_FUNCIONAL_LIENZO_Y_BMC.md`, §6 y §7 — recomendable (no bloqueante) añadir una línea explícita indicando que "Modelo de Negocio" es una sección con un único estado de nivel compartido entre sus 7 bloques.

**Nota de gobernanza:** las cuatro decisiones anteriores son, a partir de este documento, la **interpretación oficial y vinculante** del proyecto, independientemente de que las actualizaciones de redacción recomendadas (no bloqueantes) se apliquen de inmediato o en una revisión documental posterior. Ningún desarrollador debe implementar una lectura alternativa a las decisiones aquí fijadas.

---

## Estado

# ✅ APROBADO PARA IMPLEMENTACIÓN

**Por qué:** las diez validaciones no encontraron ninguna contradicción bloqueante entre la estrategia y el diseño funcional, ninguna violación de las restricciones de alcance, ninguna segunda fuente de verdad, ninguna ruptura de Progressive Disclosure y ninguna falla de trazabilidad. Las cuatro ambigüedades detectadas (dos ya señaladas por el propio Diseño Funcional, dos adicionales encontradas en esta revisión) quedaron resueltas con interpretación oficial en la sección "Decisiones oficiales", y en los cuatro casos el Diseño Funcional ya se comportaba de forma consistente con la resolución adoptada — por lo que ninguna de ellas exige reescribir el Diseño Funcional antes de comenzar.

**Condiciones no bloqueantes que acompañan la aprobación** (no impiden iniciar implementación, pero deben resolverse antes de dar por completados los criterios correspondientes):
- El umbral numérico "primeros N" (RF-05, RF-06) permanece pendiente de decisión de producto, tal como la propia estrategia ya lo señalaba **[EST Conclusión 6a]**.
- Los criterios de aceptación RF-09, RF-14 y RF-16 requieren validación cualitativa (revisión de diseño / observación de usuarios), no inspección mecánica.
- Se recomienda, sin bloquear el inicio del desarrollo, incorporar las cuatro aclaraciones de redacción señaladas en "Decisiones oficiales" en la próxima revisión de `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md` y `DISEÑO_FUNCIONAL_LIENZO_Y_BMC.md`.

---

### Cierre

Este Quality Gate certifica que la cadena documental — auditoría técnica, auditoría UX, estrategia y diseño funcional — es internamente consistente y admite una única interpretación de implementación, una vez incorporadas las cuatro decisiones oficiales fijadas en este documento. No se modificó ningún documento fuente; las actualizaciones de redacción recomendadas quedan a criterio del equipo para una revisión documental posterior, sin que su ausencia invalide esta aprobación.

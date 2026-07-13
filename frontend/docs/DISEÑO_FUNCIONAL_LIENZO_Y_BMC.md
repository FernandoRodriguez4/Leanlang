# Diseño Funcional — Lienzo Lean y Modelo de Negocio

> **Rol:** Principal Product Designer · Senior UX Architect · Lead Frontend Architect.
> **Naturaleza:** documento **funcional**, no técnico, no estratégico, no de implementación. No contiene código, componentes, tecnologías, wireframes ni mockups.
> **Fuente de verdad única:**
> - `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md` → citada como **[EST Fase n]**, **[EST Visión]**, **[EST Principio P-n]**, **[EST Objetivos]**.
> - No se re-audita, no se re-estrategia, no se cuestionan sus conclusiones. Este documento solo traduce la estrategia en comportamiento.
> **Fecha:** 2026-07-12

---

## Dependencias documentales

```
AUDITORÍA TÉCNICA
      ↓
AUDITORÍA UX
      ↓
ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md
      ↓
DISEÑO_FUNCIONAL_LIENZO_Y_BMC.md   (este documento)
      ↓
Hito de validación (Quality Gate)
      ↓
Implementación
```

Este documento responde únicamente a: **¿cómo debe comportarse la interfaz para materializar la estrategia aprobada?** No responde por qué, ni qué estrategia seguir, ni qué auditorías existen — eso ya está resuelto en los documentos anteriores.

**Declaración de cumplimiento:** este documento se elaboró tras la lectura completa de `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md`. No introduce estrategias nuevas, no cambia prioridades (P1–P4), no cambia principios (P-1 a P-10) y no cambia el roadmap. Toda decisión funcional cita la fase de la que proviene. Las contradicciones detectadas entre secciones de la estrategia se documentan en la §13.1, sin resolverlas.

**Restricciones heredadas (no se repiten en cada sección):** no se escribe código, no se generan componentes, wireframes ni mockups, no se modifica backend, contratos, agentes, prompts, LangGraph, schemas, contenido generado ni arquitectura — el alcance es idéntico al de "Fuera del alcance" en la estrategia **[EST Fuera del alcance]**.

---

## 1. Objetivo funcional

Definir qué experiencia tiene el usuario al utilizar el nuevo Lienzo: qué espera encontrar, qué comprende primero, qué descubre después y cómo progresa por el contenido — sin hablar de implementación.

La estrategia establece que el objetivo no es reducir información sino secuenciarla y graduarla, mostrando primero lo que permite decidir **[EST Visión]**. Funcionalmente, esto significa que la experiencia debe entregar, en el primer contacto con cada sección, únicamente lo indispensable para comprender y decidir, dejando el resto disponible pero no impuesto **[EST Fase 3; Principio P-1]**. El resultado esperado, tal como lo describe la Fase 10 de la estrategia, es que en los primeros 30 segundos el usuario comprenda de qué trata la idea y si es viable, sin necesidad de scroll ni de leer listas completas **[EST Fase 10]**.

---

## 2. Flujo funcional del usuario

Desde que el usuario entra a la estación "Lienzo" hasta que termina de revisarla:

```
Ingreso a la estación Lienzo
      ↓
Visualiza el Nivel 1 de las 4 secciones (Problema, Segmento, Propuesta, Modelo de Negocio)
      ↓
Comprende el problema (statement) — decide si el problema le resulta válido/relevante
      ↓
Comprende el segmento (nombre) — decide si el segmento le resulta reconocible
      ↓
Comprende la propuesta y su diferenciador — decide si la propuesta es distinta
      ↓
Comprende la viabilidad económica (ingresos y costos) — decide si el modelo tiene sentido
      ↓
[Opcional] Expande el Nivel 2 de alguna sección para contextualizar la decisión
      ↓
[Opcional] Expande el Nivel 3 de alguna sección para explorar el detalle completo
      ↓
Continúa con el Modelo de Negocio siguiendo el mismo patrón (Ingresos/Costos → Canales/Actividades → resto bajo demanda)
      ↓
Finaliza la revisión: decide profundizar más o continuar a otra estación
```

Este flujo no depende de componentes; depende de que cada sección respete el orden de lectura de la Fase 2 y el modelo de tres niveles de la Fase 3 **[EST Fase 2; EST Fase 3]**. La expansión a Nivel 2 o Nivel 3 es siempre una decisión del usuario, nunca un paso obligatorio del flujo — de lo contrario se reproduciría el problema de exposición total que la estrategia busca corregir **[EST Principio P-1; EST Fase 6]**.

---

## 3. Nivel 1 — qué debe aparecer inmediatamente

| Sección | ¿Qué ve el usuario? | ¿Por qué? | ¿Qué decisión puede tomar solo con este nivel? |
|---------|---------------------|-----------|--------------------------------------------------|
| **Problema** | `statement` | Es el campo Crítico; sin él no hay idea que evaluar **[EST Fase 1; Fase 3 Nivel 1]** | Juzgar si el problema es reconocible y relevante. |
| **Segmento** | `name` | Es el campo Crítico; identifica a quién sirve la idea **[EST Fase 1; Fase 3 Nivel 1]** | Juzgar si el segmento declarado es el esperado. |
| **Propuesta de Valor** | `statement` + `differentiator` | Ambos son Críticos; el diferenciador es "por qué gana" y hoy queda enterrado — debe estar junto al statement desde el primer momento **[EST Fase 1, Fase 2; Principio P-2]** | Juzgar si la propuesta es distinta frente a alternativas. |
| **Modelo de Negocio** | `revenue_streams` + `cost_structure` | Ambos Críticos; la viabilidad depende de cómo se cobra y en qué se gasta **[EST Fase 1, Fase 5]** | Juzgar la viabilidad económica básica de la idea. |

Con el Nivel 1 completo de las cuatro secciones, el usuario debería poder responder la pregunta que resume la Fase 10 de la estrategia: *de qué trata la idea y si es viable* **[EST Fase 10]**.

La tabla anterior define **qué campos** pertenecen al Nivel 1. Sobre **cuánto contenido** de cada uno de esos campos se muestra en ese nivel, véase §3.1.

---

### 3.1 Progressive Disclosure de contenido (segunda dimensión)

La validación funcional de la Fase 1 de implementación evidenció que el Progressive Disclosure descrito en este documento opera sobre dos dimensiones, y que regular solo la primera no basta para sostener el objetivo de comprensión en 30 segundos **[EST Objetivos de experiencia]**:

| Dimensión | Qué regula | Dónde ya está definida |
|---|---|---|
| **1 — Selección de campos** | Qué campos del artefacto se muestran en cada nivel | §3, §4 y §5 de este documento, a partir de la clasificación de la Fase 1 de la estrategia |
| **2 — Profundidad del contenido** | Cuánto del contenido de un campo ya seleccionado para un nivel se muestra en ese nivel | Se incorpora en esta sección |

Un campo puede pertenecer al Nivel 1 por su clasificación —por ejemplo `differentiator`, "Siempre visible" **[EST Fase 1]**— y aun así tener una redacción extensa generada por el LLM. En ese caso, mostrar el campo completo en el Nivel 1 reintroduce, a la escala de ese único campo, la misma carga cognitiva que el rediseño busca eliminar a la escala de la pantalla completa **[EST Principio P-1; Fase 6]**.

**Regla general:** el Nivel 1 muestra únicamente la información esencial para comprender rápidamente la idea de negocio, tanto en qué campos selecciona como en cuánto contenido de cada campo expone. Todo campo de texto libre cuyo contenido resulte extenso debe poder presentarse de forma resumida en el nivel en que su clasificación lo ubique, y desarrollarse por completo únicamente en el nivel donde el usuario decide profundizar. Esta regla no está atada a un campo en particular: aplica por igual a `differentiator`, `context`, `description`, y a cualquier otro campo de texto libre o ítem de lista (`pain_relievers`, `gain_creators`, `early_adopters`, `key_resources`, `key_activities`, entre otros) cuyo contenido generado sea extenso, presente o futuro.

**Qué no cambia esta regla:** no introduce un campo nuevo ni una redacción generada en el cliente — el resumen es una proyección de presentación sobre el mismo contenido ya recibido del backend, con el mismo criterio que la Fase 4 de la estrategia ya aplica a listas ("derivar en presentación", sin campo nuevo ni cambio de contrato) **[EST Fase 4; Principio P-4]**. Tampoco fija umbrales de longitud (caracteres, palabras o líneas): son parámetros de implementación, no una decisión funcional.

---

## 4. Nivel 2 — qué aparece al profundizar

| Sección | Qué aparece | Qué preguntas responde | Objetivo |
|---------|-------------|-------------------------|----------|
| **Problema** | `pains` y `customer_jobs`, acotados a los primeros ítems | ¿Por qué duele esto? ¿Qué intenta lograr el cliente? | Contextualizar la urgencia sin abrumar **[EST Fase 1, Fase 3 Nivel 2]** |
| **Segmento** | `early_adopters` y `description` | ¿Por dónde empiezo a validar? ¿Quién es exactamente este segmento? | Dar información accionable antes que detalle demográfico **[EST Fase 2]** |
| **Propuesta de Valor** | `pain_relievers` y `gain_creators`, acotados a los primeros ítems | ¿Cómo alivia el dolor? ¿Cómo genera la ganancia? | Conectar la propuesta con el problema y el segmento **[EST Fase 1, Fase 3 Nivel 2]** |
| **Modelo de Negocio** | `channels` y `key_activities` | ¿Cómo se llega y se entrega? ¿Qué hay que operar? | Mostrar el núcleo de factibilidad tras la viabilidad económica **[EST Fase 5]** |

**Qué información nunca debe aparecer en Nivel 2:** ningún campo clasificado como "Solo vista detallada" en la Fase 1 (`root_causes`, `characteristics`, `key_partners`, `customer_relationships`), ni listas sin acotar. El Nivel 2 es siempre una vista **parcial**, nunca completa **[EST Fase 1, Fase 3, Fase 4]**.

---

## 5. Nivel 3 — información completa

Agrupa el detalle exhaustivo y los complementos: `context`, `root_causes`, `characteristics`, `products_services`, `gains`, `key_resources`, `key_partners`, `customer_relationships`, y las versiones completas (sin acotar) de las listas mostradas parcialmente en Nivel 2 **[EST Fase 3 Nivel 3]**.

**Cuándo debería llegar el usuario a este nivel:** cuando ya formó una comprensión inicial con el Nivel 1 (y opcionalmente el Nivel 2) y decide explorar de forma deliberada — por ejemplo, para diseñar soluciones a partir de `root_causes`, entender el perfil demográfico completo del segmento, o revisar el detalle operativo del modelo de negocio **[EST Fase 1 — root_causes "útil para diseñar, no para comprender"]**. El Nivel 3 nunca es el punto de entrada; es siempre una exploración a demanda **[EST Fase 3, regla de gradualidad]**.

---

## 6. Comportamiento esperado por sección

| Sección | ¿Cómo debería sentirse la interacción? | ¿Qué objetivo cumple? | Nunca debe ocultarse | Puede permanecer secundario |
|---------|------------------------------------------|------------------------|-----------------------|-------------------------------|
| **Problema** | Lectura progresiva y no forzada; el statement comunica de inmediato el problema, el resto se ofrece sin exigirse | Comunicar la validez y urgencia del problema | `statement` | `context`, `root_causes` |
| **Segmento** | Foco inmediato en "a quién" y, al profundizar, en "por dónde empezar" | Identificar el segmento y su vía de validación | `name` | `characteristics` |
| **Propuesta de Valor** | El diferenciador se percibe junto al statement, no al final ni con tratamiento tenue | Comunicar por qué esta propuesta gana | `statement`, `differentiator` | `products_services` |
| **Modelo de Negocio** | Viabilidad económica legible de un vistazo antes que cualquier bloque operativo | Comunicar si el modelo es económicamente viable | `revenue_streams`, `cost_structure` | `key_resources`, `key_partners`, `customer_relationships` |

Estos comportamientos derivan directamente de la clasificación de importancia de la Fase 1 y de la reestructuración del BMC de la Fase 5 **[EST Fase 1, Fase 5]**.

---

## 7. Comportamiento de navegación

- **Progresión:** el Nivel 1 es siempre el punto de entrada de cada sección; el Nivel 2 y el Nivel 3 se revelan por acción explícita del usuario, nunca automáticamente **[EST Fase 3, regla de gradualidad]**.
- **Cambio entre niveles:** expandir debe ser **aditivo**, no un reemplazo — el titular de Nivel 1 permanece visible cuando se revela el Nivel 2 o el Nivel 3, de modo que el usuario no pierde el ancla de lo que ya comprendió **[EST Principio P-3]**.
- **Independencia entre tarjetas:** expandir el nivel de una sección (por ejemplo, Propuesta de Valor) no debe alterar el nivel en el que se encuentran las demás secciones (Problema, Segmento, Modelo de Negocio) — el Progressive Disclosure es por tarjeta, no global **[EST Principio P-3; Fase 3]**.
- **Vuelta atrás:** colapsar un nivel debe devolver a la sección a su nivel anterior sin desplazar la posición de lectura del usuario en el resto de la pantalla.
- **Mantener contexto:** el nivel de profundidad que el usuario eligió para cada sección debería conservarse mientras continúa su revisión, de modo que no deba reabrir manualmente lo que ya exploró.
- **Evitar perderse:** reutilizar el principio de "acceso profundo" (jump) ya validado en el Resumen para saltar directamente a una sección o nivel relevante, sin obligar a un recorrido lineal **[EST Fase 7; Principio P-7]**.

---

## 8. Consistencia funcional

Comparación del comportamiento esperado del Lienzo con el de las demás estaciones de la aplicación, para identificar qué principios deben mantenerse — **sin copiar literalmente la estructura de ninguna de ellas**, tal como establece la estrategia: el Resumen (y, por extensión, el resto de estaciones ya consistentes) inspira principios, no estructura **[EST Fase 7; Principio P-7]**.

| Estación | Principio funcional observado | Cómo debería inspirar al Lienzo/BMC |
|----------|-------------------------------|--------------------------------------|
| **Resumen** | Titular + acceso al detalle; los KPIs actúan como puertas a mayor profundidad ("jump") | El Nivel 1 del Lienzo debe funcionar igual: un titular que resuelve la comprensión inmediata, con una vía explícita hacia más detalle **[EST Fase 7]** |
| **Hipótesis** | Cada elemento comunica su importancia mediante señalización visual (badges de riesgo, resalte de "probar primero"), no solo mediante texto u orden | El Lienzo/BMC debe señalizar visualmente qué es crítico (p. ej. Ingresos/Costos, diferenciador), no depender únicamente del orden de lectura |
| **Experimentos** | Vista agregada por defecto (secuencia y plan completos); vista focalizada solo cuando el usuario filtra por una hipótesis concreta | El Lienzo/BMC debe mostrar una vista agregada (Nivel 1) por defecto, y reservar la vista focalizada/detallada (Nivel 3) para cuando el usuario la solicita explícitamente |
| **Informe** | Prosa ejecutiva primero (resumen), luego evidencia estructurada de apoyo, luego próximos pasos y acciones | Es el mismo patrón que la Fase 4 de la estrategia define para la futura vista ejecutiva del Lienzo, reutilizando el artefacto `report` **[EST Fase 4, P3.b]** |

**Principios que deben mantenerse en el Lienzo/BMC:** (a) titular antes que detalle; (b) señalización visual de importancia, no solo orden; (c) vista agregada por defecto, vista focalizada bajo demanda; (d) cuando exista una vista ejecutiva, debe seguir el patrón prosa→estructura→acción ya validado en Informe. Ninguno de estos principios exige adoptar los componentes, layout o estructura visual de las estaciones citadas — solo su lógica de comportamiento **[EST Fase 7; Principio P-7]**.

---

## 9. Casos funcionales

**Usuario nuevo — quiere entender rápidamente la idea.**
Debería bastarle con el Nivel 1 de las cuatro secciones (statement del problema, nombre del segmento, statement + diferenciador de la propuesta, ingresos y costos), sin necesidad de expandir nada, para formarse una comprensión completa en segundos **[EST Objetivos de experiencia]**.

**Usuario experimentado — quiere revisar únicamente el detalle.**
Debería poder acceder directamente al Nivel 3 de cualquier sección sin verse obligado a expandir primero el Nivel 2: la Fase 3 exige que el Nivel 1 sea la entrada por defecto, pero no que el acceso al Nivel 3 sea secuencial — "vive bajo demanda" no implica un recorrido forzado por el Nivel 2 **[EST Fase 3]**.

**Usuario evaluando viabilidad económica.**
Debería poder llegar a la estación y, sin leer el resto del contenido, encontrar Ingresos y Costos ya en el Nivel 1 del Modelo de Negocio, dado que son los campos que la Fase 5 sitúa en prioridad de decisión máxima **[EST Fase 5]**.

**Usuario que compara el problema con el diferenciador.**
Debería poder ver ambos sin recorrer toda la pantalla, ya que ambos residen en el Nivel 1 de sus respectivas secciones **[EST Fase 3 Nivel 1; Objetivos de experiencia]**.

**Usuario en dispositivo móvil.**
Debería obtener la misma comprensión en Nivel 1 sin el scroll extenso (hasta 5–6 viewports) que hoy exige el Lienzo completo en vertical; el Nivel 1 por sí solo debe caber sin recorrer los dos frameworks completos **[EST Fase 6]**.

**Usuario que retoma la revisión tras una pausa.**
No debería perder el nivel de profundidad que había alcanzado en cada sección al volver a la estación Lienzo, conforme al comportamiento de navegación definido en la §7.

---

## 10. Reglas funcionales

Derivadas de los principios de la Fase 0 y del resto de fases — ninguna regla se inventa fuera de la estrategia:

1. Una información clasificada como "Siempre visible" en la Fase 1 nunca debe quedar oculta en el Nivel 1 **[EST Fase 1; Principio P-1, P-2]**.
2. El detalle (Nivel 3) nunca debe mostrarse antes que el resumen (Nivel 1); el Nivel 1 es siempre el punto de entrada **[EST Fase 3]**.
3. Ningún nivel debe duplicar ni recalcular contenido; todos son proyecciones del mismo artefacto **[EST Principio P-4]**.
4. El orden de lectura dentro de cada tarjeta debe seguir la prioridad de decisión de la Fase 2, no la convención del framework VPC/BMC **[EST Fase 2; Principio P-2]**.
5. El usuario nunca debe perder el contexto de qué sección y qué nivel estaba explorando al expandir o colapsar contenido **[EST §7 de este documento]**.
6. Expandir un nivel debe ser aditivo: agrega información, nunca reemplaza el titular ya visible **[EST Principio P-3]**.
7. Ninguna tarjeta debe presentar más de los tres niveles de profundidad definidos en la Fase 3 **[EST Fase 6 — "esfuerzo cognitivo"]**.
8. Las listas parciales de Nivel 2 deben permitir mostrarse vinculadas cuando correspondan a pares conceptuales (dolor↔alivio, ganancia↔creación) **[EST Principio P-9; Fase 6]**.
9. Ninguna vista ejecutiva debe introducir redacción nueva generada en el cliente; su única fuente es el artefacto `report` ya existente **[EST Fase 4; Principio P-4]**.
10. Ninguna decisión funcional puede depender de renombrar, inferir o asumir campos que no estén ya presentes en el contrato **[EST Principio P-8]**.
11. El Progressive Disclosure regula dos dimensiones: qué campos se muestran en cada nivel, y cuánto contenido de cada campo se muestra en ese nivel; un campo puede estar seleccionado para el Nivel 1 y aun así presentarse de forma resumida si su contenido es extenso **[§3.1 de este documento; EST Principio P-1, P-4; Fase 6]**.

---

## 11. Requisitos funcionales

| ID | Requisito |
|----|-----------|
| RF-01 | El usuario debe comprender el problema principal sin recorrer toda la pantalla, mediante `problem.statement` en Nivel 1. |
| RF-02 | El usuario debe identificar el segmento mediante `segment.name` en Nivel 1, sin necesidad de expandir nada. |
| RF-03 | El usuario debe encontrar el diferenciador de la propuesta de valor junto a su statement, ambos en Nivel 1. |
| RF-04 | El usuario debe comprender cómo genera ingresos y en qué incurre en costos el modelo de negocio mediante `revenue_streams` y `cost_structure` en Nivel 1. |
| RF-05 | El Nivel 2 de cada sección debe limitarse a los campos clasificados como "Visible inicialmente" en la Fase 1, con listas acotadas a los primeros ítems. |
| RF-06 | El Nivel 3 debe agrupar los campos "Visible bajo demanda" y "Solo vista detallada" de la Fase 1, junto con las versiones completas de las listas de Nivel 2. |
| RF-07 | El orden de lectura dentro de cada tarjeta del VPC debe seguir el orden recomendado en la Fase 2. |
| RF-08 | El Modelo de Negocio debe reordenarse según la Fase 5: Ingresos y Costos primero, luego Canales/Actividades, luego el resto bajo demanda. |
| RF-09 | Los pares conceptuales dolor↔alivio y ganancia↔creación deben poder mostrarse vinculados visualmente, no solo como listas separadas. |
| RF-10 | Debe existir una vista ejecutiva del Lienzo que reutilice el artefacto `report` cuando esté disponible, sin generar redacción nueva en el cliente. |
| RF-11 | Expandir el Nivel 2 o Nivel 3 de una sección no debe alterar el nivel de las demás secciones. |
| RF-12 | El usuario debe poder acceder directamente al Nivel 3 de una sección sin pasar obligatoriamente por su Nivel 2. |
| RF-13 | La vista de entrada (Nivel 1 de las cuatro secciones) debe caber sin exigir el scroll extenso que hoy requieren los dos frameworks completos. |
| RF-14 | El Lienzo debe adoptar los principios de titular→detalle, señalización visual de importancia, agregación-por-defecto y prosa ejecutiva→estructura→acción ya presentes en otras estaciones, sin copiar su estructura. |
| RF-15 | Ningún requisito funcional de este documento debe requerir cambios en nombres de campo, schemas o el contrato Backend→Frontend. |
| RF-16 | El usuario debe poder decidir, únicamente con el Nivel 1 de las cuatro secciones, si desea profundizar o continuar hacia otra etapa del proceso. |

---

## 12. Criterios de aceptación funcional

| ID | Cumple cuando... |
|----|--------------------|
| RF-01 | ...el `statement` del problema es legible sin ninguna acción del usuario, al ingresar a la estación. |
| RF-02 | ...el `name` del segmento es legible sin ninguna acción del usuario, al ingresar a la estación. |
| RF-03 | ...el `differentiator` aparece junto al `statement` de la propuesta, ambos sin necesidad de expandir contenido. |
| RF-04 | ...`revenue_streams` y `cost_structure` son legibles antes que cualquier otro bloque del Modelo de Negocio, sin acción del usuario. |
| RF-05 | ...ningún campo fuera de la clasificación "Visible inicialmente" de la Fase 1 aparece en el Nivel 2, y las listas muestran solo sus primeros ítems. |
| RF-06 | ...todos los campos "Visible bajo demanda" y "Solo vista detallada" de la Fase 1 están disponibles en el Nivel 3, y ningún campo de Nivel 1/2 queda ausente de él. |
| RF-07 | ...el orden en que aparecen los campos de cada tarjeta VPC coincide con el orden recomendado de la Fase 2. |
| RF-08 | ...Ingresos y Costos preceden a Canales/Actividades, que a su vez preceden a Recursos/Socios/Relación en la exposición del BMC. |
| RF-09 | ...existe al menos una forma de percibir la relación entre `pains`↔`pain_relievers` y `gains`↔`gain_creators` sin leerlos como listas aisladas. |
| RF-10 | ...cuando `report` está disponible en el estado, la vista ejecutiva lo consume directamente, sin texto generado aparte. |
| RF-11 | ...cambiar el nivel de una sección no modifica el nivel visible de las demás secciones. |
| RF-12 | ...existe una vía para llegar al Nivel 3 de una sección sin haber expandido antes su Nivel 2. |
| RF-13 | ...el Nivel 1 de las cuatro secciones es visible sin necesidad de recorrer el equivalente a los "2–3 viewports" que hoy exige el Lienzo completo. |
| RF-14 | ...el comportamiento de titular→detalle, señalización visual, agregación-por-defecto y prosa→estructura→acción es identificable en el Lienzo, sin que su estructura visual sea idéntica a la de Resumen, Hipótesis, Experimentos o Informe. |
| RF-15 | ...ninguna decisión de este documento aparece registrada como dependiente de un cambio de nombre de campo, schema o contrato. |
| RF-16 | ...un usuario, expuesto solo al Nivel 1, puede articular si quiere profundizar o avanzar, sin haber necesitado abrir el Nivel 2 o 3. |

No se generan pruebas técnicas ni casos de testing; estos son exclusivamente criterios funcionales de aceptación.

---

## 13. Riesgos funcionales

Qué podría ocurrir si el diseño funcional (o su futura implementación) no respeta la estrategia:

- **Perder jerarquía:** si el Nivel 2 o el Nivel 3 se presentan con el mismo peso visual que el Nivel 1, se reproduce exactamente el problema que la auditoría UX identificó como causa raíz **[EST Fase 6]**.
- **Mostrar demasiado detalle en el punto de entrada:** si el Nivel 1 incorpora campos de Nivel 2 o 3 "por completitud", se rompe el objetivo de comprensión en 30 segundos **[EST Objetivos de experiencia]**.
- **Romper el Progressive Disclosure:** si expandir una sección colapsa o reordena otras, o si el Nivel 3 se vuelve la vista por defecto en algún escenario, se reintroduce el régimen "documento" que la estrategia busca eliminar **[EST Fase 3; Principio P-3]**.
- **Duplicar información:** si algún resumen se redacta o calcula en el cliente en lugar de leer `statement` o `report`, se introduce una segunda fuente de verdad — el riesgo transversal que la propia estrategia marca como el único a vigilar **[EST Fase 9; Principio P-4]**.
- **Perder contexto:** si el nivel de profundidad elegido por el usuario no se conserva durante la sesión de revisión, se fuerza una relectura innecesaria, contradiciendo el comportamiento de navegación de la §7.
- **Inconsistencia de exposición en el BMC:** si el reordenamiento no respeta exactamente Ingresos/Costos → Canales/Actividades → resto, se pierde el efecto de "viabilidad legible de un vistazo" que persigue la Fase 5 **[EST Fase 5]**.
- **Extensión de contenido dentro de un campo ya visible:** si un campo clasificado como Nivel 1 muestra su contenido completo sin resumir cuando ese contenido es extenso, se reintroduce a escala de campo la misma carga cognitiva que el rediseño busca eliminar a escala de pantalla — riesgo confirmado empíricamente durante la validación funcional de la Fase 1 de implementación con el campo `differentiator` **[véase §3.1]**.

### 13.1 Contradicciones detectadas (documentadas, no resueltas)

Conforme a la instrucción de documentar sin resolver, se registran dos tensiones internas de la estrategia detectadas al derivar este diseño funcional:

**(a) Colapso de granularidad entre Fase 1 y Fase 3.** La Fase 1 define cuatro niveles de exposición (Siempre visible · Visible inicialmente · Visible bajo demanda · Solo vista detallada), mientras que la Fase 3 define solo tres niveles (Indispensable · Importante · Completo). En la práctica, el Nivel 3 de la Fase 3 fusiona las dos categorías más profundas de la Fase 1 ("Visible bajo demanda" y "Solo vista detallada") en un único nivel, sin que la estrategia especifique si dentro de ese Nivel 3 debe conservarse alguna distinción entre lo "bajo demanda" y lo "de detalle profundo" **[EST Fase 1 vs. Fase 3]**. Este diseño funcional adopta el modelo de tres niveles de la Fase 3 tal como está (ver §5), pero dicha fusión debe quedar visible para el Hito de validación.

**(b) Clasificación inconsistente del campo `gains`.** La Fase 1 clasifica `gains` (Segmento) como "Visible bajo demanda", y la Fase 3 lo ubica explícitamente en el Nivel 3 ("Completo"). Sin embargo, la Fase 4 agrupa `gains` junto con `pains`, `customer_jobs`, `pain_relievers` y `gain_creators` bajo la categoría "Mostrarse parcialmente (primeros N)" — que en el resto de la estrategia corresponde al Nivel 2 **[EST Fase 1 vs. Fase 3 vs. Fase 4]**. Este diseño funcional sigue el criterio de la Fase 1 y la Fase 3 (ver §4 y §5, donde `gains` se ubica en Nivel 3), por ser el criterio mayoritario entre las tres fases, pero la contradicción con la Fase 4 no ha sido resuelta por este documento y debe ser objeto de una decisión de producto explícita.

---

## 14. Dependencia con la estrategia

Matriz de trazabilidad: cada requisito funcional indica de qué fase de la estrategia proviene.

| Requisito | Proviene de |
|-----------|-------------|
| RF-01 | Fase 1 (clasificación "Siempre visible"), Fase 3 (Nivel 1) |
| RF-02 | Fase 1, Fase 3 (Nivel 1) |
| RF-03 | Fase 1, Fase 2 (orden de lectura), Fase 3 (Nivel 1) |
| RF-04 | Fase 1, Fase 5 (Modelo de Negocio) |
| RF-05 | Fase 1 ("Visible inicialmente"), Fase 3 (Nivel 2), Fase 4 (resumen parcial) |
| RF-06 | Fase 1 ("Visible bajo demanda" / "Solo vista detallada"), Fase 3 (Nivel 3) |
| RF-07 | Fase 2 (Estrategia de lectura) |
| RF-08 | Fase 5 (Estrategia del Modelo de Negocio) |
| RF-09 | Principio P-9, Fase 6 (redundancia), Roadmap P3.a |
| RF-10 | Fase 4 (fuente del resumen), Roadmap P3.b |
| RF-11 | Principio P-3 (Progressive Disclosure por tarjeta) |
| RF-12 | Fase 3 (regla de gradualidad — "vive bajo demanda") |
| RF-13 | Fase 6 (scrolling y densidad visual) |
| RF-14 | Fase 7 (Estrategia de consistencia), Principio P-7 |
| RF-15 | Fuera del alcance, Principio P-6, P-8 |
| RF-16 | Objetivos de experiencia |

Toda decisión funcional de este documento es rastreable hasta la estrategia; ninguna decisión sin esta trazabilidad fue incorporada.

---

## 15. Preparación para el Quality Gate

El Hito de validación descrito en la estrategia **[EST Hito de validación (Quality Gate)]** deberá verificar, sobre este Diseño Funcional:

- [ ] Respeta la estrategia.
- [ ] Respeta la auditoría UX.
- [ ] Respeta la auditoría técnica.
- [ ] No rompe contratos.
- [ ] No cambia backend.
- [ ] No introduce una segunda fuente de verdad.
- [ ] Mantiene la separación contenido/presentación.
- [ ] Respeta el Progressive Disclosure.
- [ ] Respeta las prioridades (P1–P4 del roadmap).
- [ ] Respeta los niveles (Nivel 1, 2 y 3).
- [ ] Las contradicciones documentadas en la §13.1 fueron revisadas y, si corresponde, resueltas antes de avanzar a implementación.

Este checklist se ejecuta **después** de este documento y **antes** de iniciar cualquier implementación, conforme a la jerarquía documental del proyecto.

---

## Entregable esperado

Este es un documento funcional: no técnico, no estratégico, no de implementación, no de frontend. Su propósito es permitir que un desarrollador implemente el rediseño del Lienzo Lean y del Modelo de Negocio sin tener que reinterpretar la estrategia.

Toda decisión aquí contenida se traza hasta `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md` (véase la matriz de la §14). Ninguna decisión que no pudiera justificarse mediante la estrategia fue incorporada a este documento. Las dos contradicciones internas detectadas entre fases de la estrategia (§13.1) quedan documentadas para su resolución en el Hito de validación, no en este documento.

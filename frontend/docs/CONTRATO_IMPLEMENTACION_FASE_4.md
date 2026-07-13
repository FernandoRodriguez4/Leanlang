# Contrato de Implementación — Fase 4 (Estrategia de resumen)

> **Naturaleza:** contrato de implementación, no de código. No modifica ningún archivo del proyecto.
> **Fuentes de verdad:** `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md` [EST], `DISEÑO_FUNCIONAL_LIENZO_Y_BMC.md` [DF], `QUALITY_GATE_REDISENO_LIENZO_Y_BMC.md` [QG], Contrato aprobado de Fase 3 (trazas embebidas como comentarios `[Contrato Fase 3 §n]` en `components/LienzoPanel.tsx`; no existe un archivo `.md` persistido de ese contrato en `docs/`).
> **Versión:** 2 — incorpora las dos decisiones oficiales de la auditoría final (Cambio 1 y Cambio 2). La versión 1 quedó superada por este documento.
> **Fecha:** 2026-07-13

---

## Decisiones oficiales incorporadas

### Decisión 1 — `differentiator`
**Resolución:** `differentiator` pertenece al **Nivel 1** por clasificación funcional [EST Fase 1, Fase 3 Nivel 1], pero **no es una excepción al modelo general de Progressive Disclosure de contenido** [DF §3.1]. Sigue exactamente la misma regla que cualquier otro campo de texto libre:
- Texto corto → se muestra completo en Nivel 1 (el `line-clamp` no tiene efecto visual si no hay desbordamiento).
- Texto extenso → se muestra resumido en Nivel 1; el texto completo se traslada al **Nivel 3** de la tarjeta Propuesta de Valor.

Esto **reemplaza** la entrada "Nunca resumir" que la Fase 4 de la estrategia asignaba a `differentiator`; dicha entrada queda interpretada, a partir de esta decisión, como aplicable únicamente a `statement` (problema y propuesta), `name`, `revenue_streams` y `cost_structure` — los cuatro campos que si permanecen sin excepción alguna.

**Impacto en el contrato:** se elimina el bloqueo de la versión 1; `differentiator` vuelve a estar dentro del alcance de la Fase 4 (ver §1–§2).

### Decisión 2 — `gains` y profundidad máxima del Nivel 3
**Resolución:** **el Nivel 3 es la profundidad máxima de lectura.** Todo contenido que se muestre parcial o truncado en Nivel 2 debe mostrarse **íntegro** en Nivel 3, sin excepción y sin ningún mecanismo posterior (no hay "Nivel 4", no hay "ver más" dentro del Nivel 3). `gains` se muestra completo en Nivel 3.

**Impacto en el contrato:** el ítem de trabajo "truncar `gains` a los primeros ~3 con acceso al resto" queda **eliminado** de este contrato. El código actual de `components/LienzoPanel.tsx` (línea ~257, `s.gains?.length ? <Chips items={s.gains} /> : null`) ya muestra la lista completa sin truncar — **no requiere ninguna modificación**.

**Nota de gobernanza documental (no bloqueante):** esta decisión reemplaza, para efectos de este proyecto, el criterio de formato que `QUALITY_GATE_REDISENO_LIENZO_Y_BMC.md` había fijado en su "Decisión oficial 2" (que pedía `gains` en formato parcial incluso dentro del Nivel 3). Se recomienda actualizar esa sección del Quality Gate en su próxima revisión para que ambos documentos digan lo mismo; mientras tanto, este contrato es la referencia vigente para la implementación de la Fase 4.

---

## 1. Archivos a modificar
- **`components/LienzoPanel.tsx`** — único archivo de UI del Lienzo/BMC. Se extiende el mismo componente `ClampedText`/`FullText` ya usado por `early_adopters`/`description` (Fase 3) para cubrir `differentiator`; no se crea ningún componente ni archivo nuevo [EST Principio P-4 — una sola fuente de verdad de presentación].

**No deben modificarse:** `lib/types.ts`, `components/ReportPanel.tsx`, `components/OverviewPanel.tsx`, `app/projects/[id]/page.tsx`, `lib/stream.ts`, ningún archivo de `../backend/`, agentes, prompts, schemas ni `.env`.

## 2. Propósito de cada modificación
| Cambio | Qué | Por qué | Trazabilidad |
|---|---|---|---|
| Vista ejecutiva del Lienzo | Bloque condicional que consume `bp.report` (`executive_summary`, `problem_summary`, `value_proposition_summary`) cuando existe, sin redactar nada nuevo en cliente | Satisface RF-10; es la "fuente del resumen" que EST Fase 4 fija para la vista ejecutiva | [EST Fase 4 "Fuente del resumen"; DF §8, §11 RF-10; Roadmap P3.b] |
| Resumen de contenido de `differentiator` en Nivel 1 | `differentiator` pasa de `<p>` plano a `ClampedText` en Nivel 1 (mismo componente que `early_adopters`/`description`) | Aplica la regla general de DF §3.1 a `differentiator`, sin tratarlo como excepción [Decisión 1] | [DF §3.1; Decisión 1 de este contrato] |
| Texto completo de `differentiator` en Nivel 3 | Se añade `FullText(differentiator)` al bloque Nivel 3 de la tarjeta Propuesta de Valor, junto a `products_services`; `hasLevel3` de esa tarjeta pasa a ser `Boolean(v.products_services?.length \|\| v.differentiator)` | El texto completo pertenece al Nivel 3 [Decisión 1]; sin este ajuste, una propuesta con `differentiator` extenso pero sin `products_services` no tendría vía de acceso al texto completo | [DF §3.1; Decisión 1] |

**`gains` no forma parte del trabajo de esta fase** — ver Decisión 2.

## 3. Dependencias
- Depende de que `bp.report` ya esté tipado y disponible en el estado (`lib/types.ts:211`) — sin cambios de contrato.
- Depende del `ClampedText`/`FullText` ya existentes en `LienzoPanel.tsx` (Fase 3); no se introduce ningún mecanismo de truncado nuevo, solo se reutiliza sobre un campo adicional.
- El ajuste de `hasLevel3` en Propuesta de Valor depende de que la lógica de `LevelControls` (Fase 3) siga tal como está: solo cambia la condición booleana que decide si el botón "Ver más" aparece, no el componente en sí.
- No depende de cambios en Fases 1–3 ni las altera: las cuatro secciones, sus niveles y su navegación permanecen como están.

## 4. Riesgos identificados
| Riesgo | Impacto | Mitigación |
|---|---|---|
| La vista ejecutiva compite visualmente con el Nivel 1 y reintroduce carga cognitiva | Alto — contradice Fase 6 ("no mostrar todo junto") | Bloque aditivo y opcional (colapsable u ocultable); nunca reemplaza ni antepone el Nivel 1 |
| `bp.report` no siempre existe (solo al final del pipeline) | Medio | Renderizado 100% condicional (`bp.report &&`), mismo patrón que la estación "Informe" |
| Umbral de longitud para clamp de `differentiator` no está definido (DF §3.1 lo deja como parámetro de implementación) | Bajo | El `line-clamp-3` ya usado para otros campos aplica igual aquí; no requiere una decisión de producto adicional para arrancar |
| Sin medir el DOM, no se sabe en build-time si un `differentiator` corto realmente necesitaba el botón "Ver más" a Nivel 3 | Bajo | Aceptable: mostrar el atajo a Nivel 3 siempre que exista `differentiator`, aunque el texto no esté realmente truncado, es un no-op inocuo — no rompe Progressive Disclosure |
| Segunda fuente de verdad si se reformula el texto de `report` | Alto (viola Principio P-4) | Prohibido redactar o resumir `report` en cliente; se muestra tal cual llega |
| Desalineación entre este contrato y `QUALITY_GATE...md` (Decisión oficial 2 sobre `gains`) | Bajo — documental, no de código | Ver nota de gobernanza en Decisión 2; no bloquea la implementación |

## 5. Validación del Estado Esperado
- **RF-10:** con `report` poblado, la vista ejecutiva muestra los tres campos de resumen tal cual, sin texto adicional; sin `report`, el bloque no aparece.
- **`differentiator` corto:** se ve completo en Nivel 1, sin necesidad de expandir nada.
- **`differentiator` extenso:** se ve resumido en Nivel 1; al llegar a Nivel 3 de Propuesta de Valor, aparece completo, sin que el Nivel 1 lo oculte (expansión aditiva, RF-11 y Regla funcional 6).
- **`gains`:** al expandir Segmento hasta Nivel 3, la lista aparece completa, sin truncar y sin botón adicional de "ver más" dentro de ese nivel.
- **No regresión de Fases 1–3:** repetir los flujos ya validados (Nivel 1 de las 4 secciones visible sin acción; expandir una sección no altera las demás; BMC con Ingresos/Costos siempre visibles) y confirmar que no cambian.
- **Segunda fuente de verdad:** ningún texto de `report` se recorta, reformula o concatena — se consume como viene.

## 6. Observaciones
- Se recomienda, en una próxima revisión documental, alinear `QUALITY_GATE_REDISENO_LIENZO_Y_BMC.md` con la Decisión 2 de este contrato (formato completo de `gains` en Nivel 3), y alinear `ESTRATEGIA_REDISENO_LIENZO_Y_BMC.md` Fase 4 con la Decisión 1 (retirar `differentiator` de "Nunca resumir"). Ninguna de las dos actualizaciones bloquea el inicio de esta fase.
- El vínculo dolor↔alivio / ganancia↔creación (RF-09) sigue fuera de alcance: traza a Principio P-9 y Roadmap P3.a, no a Fase 4 [DF §14].
- La desalineación de "Modelo de Negocio" (solo 2 niveles reales en el código actual frente a los 3 que pide DF §4/RF-08) sigue documentada como observación de Fases 2–3, no de esta fase.
- No existe un archivo `.md` persistido del "Contrato de Fase 3"; la verificación de consistencia con esa fase se hizo contra sus trazas embebidas como comentarios en `LienzoPanel.tsx`.

---

## Estado

# ✅ APROBADO PARA IMPLEMENTACIÓN

Las dos decisiones oficiales de la auditoría final quedaron incorporadas. No se detectó ninguna contradicción nueva respecto a Progressive Disclosure, profundidad máxima, contenido completo del Nivel 3 o tratamiento de `differentiator`. La única discrepancia remanente es documental (Quality Gate vs. esta Decisión 2) y no bloquea el inicio del desarrollo.

**No se ha modificado ningún archivo del proyecto** salvo la creación/actualización de este propio contrato.

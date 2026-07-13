"use client";

import { useState } from "react";
import type { Blueprint, Report } from "@/lib/types";

/** Nivel 2: número de ítems mostrados por lista [DF §4, RF-05; N=3 fijado en el contrato de Fase 2]. */
const LEVEL2_LIST_LIMIT = 3;

type DisclosureLevel = 1 | 2 | 3;

function Chips({ items, tone = "paper" }: { items?: string[]; tone?: string }) {
  if (!items?.length) return <p className="text-sm text-ink/45">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className={`badge ${tone === "paper" ? "bg-paper text-ink/70" : tone}`}>{t}</span>
      ))}
    </div>
  );
}

/** `relation` es opcional y solo se pasa en los 4 campos del RF-09; el resto de usos de Field no se ve afectado [Contrato Fase 6]. */
/** `tone` es opcional (énfasis visual de importancia relativa, RF-14); sin tone, el label se ve igual que antes [Contrato Fase 7 §2]. */
function Field({ label, children, relation, tone }: { label: string; children: React.ReactNode; relation?: string; tone?: string }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className={`annot ${tone ?? ""}`}>{label}</span>
        {relation && (
          <span className="inline-flex items-center gap-1 text-[11px] normal-case tracking-normal text-ink/40">
            <span aria-hidden="true">⇄</span>
            <span className="sr-only">Relacionado con </span>
            {relation}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Texto completo de Nivel 3: sin line-clamp, sin truncamiento [Contrato Fase 3 §3, §5]. */
function FullText({ children }: { children: string }) {
  return <p className="text-sm leading-relaxed text-ink/70">{children}</p>;
}

/**
 * Vista ejecutiva del Lienzo: consume `report` tal cual llega del backend, sin
 * redactar ni resumir nada en cliente [Contrato Fase 4 §2, RF-10]. Oculta y
 * colapsada por defecto para no anteponerse al Nivel 1 [Contrato Fase 4 §4].
 */
function ExecutiveSummary({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blueprint-50 text-blueprint-700 dark:text-blueprint-300">≡</span>
          <h3 className="font-display font-semibold text-ink">Resumen ejecutivo</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="executive-summary-body"
          aria-label={open ? "Ocultar resumen ejecutivo" : "Ver resumen ejecutivo"}
          className="flex items-center gap-1 text-xs font-medium text-ink/50 transition hover:text-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blueprint-500"
        >
          {open ? "Ocultar" : "Ver resumen"}
          <span aria-hidden="true" className={`text-ink/40 transition ${open ? "rotate-180" : ""}`}>⌄</span>
        </button>
      </div>
      {open && (
        <div id="executive-summary-body" className="space-y-3 border-t border-line pt-3">
          {report.executive_summary ? <p className="text-sm leading-relaxed text-ink/85">{report.executive_summary}</p> : null}
          {report.problem_summary ? <Field label="Problema"><FullText>{report.problem_summary}</FullText></Field> : null}
          {report.value_proposition_summary ? <Field label="Propuesta de valor"><FullText>{report.value_proposition_summary}</FullText></Field> : null}
        </div>
      )}
    </section>
  );
}

/**
 * Controles de progresión por tarjeta VPC [Contrato Fase 3 §2, §4]:
 * Nivel 1 -Profundizar-> Nivel 2 -Ver más-> Nivel 3 -Ver menos-> Nivel 1.
 * No existe retorno Nivel 3 -> Nivel 2.
 */
function LevelControls({
  level,
  onOpen,
  onDeepen,
  onCollapse,
  label,
  hasLevel3,
  baseId,
}: {
  level: DisclosureLevel;
  onOpen: () => void;
  onDeepen: () => void;
  onCollapse: () => void;
  label: string;
  hasLevel3: boolean;
  baseId: string;
}) {
  const btnClass =
    "flex items-center gap-1 text-xs font-medium text-ink/50 transition hover:text-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blueprint-500";

  if (level === 1) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={false}
        aria-controls={`${baseId}-nivel2`}
        aria-label={`Profundizar en ${label}`}
        className={btnClass}
      >
        Profundizar
        <span aria-hidden="true" className="text-ink/40 transition">⌄</span>
      </button>
    );
  }

  if (level === 2) {
    return (
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onCollapse}
          aria-expanded={true}
          aria-controls={`${baseId}-nivel2`}
          aria-label={`Ver menos de ${label}`}
          className={btnClass}
        >
          Ver menos
          <span aria-hidden="true" className="text-ink/40 transition rotate-180">⌄</span>
        </button>
        {hasLevel3 && (
          <button
            type="button"
            onClick={onDeepen}
            aria-expanded={false}
            aria-controls={`${baseId}-nivel3`}
            aria-label={`Ver más de ${label}`}
            className={btnClass}
          >
            Ver más
            <span aria-hidden="true" className="text-ink/40 transition">⌄</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onCollapse}
      aria-expanded={true}
      aria-controls={`${baseId}-nivel2 ${baseId}-nivel3`}
      aria-label={`Ver menos de ${label}`}
      className={btnClass}
    >
      Ver menos
      <span aria-hidden="true" className="text-ink/40 transition rotate-180">⌄</span>
    </button>
  );
}

const BMC_BLOCKS_LEVEL_1: { key: keyof NonNullable<Blueprint["business_model"]>; label: string }[] = [
  { key: "revenue_streams", label: "Ingresos" },
  { key: "cost_structure", label: "Costos" },
  { key: "channels", label: "Canales" },
];

/** Nivel 2 del BMC: núcleo de factibilidad, tras la viabilidad económica de Nivel 1 [Contrato Fase 5 §2; DF §4]. */
const BMC_BLOCKS_LEVEL_2: { key: keyof NonNullable<Blueprint["business_model"]>; label: string }[] = [
  { key: "key_activities", label: "Actividades clave" },
  { key: "key_resources", label: "Recursos clave" },
  { key: "key_partners", label: "Socios clave" },
];

/** Nivel 3 del BMC: complementarios/detalle, exploración a demanda [Contrato Fase 5 §2; DF §5]. */
const BMC_BLOCKS_LEVEL_3: { key: keyof NonNullable<Blueprint["business_model"]>; label: string }[] = [
  { key: "customer_relationships", label: "Relación con el cliente" },
];

/** Lienzo del negocio: VPC (Problem/Segment/ValueProp) + bloques BMC. */
export function LienzoPanel({ bp }: { bp: Blueprint }) {
  const p = bp.problem;
  const s = bp.customer_segment;
  const v = bp.value_proposition;
  const bm = bp.business_model;
  const report = bp.report;

  const [problemLevel, setProblemLevel] = useState<DisclosureLevel>(1);
  const [segmentLevel, setSegmentLevel] = useState<DisclosureLevel>(1);
  const [valuePropLevel, setValuePropLevel] = useState<DisclosureLevel>(1);
  const [bmLevel, setBmLevel] = useState<DisclosureLevel>(1);

  return (
    <div className="space-y-3">
    {report && <ExecutiveSummary report={report} />}
    <div className="grid gap-3 lg:grid-cols-3">
      {/* Problema */}
      <section className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-desire-soft text-desire-ink">①</span>
          <h3 className="font-display font-semibold text-ink">Problema</h3>
        </div>
        {p ? (
          <div className="space-y-2.5">
            <p className="text-sm font-medium leading-relaxed text-ink/85">{p.statement}</p>
            {(p.pains?.length || p.customer_jobs?.length || p.context || p.root_causes?.length) ? (
              <>
                <LevelControls
                  level={problemLevel}
                  onOpen={() => setProblemLevel(2)}
                  onDeepen={() => setProblemLevel(3)}
                  onCollapse={() => setProblemLevel(1)}
                  label="Problema"
                  hasLevel3={Boolean(p.context)}
                  baseId="problem"
                />
                {problemLevel >= 2 && (
                  <div id="problem-nivel2" className="space-y-3 border-t border-line pt-3">
                    {p.context_summary ? <Field label="Contexto"><FullText>{p.context_summary}</FullText></Field> : null}
                    {p.pains?.length ? (
                      <Field label="Dolores" relation={v?.pain_relievers?.length ? "Aliviadores de dolor" : undefined}>
                        <Chips items={problemLevel === 3 ? p.pains : p.pains.slice(0, LEVEL2_LIST_LIMIT)} />
                      </Field>
                    ) : null}
                    {p.customer_jobs?.length ? (
                      <Field label="Trabajos del cliente">
                        <Chips items={problemLevel === 3 ? p.customer_jobs : p.customer_jobs.slice(0, LEVEL2_LIST_LIMIT)} />
                      </Field>
                    ) : null}
                    {p.root_causes?.length ? (
                      <Field label="Causas raíz">
                        <Chips items={problemLevel === 3 ? p.root_causes : p.root_causes.slice(0, LEVEL2_LIST_LIMIT)} />
                      </Field>
                    ) : null}
                  </div>
                )}
                {problemLevel === 3 && p.context ? (
                  <div id="problem-nivel3" className="space-y-3 border-t border-line pt-3">
                    <Field label="Contexto (texto completo)"><FullText>{p.context}</FullText></Field>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : <p className="text-sm text-ink/45">Pendiente.</p>}
      </section>

      {/* Segmento */}
      <section className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-feas-soft text-feas-ink">②</span>
          <h3 className="font-display font-semibold text-ink">Segmento</h3>
        </div>
        {s ? (
          <div className="space-y-2.5">
            <p className="text-sm font-medium leading-relaxed text-ink/85">{s.name}</p>
            {(s.early_adopters || s.description || s.characteristics?.length || s.gains?.length) ? (
              <>
                <LevelControls
                  level={segmentLevel}
                  onOpen={() => setSegmentLevel(2)}
                  onDeepen={() => setSegmentLevel(3)}
                  onCollapse={() => setSegmentLevel(1)}
                  label="Segmento"
                  hasLevel3={Boolean(s.early_adopters || s.description)}
                  baseId="segment"
                />
                {segmentLevel >= 2 && (
                  <div id="segment-nivel2" className="space-y-3 border-t border-line pt-3">
                    {s.early_adopters ? (
                      <Field label="Primeros adoptantes">
                        <FullText>{s.early_adopters_summary || s.early_adopters}</FullText>
                      </Field>
                    ) : null}
                    {s.description ? (
                      <Field label="Descripción">
                        <FullText>{s.description_summary || s.description}</FullText>
                      </Field>
                    ) : null}
                    {s.characteristics?.length ? <Field label="Características"><Chips items={s.characteristics} /></Field> : null}
                    {s.gains?.length ? (
                      <Field label="Ganancias" relation={v?.gain_creators?.length ? "Creadores de ganancia" : undefined}>
                        <Chips items={s.gains} />
                      </Field>
                    ) : null}
                  </div>
                )}
                {segmentLevel === 3 && (s.early_adopters || s.description) ? (
                  <div id="segment-nivel3" className="space-y-3 border-t border-line pt-3">
                    {s.early_adopters ? <Field label="Primeros adoptantes (texto completo)"><FullText>{s.early_adopters}</FullText></Field> : null}
                    {s.description ? <Field label="Descripción (texto completa)"><FullText>{s.description}</FullText></Field> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : <p className="text-sm text-ink/45">Pendiente.</p>}
      </section>

      {/* Propuesta de valor */}
      <section className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-viab-soft text-viab-ink">③</span>
          <h3 className="font-display font-semibold text-ink">Propuesta de valor</h3>
        </div>
        {v ? (
          <div className="space-y-2.5">
            <p className="text-sm font-medium leading-relaxed text-ink/85">{v.statement}</p>
            {(v.differentiator || v.pain_relievers?.length || v.gain_creators?.length || v.products_services?.length) ? (
              <>
                <LevelControls
                  level={valuePropLevel}
                  onOpen={() => setValuePropLevel(2)}
                  onDeepen={() => setValuePropLevel(3)}
                  onCollapse={() => setValuePropLevel(1)}
                  label="Propuesta de valor"
                  hasLevel3={Boolean(v.differentiator)}
                  baseId="valueprop"
                />
                {valuePropLevel >= 2 && (
                  <div id="valueprop-nivel2" className="space-y-3 border-t border-line pt-3">
                    {/* Resumen generado por el backend (`differentiator_summary`); si no existe, usa el campo completo como fallback. */}
                    {/* Mismo tono que el ícono de esta tarjeta (viab-ink), ya usado en OverviewPanel para el mismo propósito [Contrato Fase 7 §2, RF-14]. */}
                    {v.differentiator ? (
                      <Field label="Diferenciador" tone="text-viab-ink/80">
                        <FullText>{v.differentiator_summary || v.differentiator}</FullText>
                      </Field>
                    ) : null}
                    {v.pain_relievers?.length ? (
                      <Field label="Aliviadores de dolor" relation={p?.pains?.length ? "Dolores" : undefined}>
                        <Chips items={valuePropLevel === 3 ? v.pain_relievers : v.pain_relievers.slice(0, LEVEL2_LIST_LIMIT)} />
                      </Field>
                    ) : null}
                    {v.gain_creators?.length ? (
                      <Field label="Creadores de ganancia" relation={s?.gains?.length ? "Ganancias" : undefined}>
                        <Chips items={valuePropLevel === 3 ? v.gain_creators : v.gain_creators.slice(0, LEVEL2_LIST_LIMIT)} />
                      </Field>
                    ) : null}
                    {v.products_services?.length ? (
                      <Field label="Productos y servicios">
                        <Chips items={valuePropLevel === 3 ? v.products_services : v.products_services.slice(0, LEVEL2_LIST_LIMIT)} />
                      </Field>
                    ) : null}
                  </div>
                )}
                {valuePropLevel === 3 && v.differentiator ? (
                  <div id="valueprop-nivel3" className="space-y-3 border-t border-line pt-3">
                    <Field label="Diferenciador (texto completo)"><FullText>{v.differentiator}</FullText></Field>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : <p className="text-sm text-ink/45">Pendiente.</p>}
      </section>
    </div>

    {/* Modelo de negocio (BMC) */}
    {bm && (
      <section className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blueprint-50 text-blueprint-700 dark:text-blueprint-300">▦</span>
          <h3 className="font-display font-semibold text-ink">Modelo de negocio</h3>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {BMC_BLOCKS_LEVEL_1.map((b) => {
            const items = bm[b.key];
            if (!items?.length) return null;
            return (
              <div key={b.key}>
                {/* Mismo tono que el ícono de esta sección (blueprint), igual criterio que el diferenciador [Contrato Fase 7 §2, RF-14]. */}
                <div className="annot mb-1 text-blueprint-700 dark:text-blueprint-300">{b.label}</div>
                <Chips items={items} />
              </div>
            );
          })}
        </div>
        {(BMC_BLOCKS_LEVEL_2.some((b) => bm[b.key]?.length) || BMC_BLOCKS_LEVEL_3.some((b) => bm[b.key]?.length)) ? (
          <div className="mt-2.5 space-y-3">
            <LevelControls
              level={bmLevel}
              onOpen={() => setBmLevel(2)}
              onDeepen={() => setBmLevel(3)}
              onCollapse={() => setBmLevel(1)}
              label="Modelo de negocio"
              hasLevel3={Boolean(BMC_BLOCKS_LEVEL_3.some((b) => bm[b.key]?.length))}
              baseId="bm"
            />
            {bmLevel >= 2 && (
              <div id="bm-nivel2" className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-3">
                {BMC_BLOCKS_LEVEL_2.map((b) => {
                  const items = bm[b.key];
                  if (!items?.length) return null;
                  return (
                    <div key={b.key}>
                      <div className="annot mb-1">{b.label}</div>
                      <Chips items={items} />
                    </div>
                  );
                })}
              </div>
            )}
            {bmLevel === 3 && (
              <div id="bm-nivel3" className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-3">
                {BMC_BLOCKS_LEVEL_3.map((b) => {
                  const items = bm[b.key];
                  if (!items?.length) return null;
                  return (
                    <div key={b.key}>
                      <div className="annot mb-1">{b.label}</div>
                      <Chips items={items} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>
    )}
    </div>
  );
}

"use client";

import type { Classification, Hypothesis, Prioritization } from "@/lib/types";
import { RiskBadge } from "./RiskBadges";
import { RiskLevelBadge } from "./Status";
import { Dimension } from "./Dimension";

interface Props {
  hypotheses: Hypothesis[];
  classifications?: Classification[];
  prioritization?: Prioritization[];
  editable?: boolean;
  onChange?: (edited: Hypothesis[]) => void;
  onConfirm?: (edited: Hypothesis[]) => void;
  onFocusHyp?: (id: string) => void;
}

export function HypothesisList({ hypotheses, classifications, prioritization, editable, onChange, onConfirm, onFocusHyp }: Props) {
  const items = hypotheses;
  const atMinimum = items.length <= 1;
  const riskByH = Object.fromEntries((classifications || []).map((c) => [c.hypothesis_id, c.risk_type]));
  const levelByH = Object.fromEntries((classifications || []).map((c) => [c.hypothesis_id, c.risk_level]));
  const prioByH = Object.fromEntries((prioritization || []).map((p) => [p.hypothesis_id, p]));

  function update(i: number, statement: string) {
    onChange?.(items.map((h, idx) => (idx === i ? { ...h, statement } : h)));
  }

  function remove(i: number) {
    if (items.length <= 1) return;
    onChange?.(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {items.map((h, i) => {
        const prio = prioByH[h.id];
        return (
          <div
            key={h.id}
            className={`card p-4 transition ${prio?.is_riskiest ? "ring-1 ring-accent-500/40" : ""}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {onFocusHyp ? (
                <button
                  onClick={() => onFocusHyp(h.id)}
                  title="Ver sus experimentos"
                  aria-label={`Ver experimentos de ${h.id}`}
                  className="rounded-md bg-night px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white transition hover:bg-blueprint-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500 focus-visible:ring-offset-1"
                >
                  {h.id}
                </button>
              ) : (
                <span className="rounded-md bg-night px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{h.id}</span>
              )}
              <RiskBadge type={riskByH[h.id] as any} />
              <RiskLevelBadge level={levelByH[h.id]} />
              {h.is_counter_hypothesis && (
                <span className="badge bg-blueprint-500/15 text-blueprint-700 dark:text-blueprint-300">↺ contra-hipótesis</span>
              )}
              {prio?.is_riskiest && (
                <span className={`badge ${editable ? "" : "ml-auto"} bg-accent-500 text-ink`}>▲ probar primero</span>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={atMinimum}
                  aria-label={`Eliminar ${h.id}`}
                  title={atMinimum ? "Debe existir al menos una hipótesis para continuar." : `Eliminar ${h.id}`}
                  className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-danger bg-surface text-danger transition duration-200 hover:bg-danger hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-danger"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 7h16M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7m-9 0 .7 12.1a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9L18 7M10 11v6M14 11v6" />
                  </svg>
                </button>
              )}
            </div>
            {editable ? (
              <textarea
                className="input min-h-[72px] resize-none text-sm"
                value={h.statement}
                onChange={(e) => update(i, e.target.value)}
              />
            ) : (
              <p className="text-sm leading-relaxed text-ink/85">{h.statement}</p>
            )}
            {prio && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-2.5">
                <Dimension label="Importancia" value={prio.importance} fraction tone="blueprint" />
                <Dimension label="Evidencia" value={prio.evidence} fraction tone="feas" />
              </div>
            )}
          </div>
        );
      })}
      {editable && atMinimum && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          Debe existir al menos una hipótesis para continuar.
        </p>
      )}
      {editable && onConfirm && (
        <button onClick={() => onConfirm(items)} className="btn-amber w-full sm:w-auto">
          Confirmar hipótesis y continuar →
        </button>
      )}
    </div>
  );
}

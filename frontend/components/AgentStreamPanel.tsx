"use client";

import { useState } from "react";

const AGENT_LABEL: Record<string, string> = {
  supervisor: "Supervisor / Triaje",
  research: "Investigador (Tavily)",
  problem: "Problem Agent",
  customer_segment: "Customer Segment Agent",
  value_proposition: "Value Proposition Agent",
  business_model: "Business Model Agent",
  hypotheses: "Hypothesis Agent",
  human_hypotheses: "Tu revisión",
  risk: "Risk Agent",
  prioritize: "Risk Agent · 2×2",
  human_prioritization: "Tu revisión",
  experiment_design: "Experiment Design Agent",
  selector: "Experiment Design Agent",
  metrics: "Metrics Agent",
  success_criteria: "Success Criteria Agent",
  decision: "Decision Agent",
  sequencing: "Sequencing Agent",
  plan_estimate: "Plan Estimation Agent",
  critic: "Coach / Crítico",
  bump_revision: "Supervisor · re-trabajo",
  report: "Report Agent",
  human_approval: "Tu aprobación",
  human: "Tú",
};

const HUMAN_NODES = new Set(["human_hypotheses", "human_prioritization", "human_approval", "human"]);

export interface TraceItem {
  node: string;
  trace?: string;
}

/** Bitácora de agentes — colapsable, no roba protagonismo al contenido. */
export function AgentStreamPanel({ items, running }: { items: TraceItem[]; running: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <aside className="card sticky top-20 h-fit overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Ocultar bitácora de agentes" : "Mostrar bitácora de agentes"}
        className="flex w-full items-center justify-between px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blueprint-500"
      >
        <span className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink">Bitácora</span>
          <span className={`badge ${running ? "bg-blueprint-500/15 text-blueprint-700 dark:text-blueprint-300" : "bg-paper text-ink/50"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "anim-pulse2 bg-blueprint-500" : "bg-ink/30"}`} />
            {running ? "En vivo" : "En espera"}
          </span>
        </span>
        <span aria-hidden="true" className={`text-ink/40 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink/45">Aún sin actividad.</p>
          ) : (
            <ol className="space-y-3" aria-live="polite" aria-relevant="additions">
              {items.map((it, i) => {
                const isHuman = HUMAN_NODES.has(it.node);
                const isLast = i === items.length - 1;
                return (
                  <li key={i} className="relative pl-5">
                    {!isLast && <span className="absolute left-[6px] top-4 h-full w-px bg-line" />}
                    <span
                      className={`absolute left-0 top-1 h-3 w-3 rounded-full ring-2 ring-surface ${
                        isHuman ? "bg-accent-500" : isLast && running ? "anim-pulse2 bg-blueprint-500" : "bg-feas"
                      }`}
                    />
                    <div className="text-sm font-medium leading-tight text-ink/85">{AGENT_LABEL[it.node] || it.node}</div>
                    {it.trace && <div className="mt-0.5 text-xs leading-snug text-ink/55">{it.trace}</div>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}

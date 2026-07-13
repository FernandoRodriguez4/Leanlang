"use client";

import type { Blueprint } from "@/lib/types";
import { StatusDot, qualityStatus, type Status } from "./Status";

function Kpi({ label, value, sub, tone = "ink", status }: { label: string; value: string | number; sub?: string; tone?: string; status?: Status }) {
  const accent =
    tone === "amber" ? "text-accent-700" : tone === "feas" ? "text-feas" : tone === "viab" ? "text-viab-ink" : "text-blueprint-700";
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5">
        {status && <StatusDot status={status} />}
        <span className="annot text-sm font-bold text-ink">{label}</span>
      </div>
      <div className={`mt-1 font-display text-3xl font-bold tracking-tight ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink/55">{sub}</div>}
    </div>
  );
}

const HEALTH_TINT: Record<Status, string> = {
  ok: "border-ok/30 bg-ok-soft/50",
  warn: "border-warn/30 bg-warn-soft/50",
  danger: "border-danger/30 bg-danger-soft/50",
  neutral: "border-line bg-paper/60",
};

/** Indicador global de salud del blueprint (semáforo + resumen ejecutivo). */
function HealthBanner({ scoreFrac, riskiest }: { scoreFrac: number | null; riskiest: number }) {
  let status: Status, title: string, sub: string;
  if (scoreFrac == null) {
    status = "neutral"; title = "Diseño en progreso"; sub = "Aún sin auditar por el coach.";
  } else {
    status = qualityStatus(scoreFrac);
    const pct = Math.round(scoreFrac * 100);
    if (status === "ok") { title = "Listo para validar"; sub = `Calidad ${pct}% · ${riskiest} hipótesis a probar primero.`; }
    else if (status === "warn") { title = "Con observaciones"; sub = `Calidad ${pct}% · revisa las sugerencias del coach.`; }
    else { title = "Requiere trabajo"; sub = `Calidad ${pct}% · hay problemas críticos por resolver.`; }
  }
  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-5 ${HEALTH_TINT[status]}`}>
      <StatusDot status={status} className="h-4 w-4" pulse={status !== "neutral"} />
      <div>
        <div className="annot mb-0.5 text-sm font-bold text-ink">Estado del blueprint</div>
        <div className="font-display text-lg font-semibold text-ink">{title}</div>
        <div className="text-sm text-ink/65">{sub}</div>
      </div>
    </div>
  );
}

export function OverviewPanel({ bp, onJump }: { bp: Blueprint; onJump: (k: string) => void }) {
  const hyps = bp.hypotheses?.length ?? 0;
  const counter = (bp.hypotheses || []).filter((h) => h.is_counter_hypothesis).length;
  const riskiest = (bp.prioritization || []).filter((p) => p.is_riskiest).length;
  const recs = bp.recommendations ?? [];
  const disc = recs.filter((r) => r.stage === "discovery").length;
  const val = recs.filter((r) => r.stage === "validation").length;
  const cards = bp.test_cards?.length ?? 0;
  const score = bp.critic_review ? Math.round((bp.critic_review.quality_score ?? 0) * 100) : null;
  const passed = bp.critic_review?.passed;

  const scoreFrac = bp.critic_review?.quality_score ?? null;
  const highRisk = (bp.classifications || []).filter((c) => c.risk_level === "high").length;

  const lienzo = bp.value_proposition?.statement || bp.problem?.statement;
  return (
    <div className="space-y-5">
      <HealthBanner scoreFrac={scoreFrac} riskiest={riskiest} />

      {lienzo && (
        <div className="card relative overflow-hidden p-5">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            {bp.problem?.statement && (
              <div className="mb-3">
                <span className="annot text-sm font-bold text-desire-ink/80">Problema</span>
                <p className="mt-1 text-sm leading-relaxed text-ink/85">{bp.problem.statement}</p>
              </div>
            )}
            {bp.value_proposition?.statement && (
              <div>
                <span className="annot text-sm font-bold text-viab-ink/80">Propuesta de valor</span>
                <p className="mt-1 text-sm leading-relaxed text-ink/85">{bp.value_proposition.statement}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => onJump("hypotheses")} className="text-left">
          <Kpi label="Hipótesis" value={hyps} sub={`${counter} contra-hipótesis`} />
        </button>
        <button onClick={() => onJump("risk")} className="text-left">
          <Kpi label="Probar primero" value={riskiest} sub={highRisk ? `${highRisk} de riesgo alto` : hyps ? `${Math.round((riskiest / hyps) * 100)}% del total` : undefined} tone="amber" status={highRisk > 0 ? "danger" : riskiest > 0 ? "warn" : "neutral"} />
        </button>
        <button onClick={() => onJump("experiments")} className="text-left">
          <Kpi label="Experimentos" value={recs.length} sub={`${disc} descubrimiento · ${val} validación`} tone="feas" />
        </button>
        <button onClick={() => onJump("critic")} className="text-left">
          <Kpi
            label="Calidad del diseño"
            value={score != null ? `${score}%` : "—"}
            sub={score != null ? (passed ? "aprobado" : "requiere mejoras") : "pendiente"}
            tone={passed ? "viab" : "amber"}
            status={scoreFrac != null ? qualityStatus(scoreFrac) : "neutral"}
          />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 font-display text-base font-bold tracking-normal text-ink">Cobertura de riesgo</div>
          <RiskBars bp={bp} />
        </div>
        <div className="card flex flex-col justify-between p-4">
          <div>
            <div className="mb-2 font-display text-base font-bold tracking-normal text-ink">Test Cards</div>
            <p className="text-sm text-ink/65">
              {cards > 0 ? `${cards} tarjetas con métrica y criterio de éxito definidos.` : "Aún sin Test Cards."}
            </p>
          </div>
          {cards > 0 && (
            <button onClick={() => onJump("testcards")} className="btn-secondary mt-3 self-start">Ver Test Cards →</button>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskBars({ bp }: { bp: Blueprint }) {
  const cls = bp.classifications || [];
  const total = cls.length || 1;
  const rows = [
    { k: "Deseabilidad", n: cls.filter((c) => c.risk_type === "desirability").length, bar: "bg-desire" },
    { k: "Factibilidad", n: cls.filter((c) => c.risk_type === "feasibility").length, bar: "bg-feas" },
    { k: "Viabilidad", n: cls.filter((c) => c.risk_type === "viability").length, bar: "bg-viab" },
  ];
  if (!cls.length) return <p className="text-sm text-ink/55">Aún sin clasificar.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.k} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 text-ink/70">{r.k}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/70">
            <span className={`block h-full rounded-full ${r.bar}`} style={{ width: `${(r.n / total) * 100}%` }} />
          </span>
          <span className="w-6 text-right font-mono text-xs text-ink/60">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

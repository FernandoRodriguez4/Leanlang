"use client";

import type { ResearchReport } from "@/lib/types";
import { formatDateOnly, formatTimeOnly } from "@/lib/format";
import { StatusBadge, type Status } from "./Status";

const STATUS_MAP: Record<string, { status: Status; label: string }> = {
  completed: { status: "ok", label: "✓ Completada" },
  partial: { status: "warn", label: "Parcial" },
  failed: { status: "danger", label: "⚠ Falló" },
  empty: { status: "neutral", label: "Sin resultados" },
};

/** Panel de la estación Investigación — muestra el ResearchReport ya generado por el backend. */
export function ResearchPanel({ report }: { report: ResearchReport }) {
  const st = STATUS_MAP[report.status] ?? { status: "neutral" as Status, label: report.status };
  const hasMarket = report.market_summary || report.trends.length || report.benchmarks.length || report.regulations.length || report.studies.length;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-ink">🔎 Investigación</h3>
          <StatusBadge status={st.status}>{st.label}</StatusBadge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {report.confidence && (
            <div className="rounded-xl border border-line bg-paper/50 p-3">
              <div className="annot text-sm font-bold text-ink">Confianza</div>
              <div className="mt-0.5 font-display text-lg font-semibold text-ink">{report.confidence}</div>
            </div>
          )}
          {report.generated_at && (
            <>
              <div className="rounded-xl border border-line bg-paper/50 p-3">
                <div className="annot text-sm font-bold text-ink">Realizada</div>
                <div className="mt-0.5 text-sm text-ink/75">{formatDateOnly(report.generated_at)}</div>
              </div>
              <div className="rounded-xl border border-line bg-paper/50 p-3">
                <div className="annot text-sm font-bold text-ink">Hora</div>
                <div className="mt-0.5 text-sm text-ink/75">{formatTimeOnly(report.generated_at)}</div>
              </div>
            </>
          )}
        </div>

        {report.status === "failed" && (
          <p className="mt-3 rounded-lg bg-danger-soft/60 px-3 py-2 text-sm text-danger-ink">
            La investigación externa no pudo completarse; el blueprint continuó sin esta evidencia.
          </p>
        )}

        {report.queries.length > 0 && (
          <div className="mt-4">
            <div className="annot mb-1.5 text-sm font-bold text-ink">Consultas realizadas</div>
            <ul className="space-y-1">
              {report.queries.map((q, i) => (
                <li key={i} className="text-sm text-ink/70">• {q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {report.competitors.length > 0 && (
        <div className="card p-5">
          <div className="mb-2 font-display text-base font-bold tracking-normal text-ink">Competidores</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {report.competitors.map((c, i) => (
              <div key={i} className="rounded-xl border border-line bg-paper/50 p-3">
                <div className="text-sm font-medium text-ink">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.name}</a>
                  ) : c.name}
                </div>
                {c.description && <p className="mt-0.5 text-xs leading-relaxed text-ink/60">{c.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasMarket && (
        <div className="card space-y-3 p-5">
          <div className="font-display text-base font-bold tracking-normal text-ink">Mercado</div>
          {report.market_summary && <p className="text-sm leading-relaxed text-ink/80">{report.market_summary}</p>}
          <TagList label="Tendencias" items={report.trends} />
          <TagList label="Benchmarks" items={report.benchmarks} />
          <TagList label="Regulaciones" items={report.regulations} />
          <TagList label="Estudios" items={report.studies} />
        </div>
      )}

      {report.sources.length > 0 && (
        <div className="card p-5">
          <div className="mb-2 font-display text-base font-bold tracking-normal text-ink">Fuentes</div>
          <ul className="space-y-2">
            {report.sources.map((s, i) => (
              <li key={i} className="text-sm">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">{s.title || s.url}</a>
                {s.snippet && <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{s.snippet}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 font-display text-sm font-bold tracking-normal text-ink">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => <span key={i} className="badge bg-paper text-ink/70">{t}</span>)}
      </div>
    </div>
  );
}

import type { ExperimentRec } from "@/lib/types";

function Ticks({ value, max = 5, tone = "ink" }: { value: number; max?: number; tone?: "blueprint" | "ink" }) {
  const on = tone === "blueprint" ? "bg-blueprint-500" : "bg-ink/70";
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < value ? on : "bg-line"}`} />
      ))}
    </span>
  );
}

export function ExperimentSequence({ recs }: { recs: ExperimentRec[] }) {
  const sorted = [...recs].sort((a, b) => a.sequence_order - b.sequence_order);
  return (
    <ol className="space-y-3">
      {sorted.map((r, i) => {
        const disc = r.stage === "discovery";
        return (
          <li key={i} className="card flex gap-4 p-4">
            <div className="flex flex-col items-center">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-blueprint-600 font-mono text-sm font-semibold text-white">
                {r.sequence_order}
              </span>
              {i < sorted.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold text-ink">{r.experiment_name}</span>
                <span className={`badge ${disc ? "bg-blueprint-500/15 text-blueprint-700 dark:text-blueprint-300" : "bg-accent-500/15 text-accent-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${disc ? "bg-blueprint-500" : "bg-accent-500"}`} />
                  {disc ? "Descubrimiento" : "Validación"}
                </span>
                <span className="rounded-md bg-accent-500/15 px-1.5 py-0.5 font-mono text-xs font-bold text-accent-700">{r.hypothesis_id}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{r.rationale}</p>
              {r.design_detail && (
                <div className="mt-2 rounded-xl border border-line bg-paper/60 p-3">
                  <div className="annot mb-1 text-blueprint-700/70">Diseño concreto</div>
                  <p className="text-sm leading-relaxed text-ink/75">{r.design_detail}</p>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1">
                <span className="inline-flex items-center gap-1.5"><span className="annot">Evidencia</span> <Ticks value={r.expected_evidence_strength} tone="blueprint" /></span>
                <span className="inline-flex items-center gap-1.5"><span className="annot">Costo</span> <Ticks value={r.cost} /></span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

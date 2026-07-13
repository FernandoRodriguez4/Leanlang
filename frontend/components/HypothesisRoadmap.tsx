"use client";

import { useState } from "react";
import type {
  Classification,
  DecisionRule,
  ExperimentRec,
  Hypothesis,
  MetricSpec,
  Prioritization,
  Quadrant,
  SuccessCriterion,
} from "@/lib/types";
import { RiskBadge } from "./RiskBadges";
import { StatusBadge, evidenceStatus, riskLevelStatus } from "./Status";

type StageKey = "hypothesis" | "classification" | "risk" | "experiment" | "metrics" | "criteria" | "decision";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "hypothesis", label: "Hipótesis" },
  { key: "classification", label: "Clasificación" },
  { key: "risk", label: "Riesgo" },
  { key: "experiment", label: "Experimento" },
  { key: "metrics", label: "Métricas" },
  { key: "criteria", label: "Criterio de éxito" },
  { key: "decision", label: "Decisión" },
];

const QUADRANT_LABEL: Record<Quadrant, string> = {
  test_now: "Probar ahora",
  keep_evidence: "Mantener con evidencia",
  deprioritize: "Despriorizar",
  park: "Aparcar",
};

function indexOne<T extends { hypothesis_id: string }>(list: T[] | undefined): Record<string, T> {
  return Object.fromEntries((list || []).map((x) => [x.hypothesis_id, x]));
}

function indexMany<T extends { hypothesis_id: string }>(list: T[] | undefined): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of list || []) (out[x.hypothesis_id] ||= []).push(x);
  return out;
}

interface Props {
  hypotheses: Hypothesis[];
  classifications?: Classification[];
  prioritization?: Prioritization[];
  recommendations?: ExperimentRec[];
  metricSpecs?: MetricSpec[];
  successCriteria?: SuccessCriterion[];
  decisions?: DecisionRule[];
}

/** Roadmap metodológico de validación por hipótesis: proyección visual de solo lectura sobre el Blueprint ya expuesto por el backend. No mantiene estado propio de negocio. */
export function HypothesisRoadmap({
  hypotheses,
  classifications,
  prioritization,
  recommendations,
  metricSpecs,
  successCriteria,
  decisions,
}: Props) {
  const [selectedH, setSelectedH] = useState<string | null>(null);
  const [openStage, setOpenStage] = useState<StageKey | null>(null);

  if (!hypotheses.length) return null;

  const clsByH = indexOne(classifications);
  const prioByH = indexOne(prioritization);
  const recsByH = indexMany(recommendations);
  const metricsByH = indexMany(metricSpecs);
  const criteriaByH = indexMany(successCriteria);
  const decisionsByH = indexMany(decisions);

  const activeHyp = selectedH ? hypotheses.find((h) => h.id === selectedH) ?? null : null;

  function selectHyp(id: string) {
    setSelectedH((prev) => (prev === id ? null : id));
    setOpenStage(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-ink/70">Roadmap de Hipótesis</h3>
        <p className="mt-0.5 text-xs text-ink/45">Elegí una hipótesis para ver el camino que recorre en el proceso Lean.</p>
      </div>

      <HypothesisNodeGraph hypotheses={hypotheses} selectedId={selectedH} onSelect={selectHyp} />

      {activeHyp && (
        <HypothesisFlow
          key={activeHyp.id}
          hypothesis={activeHyp}
          classification={clsByH[activeHyp.id]}
          prioritization={prioByH[activeHyp.id]}
          recommendations={recsByH[activeHyp.id] || []}
          metrics={metricsByH[activeHyp.id] || []}
          criteria={criteriaByH[activeHyp.id] || []}
          decisions={decisionsByH[activeHyp.id] || []}
          openStage={openStage}
          setOpenStage={setOpenStage}
        />
      )}
    </div>
  );
}

const DOT_GRID = {
  backgroundImage: "radial-gradient(circle, rgb(var(--border)) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

/** Distribución determinística tipo "semillas de girasol": esparce N puntos en un lienzo circular sin superponerse ni formar una grilla. Puramente decorativa. */
function scatterLayout(n: number): { x: number; y: number }[] {
  if (n <= 1) return [{ x: 50, y: 50 }];
  const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
  const maxRadius = 40;
  return Array.from({ length: n }, (_, i) => {
    const r = maxRadius * Math.sqrt((i + 0.5) / n);
    const theta = i * GOLDEN_ANGLE;
    // Redondeado a 2 decimales: Math.cos/sin pueden diferir en el último dígito entre el
    // motor JS del server (SSR) y el del navegador, lo que dispara un mismatch de hidratación.
    return { x: round2(50 + r * Math.cos(theta)), y: round2(50 + r * Math.sin(theta)) };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Conecta cada punto con sus k vecinos más próximos, sin duplicar aristas. Solo estética: no representa relaciones entre hipótesis. */
function nearestNeighborEdges(points: { x: number; y: number }[], k = 3): [number, number][] {
  const edges = new Map<string, [number, number]>();
  points.forEach((p, i) => {
    const nearest = points
      .map((q, j) => ({ j, dist: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k);
    nearest.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      edges.set(key, i < j ? [i, j] : [j, i]);
    });
  });
  return Array.from(edges.values());
}

function HypothesisNodeGraph({
  hypotheses,
  selectedId,
  onSelect,
}: {
  hypotheses: Hypothesis[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const points = scatterLayout(hypotheses.length);
  const edges = nearestNeighborEdges(points);
  const selectedIndex = selectedId ? hypotheses.findIndex((h) => h.id === selectedId) : -1;
  const wide = hypotheses.length > 8;

  return (
    <div
      className={`relative mx-auto aspect-square w-full rounded-2xl border border-line/70 bg-paper/40 ${wide ? "max-w-md" : "max-w-xs"}`}
      style={DOT_GRID}
      role="group"
      aria-label="Hipótesis"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        {edges.map(([a, b], i) => {
          const touchesSelected = selectedIndex >= 0 && (a === selectedIndex || b === selectedIndex);
          return (
            <line
              key={i}
              x1={points[a].x}
              y1={points[a].y}
              x2={points[b].x}
              y2={points[b].y}
              stroke="#1f9670"
              strokeWidth={touchesSelected ? 0.6 : 0.3}
              strokeOpacity={touchesSelected ? 0.85 : 0.25}
              className="transition-all duration-200"
            />
          );
        })}
      </svg>

      {hypotheses.map((h, i) => {
        const p = points[i];
        const active = selectedId === h.id;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            aria-pressed={active}
            aria-label={`Hipótesis ${h.id}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 font-mono text-xs font-semibold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
              active
                ? "z-10 scale-110 border-blueprint-500 bg-blueprint-500 text-white shadow-glow"
                : "border-line bg-surface text-ink/70 hover:scale-105 hover:border-blueprint-300 hover:text-ink"
            }`}
          >
            {h.id}
          </button>
        );
      })}
    </div>
  );
}

function HypothesisFlow({
  hypothesis,
  classification,
  prioritization,
  recommendations,
  metrics,
  criteria,
  decisions,
  openStage,
  setOpenStage,
}: {
  hypothesis: Hypothesis;
  classification?: Classification;
  prioritization?: Prioritization;
  recommendations: ExperimentRec[];
  metrics: MetricSpec[];
  criteria: SuccessCriterion[];
  decisions: DecisionRule[];
  openStage: StageKey | null;
  setOpenStage: (v: StageKey | null) => void;
}) {
  const availability: Record<StageKey, boolean> = {
    hypothesis: true,
    classification: !!classification,
    risk: !!classification?.risk_level || !!prioritization,
    experiment: recommendations.length > 0,
    metrics: metrics.length > 0,
    criteria: criteria.length > 0,
    decision: decisions.length > 0,
  };

  const selectedPos = openStage ? 1 + STAGES.findIndex((s) => s.key === openStage) : -1;
  const hypothesisAvailable = availability.hypothesis;
  const rootBridgeActive = selectedPos >= 0 ? selectedPos >= 1 : hypothesisAvailable;

  return (
    <div className="animate-fade-up space-y-5">
      {/* Lienzo del grafo: nodo raíz (hipótesis) + cadena de etapas conectadas.
          Vertical en mobile; horizontal en desktop para ver el recorrido completo de un vistazo. */}
      <div className="flex flex-col items-center rounded-2xl border border-line/70 bg-paper/40 px-4 py-6" style={DOT_GRID}>
        <GraphNode isRoot label={hypothesis.id} caption={hypothesis.statement} />
        <RootBridge active={rootBridgeActive} />

        <div className="flex flex-col items-center md:w-full md:flex-row md:flex-nowrap md:items-start md:justify-center md:gap-0 md:overflow-x-auto md:pb-1">
          {STAGES.map((s, i) => {
            const pos = i + 1;
            const available = availability[s.key];
            const isOpen = openStage === s.key;
            const traversed = selectedPos >= 0 && pos <= selectedPos;
            return (
              <div key={s.key} className="flex flex-col items-center md:flex-row md:items-start">
                {i > 0 && <Connector active={traversed || (selectedPos < 0 && available)} />}
                <GraphNode
                  icon={s.key}
                  label={s.label}
                  caption={available ? "Disponible" : "Pendiente"}
                  available={available}
                  selected={isOpen}
                  traversed={traversed}
                  onClick={() => setOpenStage(isOpen ? null : s.key)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspector: detalle de la etapa seleccionada, separado del grafo */}
      <div className="min-h-[220px] rounded-2xl border border-line bg-surface p-5">
        {openStage ? (
          <div className="animate-fade-in">
            <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  availability[openStage] ? "bg-blueprint-500 text-white" : "border-2 border-dashed border-line text-ink/40"
                }`}
              >
                <StageIcon stage={openStage} className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{STAGES.find((s) => s.key === openStage)?.label}</p>
                <p className={`text-[11px] font-medium ${availability[openStage] ? "text-ok-ink" : "text-ink/40"}`}>
                  {availability[openStage] ? "Disponible" : "Pendiente"}
                </p>
              </div>
            </div>
            <StageDetail
              stage={openStage}
              hypothesis={hypothesis}
              classification={classification}
              prioritization={prioritization}
              recommendations={recommendations}
              metrics={metrics}
              criteria={criteria}
              decisions={decisions}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[188px] flex-col items-center justify-center text-center">
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-line text-ink/30" aria-hidden>
              ↖
            </span>
            <p className="mt-3 max-w-[22rem] text-sm text-ink/45">Elegí una etapa del grafo para ver su detalle.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Puente vertical fijo: siempre conecta el nodo raíz (hipótesis) con el inicio de la cadena de etapas. */
function RootBridge({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className={`h-3 w-0.5 rounded-full ${active ? "bg-blueprint-500" : "bg-line"}`} />
      <span
        className={`text-[10px] leading-none ${active ? "text-blueprint-500" : "text-line"}`}
        style={active ? { textShadow: "0 0 6px rgb(var(--tint))" } : undefined}
      >
        ▼
      </span>
      <span className={`h-3 w-0.5 rounded-full ${active ? "bg-blueprint-500" : "bg-line"}`} />
    </div>
  );
}

/** Conector entre etapas: vertical (flecha ▼) en mobile, horizontal (flecha ▶) en desktop. */
function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center md:mt-4 md:flex-row" aria-hidden>
      <span className={`h-3 w-0.5 rounded-full md:h-0.5 md:w-3 ${active ? "bg-blueprint-500" : "bg-line"}`} />
      <span
        className={`inline-block text-[10px] leading-none md:-rotate-90 ${active ? "text-blueprint-500" : "text-line"}`}
        style={active ? { textShadow: "0 0 6px rgb(var(--tint))" } : undefined}
      >
        ▼
      </span>
      <span className={`h-3 w-0.5 rounded-full md:h-0.5 md:w-3 ${active ? "bg-blueprint-500" : "bg-line"}`} />
    </div>
  );
}

function GraphNode({
  isRoot,
  icon,
  label,
  caption,
  available,
  selected,
  traversed,
  onClick,
}: {
  isRoot?: boolean;
  icon?: StageKey;
  label: string;
  caption: string;
  available?: boolean;
  selected?: boolean;
  traversed?: boolean;
  onClick?: () => void;
}) {
  const circle = isRoot
    ? "h-14 w-14 border-night bg-night text-white shadow-md"
    : available
      ? `h-12 w-12 border-blueprint-500 bg-blueprint-500 text-white ${selected ? "shadow-glow ring-4 ring-blueprint-300/30" : "shadow-sm"}`
      : traversed
        ? "h-12 w-12 border-2 border-dashed border-blueprint-400 bg-surface text-blueprint-500"
        : "h-12 w-12 border-2 border-dashed border-line bg-surface text-ink/25";

  const inner = isRoot ? (
    <span className="font-mono text-xs font-semibold">{label}</span>
  ) : (
    <StageIcon stage={icon!} className="h-5 w-5" />
  );

  const node = (
    <span className={`grid shrink-0 place-items-center rounded-full border-2 transition-transform duration-200 ${circle} ${selected ? "scale-110" : ""}`}>
      {inner}
    </span>
  );

  const labelBlock = (
    <>
      {!isRoot && (
        <p className={`mt-1.5 max-w-[9.5rem] text-center text-xs font-semibold leading-tight ${selected ? "text-blueprint-700 dark:text-blueprint-300" : "text-ink/80"}`}>
          {label}
        </p>
      )}
      <p className={`max-w-[9.5rem] truncate text-center text-[10px] ${isRoot ? "mt-1.5 italic text-ink/40" : available ? "text-ok-ink" : "text-ink/35"}`}>
        {caption}
      </p>
    </>
  );

  if (isRoot) {
    return (
      <div className="flex flex-col items-center">
        {node}
        {labelBlock}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={selected}
      aria-label={`${label}: ${available ? "disponible" : "pendiente"}`}
      className="flex flex-col items-center rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      {node}
      {labelBlock}
    </button>
  );
}

function StageIcon({ stage, className }: { stage: StageKey; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (stage) {
    case "hypothesis":
      return (
        <svg {...common}>
          <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z" />
          <path d="M9.5 21h5" />
        </svg>
      );
    case "classification":
      return (
        <svg {...common}>
          <path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8z" />
          <circle cx="7.5" cy="7.5" r="1.4" />
        </svg>
      );
    case "risk":
      return (
        <svg {...common}>
          <path d="M12 3 2 20h20L12 3z" />
          <path d="M12 10v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "experiment":
      return (
        <svg {...common}>
          <path d="M9 2h6" />
          <path d="M10 2v6.5L4.6 19.4A1.6 1.6 0 0 0 6 21.8h12a1.6 1.6 0 0 0 1.4-2.4L14 8.5V2" />
          <path d="M7.5 15h9" />
        </svg>
      );
    case "metrics":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <rect x="7" y="13" width="3" height="5" />
          <rect x="12" y="9" width="3" height="9" />
          <rect x="17" y="5" width="3" height="13" />
        </svg>
      );
    case "criteria":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "decision":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 5-5" />
        </svg>
      );
  }
}

function StageDetail({
  stage,
  hypothesis,
  classification,
  prioritization,
  recommendations,
  metrics,
  criteria,
  decisions,
}: {
  stage: StageKey;
  hypothesis: Hypothesis;
  classification?: Classification;
  prioritization?: Prioritization;
  recommendations: ExperimentRec[];
  metrics: MetricSpec[];
  criteria: SuccessCriterion[];
  decisions: DecisionRule[];
}) {
  switch (stage) {
    case "hypothesis":
      return (
        <div className="space-y-1 text-sm">
          <p className="text-ink/85">{hypothesis.statement}</p>
          <p className="annot">
            Bloque: {hypothesis.source_block}
            {hypothesis.is_counter_hypothesis ? " · contra-hipótesis" : ""}
          </p>
        </div>
      );

    case "classification":
      if (!classification) return <Pending text="La clasificación de riesgo todavía no fue generada." />;
      return (
        <div className="space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge type={classification.risk_type} />
            <span className="annot">{classification.bmc_block}</span>
          </div>
          <p className="text-ink/70">{classification.rationale}</p>
        </div>
      );

    case "risk":
      if (!classification?.risk_level && !prioritization) return <Pending text="El nivel de riesgo todavía no fue calculado." />;
      return (
        <div className="space-y-2 text-sm">
          {classification?.risk_level && (
            <StatusBadge status={riskLevelStatus(classification.risk_level)}>Riesgo {classification.risk_level}</StatusBadge>
          )}
          {prioritization && (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-ink/80">
                <span>Importancia: <strong className="font-mono">{prioritization.importance.toFixed(2)}</strong></span>
                <span>Evidencia: <strong className="font-mono">{prioritization.evidence.toFixed(2)}</strong></span>
                <span>Cuadrante: <strong>{QUADRANT_LABEL[prioritization.quadrant]}</strong></span>
              </div>
              {prioritization.is_riskiest && <span className="badge bg-accent-500 text-ink">▲ probar primero</span>}
              <p className="text-ink/70">{prioritization.rationale}</p>
            </>
          )}
        </div>
      );

    case "experiment":
      if (!recommendations.length) return <Pending text="Todavía no se generaron experimentos para esta hipótesis." />;
      return (
        <ul className="space-y-2 text-sm">
          {recommendations.map((r) => (
            <li key={r.experiment_id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blueprint-700 dark:text-blueprint-300">{r.experiment_id}</span>
                <span className="font-medium text-ink">{r.experiment_name}</span>
                <span className="badge bg-paper text-ink/60">{r.stage === "discovery" ? "Descubrimiento" : "Validación"}</span>
                <span className="badge bg-paper text-ink/60">Costo {r.cost}/5</span>
              </div>
              <p className="mt-1 text-ink/70">{r.rationale}</p>
            </li>
          ))}
        </ul>
      );

    case "metrics":
      if (!metrics.length) return <Pending text="Todavía no se definieron métricas." />;
      return (
        <ul className="space-y-2 text-sm">
          {metrics.map((m, i) => (
            <li key={`${m.experiment_id}-${i}`} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blueprint-700 dark:text-blueprint-300">{m.experiment_id}</span>
                <span className="font-medium text-ink">{m.metric}</span>
              </div>
              <p className="annot mt-0.5">Fuente: {m.data_source}</p>
              <p className="mt-1 text-ink/70">{m.rationale}</p>
            </li>
          ))}
        </ul>
      );

    case "criteria":
      if (!criteria.length) return <Pending text="Todavía no se definió el criterio de éxito." />;
      return (
        <ul className="space-y-2 text-sm">
          {criteria.map((c, i) => (
            <li key={`${c.experiment_id}-${i}`} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blueprint-700 dark:text-blueprint-300">{c.experiment_id}</span>
                <span className="font-medium text-ink">{c.criterion}</span>
              </div>
              <p className="annot mt-0.5">Umbral: {c.threshold}</p>
              <StatusBadge status={evidenceStatus(c.expected_evidence_strength)}>Evidencia {c.expected_evidence_strength}/5</StatusBadge>
            </li>
          ))}
        </ul>
      );

    case "decision":
      if (!decisions.length) return <Pending text="Todavía no existe una regla de decisión." />;
      return (
        <ul className="space-y-2 text-sm">
          {decisions.map((d, i) => (
            <li key={`${d.experiment_id}-${i}`} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <span className="annot">{d.experiment_id} · {d.recommended_decision}</span>
              <p className="mt-1 text-ok-ink">✓ Si se valida: {d.if_validated}</p>
              <p className="mt-0.5 text-danger-ink">✗ Si no: {d.if_invalidated}</p>
            </li>
          ))}
        </ul>
      );
  }
}

function Pending({ text }: { text: string }) {
  return <p className="text-sm italic text-ink/45">{text}</p>;
}

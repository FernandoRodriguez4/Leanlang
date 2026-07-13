"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL, apiGet, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { runBlueprint, resumeBlueprint } from "@/lib/stream";
import type { Blueprint, Hypothesis, Prioritization, Project, SSEEvent } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { AgentStreamPanel, TraceItem } from "@/components/AgentStreamPanel";
import { BlueprintNav, NavStage } from "@/components/BlueprintNav";
import { HypothesisList } from "@/components/HypothesisList";
import { HypothesisRoadmap } from "@/components/HypothesisRoadmap";
import { PrioritizationPanel } from "@/components/PrioritizationPanel";
import { ExperimentsPanel } from "@/components/ExperimentsPanel";
import { TestCardsPanel } from "@/components/TestCardsPanel";
import { CriticReviewView } from "@/components/CriticReview";
import dynamic from "next/dynamic";
import { OverviewPanel } from "@/components/OverviewPanel";
import { ResearchPanel } from "@/components/ResearchPanel";
import { LienzoPanel } from "@/components/LienzoPanel";
import { ReportPanel } from "@/components/ReportPanel";
import { VersionSelect, BlueprintVersion } from "@/components/VersionSelect";
import { BrandMark } from "@/components/BrandMark";

// Carga diferida: solo se descarga al entrar en modo comparación.
const CompareView = dynamic(() => import("@/components/CompareView").then((m) => m.CompareView), {
  loading: () => <div className="card h-64 animate-pulse bg-line/40" />,
});

type Phase = "loading" | "idle" | "running" | "interrupt" | "done" | "error";
type StageKey = "investigacion" | "resumen" | "lienzo" | "hypotheses" | "risk" | "experiments" | "testcards" | "critic" | "report";

const STAGE_DEFS: { key: StageKey; label: string; blurb: string }[] = [
  { key: "resumen", label: "Resumen", blurb: "Panorama del blueprint y accesos directos." },
  { key: "investigacion", label: "Investigación", blurb: "Evidencia externa recopilada antes de trazar el blueprint." },
  { key: "lienzo", label: "Lienzo", blurb: "Problema, segmento objetivo y propuesta de valor." },
  { key: "hypotheses", label: "Hipótesis", blurb: "Supuestos clave como hipótesis testables, etiquetadas por riesgo." },
  { key: "risk", label: "Riesgo", blurb: "Tipo y nivel de riesgo, y qué probar primero (mapa 2×2)." },
  { key: "experiments", label: "Experimentos", blurb: "Experimentos del catálogo con su diseño concreto." },
  { key: "testcards", label: "Test Cards", blurb: "Métrica y criterio de éxito por experimento." },
  { key: "critic", label: "Crítica", blurb: "Auditoría de calidad del diseño contra las trampas conocidas." },
  { key: "report", label: "Informe", blurb: "Informe consolidado del plan de validación." },
];

const GATE_STAGE: Record<string, StageKey> = {
  review_hypotheses: "hypotheses",
  review_prioritization: "risk",
  approve_blueprint: "report",
};

function readyFor(bp: Blueprint, key: StageKey): boolean {
  switch (key) {
    case "investigacion": return !!bp.research;
    case "resumen": return !!bp.problem || !!bp.hypotheses?.length;
    case "lienzo": return !!bp.problem || !!bp.customer_segment || !!bp.value_proposition;
    case "hypotheses": return !!bp.hypotheses?.length;
    case "risk": return !!bp.prioritization?.length;
    case "experiments": return !!bp.recommendations?.length;
    case "testcards": return !!bp.test_cards?.length;
    case "critic": return !!bp.critic_review;
    case "report": return !!bp.report;
  }
}

function countFor(bp: Blueprint, key: StageKey): number | undefined {
  switch (key) {
    case "hypotheses": return bp.hypotheses?.length;
    case "risk": return bp.prioritization?.length;
    case "experiments": return bp.recommendations?.length;
    case "testcards": return bp.test_cards?.length;
    case "critic": return bp.critic_review?.issues?.length;
    default: return undefined;
  }
}

function inferInterrupt(bp: Blueprint): string | null {
  if (bp.report) return "approve_blueprint";
  if (bp.prioritization?.length && !bp.recommendations?.length) return "review_prioritization";
  if (bp.hypotheses?.length && !bp.classifications?.length) return "review_hypotheses";
  if (bp.prioritization?.length) return "review_prioritization";
  if (bp.hypotheses?.length) return "review_hypotheses";
  return null;
}

function deriveTrace(bp: Blueprint): TraceItem[] {
  const t: TraceItem[] = [];
  if (bp.research) t.push({ node: "research", trace: "Investigación de evidencia externa." });
  if (bp.problem) t.push({ node: "problem", trace: "Problema estructurado." });
  if (bp.customer_segment) t.push({ node: "customer_segment", trace: "Segmento definido." });
  if (bp.value_proposition) t.push({ node: "value_proposition", trace: "Propuesta de valor." });
  if (bp.business_model) t.push({ node: "business_model", trace: "Modelo de negocio (BMC)." });
  if (bp.hypotheses?.length) t.push({ node: "hypotheses", trace: `${bp.hypotheses.length} hipótesis.` });
  if (bp.classifications?.length) t.push({ node: "risk", trace: "Riesgo D/F/V + 2×2." });
  if (bp.recommendations?.length) t.push({ node: "experiment_design", trace: `${bp.recommendations.length} experimentos.` });
  if (bp.metric_specs?.length) t.push({ node: "metrics", trace: `${bp.metric_specs.length} métricas.` });
  if (bp.success_criteria?.length) t.push({ node: "success_criteria", trace: `${bp.success_criteria.length} criterios.` });
  if (bp.decisions?.length) t.push({ node: "decision", trace: `${bp.decisions.length} reglas de decisión.` });
  if (bp.validation_roadmap) t.push({ node: "sequencing", trace: "Roadmap de validación." });
  if (bp.plan_estimate) t.push({ node: "plan_estimate", trace: "Estimación de costo/tiempo." });
  if (bp.critic_review) t.push({ node: "critic", trace: `Calidad ${Math.round((bp.critic_review.quality_score ?? 0) * 100)}%.` });
  if (bp.report) t.push({ node: "report", trace: "Informe consolidado." });
  return t;
}

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const { authed, ready } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<BlueprintVersion[]>([]);
  const [trace, setTrace] = useState<TraceItem[]>([]);
  const [bp, setBp] = useState<Blueprint>({});
  const [phase, setPhase] = useState<Phase>("loading");
  const [interruptType, setInterruptType] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<StageKey>("resumen");
  const [focusHyp, setFocusHyp] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const pinned = useRef(false);

  useEffect(() => {
    if (ready && !authed) router.replace("/login");
  }, [authed, ready, router]);

  const applyState = useCallback((state: Blueprint, status: string, isLatest: boolean) => {
    setReadOnly(!isLatest);
    setBp(state);
    setTrace(deriveTrace(state));
    if (status === "done") { setPhase("done"); setInterruptType(null); }
    else if (status === "awaiting_input") {
      setInterruptType(isLatest ? inferInterrupt(state) : null);
      setPhase("interrupt");
    } else {
      const inf = isLatest ? inferInterrupt(state) : null;
      setInterruptType(inf);
      setPhase(Object.keys(state).length ? "interrupt" : "idle");
    }
  }, []);

  async function refreshVersions(): Promise<BlueprintVersion[]> {
    try {
      const list = await apiGet<BlueprintVersion[]>(`/projects/${id}/blueprints`);
      setVersions(list);
      return list;
    } catch { return []; }
  }

  // Carga del proyecto + rehidratación del último blueprint.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const proj = await apiGet<Project>(`/projects/${id}`);
        if (cancelled) return;
        setProject(proj);
        const list = await refreshVersions();
        if (cancelled) return;
        if (!list.length) return setPhase("idle");
        const latest = list[0];
        const full = await apiGet<{ status: string; blueprint: Blueprint }>(`/blueprint/${latest.id}`);
        if (cancelled) return;
        setBlueprintId(latest.id);
        applyState(full.blueprint || {}, full.status, true);
      } catch {
        if (!cancelled) setPhase("idle");
      }
    })();
    return () => { cancelled = true; };
  }, [authed, id, applyState]);

  async function loadVersion(vid: string) {
    if (vid === blueprintId) return;
    const isLatest = versions[0]?.id === vid;
    pinned.current = false;
    setComparing(false);
    setActiveKey("resumen");
    try {
      const full = await apiGet<{ status: string; blueprint: Blueprint }>(`/blueprint/${vid}`);
      setBlueprintId(vid);
      applyState(full.blueprint || {}, full.status, isLatest);
    } catch { /* noop */ }
  }

  const { stages, readySet, doneSet, gateKey, runningKey } = useMemo(() => {
    const readySet = new Set<string>();
    STAGE_DEFS.forEach((s) => { if (readyFor(bp, s.key)) readySet.add(s.key); });
    const indices = STAGE_DEFS.map((s, i) => (readySet.has(s.key) ? i : -1));
    const maxReady = Math.max(-1, ...indices);
    const doneSet = new Set<string>();
    STAGE_DEFS.forEach((s, i) => {
      if (readySet.has(s.key) && (i < maxReady || phase === "done")) doneSet.add(s.key);
    });
    const gateKey = phase === "interrupt" && interruptType ? GATE_STAGE[interruptType] ?? null : null;
    const runningKey = phase === "running" && maxReady >= 0 ? STAGE_DEFS[maxReady].key : null;
    const stages: NavStage[] = STAGE_DEFS.map((s) => ({ key: s.key, label: s.label, n: countFor(bp, s.key) }));
    return { stages, readySet, doneSet, gateKey, runningKey };
  }, [bp, phase, interruptType]);

  // Auto-enfoque de estación (salvo que el usuario haya fijado una).
  useEffect(() => {
    if (phase === "interrupt" && gateKey) { pinned.current = false; setActiveKey(gateKey as StageKey); return; }
    if (phase === "done") { pinned.current = false; setActiveKey("report"); return; }
    if (phase === "running" && !pinned.current) {
      const r = STAGE_DEFS.filter((s) => readySet.has(s.key));
      if (r.length) setActiveKey(r[r.length - 1].key);
    }
  }, [phase, gateKey, readySet]);

  const onEvent = useCallback((ev: SSEEvent) => {
    switch (ev.event) {
      case "started": setBlueprintId(ev.blueprint_id); break;
      case "agent_update":
        setTrace((t) => [...t, { node: ev.node, trace: ev.trace }]);
        if (ev.artifacts) setBp((b) => ({ ...b, ...ev.artifacts }));
        break;
      case "interrupt": setInterruptType(ev.type); break;
      case "awaiting_input": setBp((b) => ({ ...b, ...ev.blueprint })); setPhase("interrupt"); break;
      case "done": setBp((b) => ({ ...b, ...ev.blueprint })); setPhase("done"); setInterruptType(null); break;
      case "error": setError(ev.message); setPhase("error"); break;
    }
  }, []);

  async function start() {
    setTrace([]); setBp({}); setError(""); setPhase("running"); setInterruptType(null); setBlueprintId(null);
    setReadOnly(false); setComparing(false); pinned.current = false; setActiveKey("resumen");
    try { await runBlueprint(id, onEvent); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); setPhase("error"); }
    refreshVersions();
  }

  async function resume(stage: string, payload: Record<string, unknown>) {
    if (!blueprintId) return;
    const prevInterrupt = interruptType;
    setError(""); setPhase("running"); setInterruptType(null); setReadOnly(false); pinned.current = false;
    try {
      await resumeBlueprint(blueprintId, stage, payload, onEvent);
    } catch (e) {
      // El backend puede rechazar el resume (ej. 422 al editar hipotesis) antes de
      // abrir el stream. Volvemos al mismo interrupt en vez de "error": el usuario
      // no debe perder su edicion ni terminar en la pantalla de "Reintentar" (que
      // reinicia el blueprint completo desde cero).
      setError(e instanceof Error ? e.message : "Error");
      setInterruptType(prevInterrupt);
      setPhase("interrupt");
    }
    refreshVersions();
  }

  async function download(format: "md" | "json") {
    if (!blueprintId) return;
    const res = await fetch(`${API_URL}/blueprint/${blueprintId}/export?format=${format}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `blueprint.${format}`; a.click();
    URL.revokeObjectURL(url);
  }

  function selectStage(k: string) { pinned.current = true; setActiveKey(k as StageKey); }
  function jumpTo(k: string) { pinned.current = true; setActiveKey(k as StageKey); }
  function focusHypAndJump(hid: string) { setFocusHyp(hid); jumpTo("experiments"); }

  const hasContent = Object.keys(bp).length > 0;
  const def = STAGE_DEFS.find((s) => s.key === activeKey)!;
  const idle = phase === "idle" && !hasContent;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="contenido" className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="annot mb-1.5 inline-flex items-center gap-1 hover:text-ink">← Proyectos</Link>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{project?.name || "Proyecto"}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readOnly ? (
              <span className="badge bg-paper text-ink/60"><span className="h-1.5 w-1.5 rounded-full bg-ink/30" /> Solo lectura</span>
            ) : (
              <StatusPill phase={phase} />
            )}
            {phase !== "running" && phase !== "loading" && !comparing && (
              <VersionSelect versions={versions} currentId={blueprintId} onSelect={loadVersion} />
            )}
            {versions.length >= 2 && phase !== "running" && phase !== "loading" && (
              <button onClick={() => setComparing((v) => !v)} className="btn-secondary">
                {comparing ? "Volver" : "Comparar"}
              </button>
            )}
            {phase === "idle" && <button onClick={start} className="btn-primary">Trazar blueprint</button>}
            {(phase === "done" || phase === "interrupt") && hasContent && (
              <button onClick={start} className="btn-secondary">Nueva versión</button>
            )}
            {phase === "error" && <button onClick={start} className="btn-primary">Reintentar</button>}
            {phase === "done" && (
              <>
                <button onClick={() => download("md")} className="btn-secondary">Exportar .md</button>
                <button onClick={() => download("json")} className="btn-secondary">Exportar .json</button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-desire/40 bg-desire-soft/60 px-4 py-3 text-sm text-desire-ink">{error}</div>
        )}

        {phase === "loading" ? (
          <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
            <div className="card h-80 animate-pulse bg-line/40" />
            <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="card h-28 animate-pulse bg-line/40" />)}</div>
          </div>
        ) : comparing ? (
          <CompareView versions={versions} initialA={blueprintId} onClose={() => setComparing(false)} />
        ) : idle ? (
          <EmptyState onStart={start} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="card p-3">
                <BlueprintNav
                  stages={stages} activeKey={activeKey} readySet={readySet} doneSet={doneSet}
                  gateKey={gateKey} runningKey={runningKey} onSelect={selectStage}
                />
              </div>
              <div className="hidden lg:block">
                <AgentStreamPanel items={trace} running={phase === "running"} />
              </div>
            </div>

            <section id="stage-panel" role="tabpanel" aria-label={def.label} aria-busy={phase === "running"} className="min-w-0">
              <div className="mb-4">
                <h2 className="font-display text-xl font-bold tracking-tight text-ink">{def.label}</h2>
                <p className={`text-sm text-ink/60 ${activeKey === "risk" ? "mt-2" : "mt-0.5"}`}>{def.blurb}</p>
              </div>
              <div key={activeKey} className="animate-fade-in">
                <StagePanel
                  stageKey={activeKey} bp={bp} phase={phase} interruptType={interruptType}
                  focusHyp={focusHyp} setFocusHyp={setFocusHyp}
                  onResume={resume} onJump={jumpTo} onFocusHyp={focusHypAndJump} onExport={download}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function StagePanel({
  stageKey, bp, phase, interruptType, focusHyp, setFocusHyp, onResume, onJump, onFocusHyp, onExport,
}: {
  stageKey: StageKey;
  bp: Blueprint;
  phase: Phase;
  interruptType: string | null;
  focusHyp: string | null;
  setFocusHyp: (v: string | null) => void;
  onResume: (stage: string, payload: Record<string, unknown>) => void;
  onJump: (k: string) => void;
  onFocusHyp: (hid: string) => void;
  onExport: (f: "md" | "json") => void;
}) {
  // Única fuente de verdad para la colección de hipótesis en revisión: la comparten
  // la lista de tarjetas y el Roadmap, evitando estado paralelo entre ambos.
  const [editedHyps, setEditedHyps] = useState<Hypothesis[]>(() => (bp.hypotheses as Hypothesis[]) || []);
  useEffect(() => setEditedHyps((bp.hypotheses as Hypothesis[]) || []), [bp.hypotheses]);

  if (!readyFor(bp, stageKey)) return <Working />;

  switch (stageKey) {
    case "investigacion":
      return <ResearchPanel report={bp.research!} />;

    case "resumen":
      return <OverviewPanel bp={bp} onJump={onJump} />;

    case "lienzo":
      return <LienzoPanel bp={bp} />;

    case "hypotheses":
      return (
        <div className="space-y-6">
          <HypothesisRoadmap
            hypotheses={editedHyps}
            classifications={bp.classifications}
            prioritization={bp.prioritization}
            recommendations={bp.recommendations}
            metricSpecs={bp.metric_specs}
            successCriteria={bp.success_criteria}
            decisions={bp.decisions}
          />

          <div className="border-t border-line pt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-ink/70">Lista de hipótesis</h3>
              <RiskLegend bp={bp} />
            </div>
            <HypothesisList
              hypotheses={editedHyps}
              classifications={bp.classifications}
              prioritization={bp.prioritization}
              editable={interruptType === "review_hypotheses"}
              onChange={setEditedHyps}
              onConfirm={(edited) => onResume("hypotheses", { hypotheses: edited })}
              onFocusHyp={onFocusHyp}
            />
          </div>
        </div>
      );

    case "risk":
      return (
        <PrioritizationPanel
          items={bp.prioritization as Prioritization[]}
          hypotheses={(bp.hypotheses as Hypothesis[]) || []}
          editable={interruptType === "review_prioritization"}
          onConfirm={(edited) => onResume("prioritization", { prioritization: edited })}
        />
      );

    case "experiments":
      return <ExperimentsPanel recs={bp.recommendations!} roadmap={bp.validation_roadmap} estimate={bp.plan_estimate} focusHyp={focusHyp} onFocus={setFocusHyp} />;

    case "testcards":
      return <TestCardsPanel cards={bp.test_cards!} decisions={bp.decisions} focusHyp={focusHyp} onFocus={setFocusHyp} />;

    case "critic":
      return <CriticReviewView review={bp.critic_review!} />;

    case "report":
      return (
        <div className="space-y-4">
          <ReportPanel report={bp.report!} onExport={phase === "done" ? onExport : undefined} />
          {interruptType === "approve_blueprint" && (
            <button onClick={() => onResume("approval", { approved: true })} className="btn-amber w-full sm:w-auto">
              ✓ Aprobar blueprint
            </button>
          )}
          {phase === "done" && (
            <div className="rounded-2xl border border-viab/30 bg-viab-soft/60 p-5 text-center">
              <p className="font-display font-semibold text-viab-ink">Blueprint aprobado y completo 🎉</p>
              <p className="mt-1 text-sm text-viab-ink/80">Expórtalo en Markdown o JSON arriba o aquí.</p>
            </div>
          )}
        </div>
      );
  }
}

function RiskLegend({ bp }: { bp: Blueprint }) {
  const cls = bp.classifications;
  if (!cls?.length) return null;
  const count = (t: string) => cls.filter((c) => c.risk_type === t).length;
  const rows = [
    { k: "Deseabilidad", n: count("desirability"), cls: "bg-desire-soft text-desire-ink", dot: "bg-desire" },
    { k: "Factibilidad", n: count("feasibility"), cls: "bg-feas-soft text-feas-ink", dot: "bg-feas" },
    { k: "Viabilidad", n: count("viability"), cls: "bg-viab-soft text-viab-ink", dot: "bg-viab" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((r) => (
        <span key={r.k} className={`badge ${r.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} /> {r.k} · {r.n}
        </span>
      ))}
    </div>
  );
}

function Working() {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="anim-pulse2 grid h-10 w-10 place-items-center rounded-full bg-blueprint-500/15 text-blueprint-600 dark:text-blueprint-300">●</span>
      <p className="mt-3 text-sm text-ink/55">Trazando esta estación…</p>
    </div>
  );
}

function StatusPill({ phase }: { phase: Phase }) {
  const map: Record<Phase, { t: string; c: string; dot: string }> = {
    loading: { t: "Cargando", c: "bg-paper text-ink/55", dot: "bg-ink/30" },
    idle: { t: "Sin iniciar", c: "bg-paper text-ink/55", dot: "bg-ink/30" },
    running: { t: "Trazando", c: "bg-blueprint-500/15 text-blueprint-700 dark:text-blueprint-300", dot: "anim-pulse2 bg-blueprint-500" },
    interrupt: { t: "Tu turno", c: "bg-accent-500/15 text-accent-700", dot: "anim-pulse2 bg-accent-500" },
    done: { t: "Completado", c: "bg-viab-soft text-viab-ink", dot: "bg-viab" },
    error: { t: "Error", c: "bg-desire-soft text-desire-ink", dot: "bg-desire" },
  };
  const s = map[phase];
  return <span className={`badge ${s.c}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.t}</span>;
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="card relative overflow-hidden px-6 py-20 text-center">
      <div className="bp-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blueprint-600 text-white">
          <BrandMark size={26} />
        </div>
        <h2 className="mt-5 font-display text-lg font-semibold text-ink">Listo para trazar tu validación</h2>
        <p className="mx-auto mt-1.5 max-w-md text-ink/60">
          Siete agentes analizarán tu idea: hipótesis, riesgos, priorización, experimentos y métricas.
          Te pediremos confirmar en tres momentos clave.
        </p>
        <button onClick={onStart} className="btn-primary mt-6 px-6 py-3 text-base shadow-glow">Trazar blueprint →</button>
      </div>
    </div>
  );
}

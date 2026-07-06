"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Project } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

function Segmented({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex h-full flex-col">
      <span className="label" id={`seg-${label}`}>{label}</span>
      <div role="group" aria-labelledby={`seg-${label}`} className="flex flex-1 rounded-xl border border-line bg-paper p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-1.5 py-1.5 text-center text-[13px] font-medium leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500 ${
              value === o.value ? "bg-surface text-blueprint-700 shadow-sm ring-1 ring-line dark:text-blueprint-200" : "text-ink/50 hover:text-ink/80"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewProject() {
  const router = useRouter();
  const { authed, ready } = useAuth();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [budget, setBudget] = useState("low");
  const [horizon, setHorizon] = useState("weeks");
  const [stage, setStage] = useState("discovery");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && !authed) router.replace("/login");
  }, [authed, ready, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const project = await apiPost<Project>("/projects", {
        name,
        raw_idea: idea,
        constraints: { budget_level: budget, time_horizon: horizon, stage },
      });
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Tu sesión expiró. Redirigiendo a iniciar sesión…");
        setTimeout(() => router.replace("/login"), 1400);
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo crear el proyecto.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main id="contenido" className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-ink/55 hover:text-ink">
          ← Volver al panel
        </Link>
        <span className="annot text-blueprint-600">Nuevo plano</span>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Describe tu idea</h1>
        <p className="mt-1.5 text-ink/60">Define la idea y las restricciones. Los agentes trazan el resto.</p>

        <form onSubmit={onSubmit} className="card mt-8 space-y-6 p-6 sm:p-8">
          <div>
            <label className="label" htmlFor="name">Nombre del proyecto</label>
            <input id="name" className="input" placeholder="Ej. MealKit AI" value={name}
              onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="idea">Idea de negocio</label>
            <textarea id="idea" className="input h-40 resize-none" value={idea}
              onChange={(e) => setIdea(e.target.value)} minLength={20} required
              placeholder="Describe el segmento de clientes, la propuesta de valor y cómo genera ingresos…" />
            <p className="annot mt-1.5">{idea.length} caracteres · mínimo 20</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Segmented label="Presupuesto" value={budget} onChange={setBudget} options={[
              { value: "very_low", label: "Muy bajo" },
              { value: "low", label: "Bajo" },
              { value: "medium", label: "Medio" },
              { value: "high", label: "Alto" },
            ]} />
            <Segmented label="Horizonte" value={horizon} onChange={setHorizon} options={[
              { value: "days", label: "Días" },
              { value: "weeks", label: "Semanas" },
              { value: "months", label: "Meses" },
            ]} />
            <Segmented label="Etapa" value={stage} onChange={setStage} options={[
              { value: "discovery", label: "Descubrim." },
              { value: "validation", label: "Validación" },
            ]} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">{error}</p>}
          <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
            <Link href="/dashboard" className="btn-secondary">Cancelar</Link>
            <button className="btn-primary" disabled={loading} aria-busy={loading}>
              {loading ? "Creando…" : "Crear y abrir"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

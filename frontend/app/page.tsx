import Link from "next/link";
import { AuthCta } from "@/components/AuthCta";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const STAGES = [
  { id: "S0", t: "Idea", d: "Tu idea, estructurada en Business Model Canvas y Value Proposition Canvas." },
  { id: "S1", t: "Hipótesis", d: "Supuestos convertidos en hipótesis «Creemos que…», con contra-hipótesis." },
  { id: "S2", t: "Riesgo D/F/V", d: "Cada hipótesis etiquetada: Deseabilidad, Factibilidad o Viabilidad." },
  { id: "S3", t: "Priorización", d: "Mapa 2×2 importancia × evidencia: qué probar primero." },
  { id: "S4", t: "Experimentos", d: "La secuencia correcta, tomada de los 44 del libro. Nada inventado." },
  { id: "S5", t: "Test Cards", d: "Métrica y criterio de éxito: «Acertamos si…»." },
  { id: "S6", t: "Crítica", d: "Un coach audita el diseño contra las trampas conocidas." },
];

const DFV = [
  { k: "Deseabilidad", q: "¿Lo quieren?", cls: "bg-desire-soft text-desire-ink", dot: "bg-desire" },
  { k: "Factibilidad", q: "¿Podemos construirlo?", cls: "bg-feas-soft text-feas-ink", dot: "bg-feas" },
  { k: "Viabilidad", q: "¿Genera dinero?", cls: "bg-viab-soft text-viab-ink", dot: "bg-viab" },
];

const STATS = [
  ["7", "agentes especialistas"],
  ["44", "experimentos del catálogo"],
  ["3", "controles humanos"],
  ["D/F/V", "marco de riesgos"],
];

const BENEFITS = [
  { t: "Decide con evidencia, no con opiniones", d: "Cada hipótesis se prioriza por importancia y evidencia, así inviertes primero donde más duele.", icon: "M3 3v18h18M7 14l3-3 3 3 5-6" },
  { t: "Ahorra semanas de planificación", d: "Lo que tomaría días de talleres se traza en una sesión, listo para ejecutar.", icon: "M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" },
  { t: "Evita las trampas clásicas", d: "Un coach revisa el diseño contra los errores del libro: evidencia débil, pocos experimentos, sesgo.", icon: "m12 2 9 4v6c0 5-3.8 8.4-9 10-5.2-1.6-9-5-9-10V6l9-4Z" },
  { t: "Reproducible y auditable", d: "Salida estructurada y anclada al catálogo: comparable entre versiones y exportable.", icon: "M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
];

const CASES = [
  { tag: "Solopreneur", t: "Validar antes de construir", d: "Sabes programar pero no quieres gastar 3 meses en algo que nadie quiere. Empieza por la hipótesis más riesgosa con un experimento barato." },
  { tag: "Startup temprana", t: "Alinear al equipo", d: "Founders con visiones distintas. El blueprint pone sobre la mesa qué creen, qué riesgo corre cada supuesto y qué probar primero." },
  { tag: "Innovación corporativa", t: "Defender la inversión", d: "Necesitas justificar el siguiente desembolso. Test Cards con métricas y criterios de éxito dan un caso medible ante el comité." },
];

const FAQ = [
  { q: "¿El sistema ejecuta los experimentos?", a: "No. Su alcance es el diseño de la validación: identifica hipótesis, clasifica riesgos, prioriza y selecciona experimentos con sus métricas. Ejecutarlos y recoger evidencia real queda de tu lado." },
  { q: "¿De dónde salen los experimentos?", a: "De la biblioteca de 44 experimentos de Testing Business Ideas. El selector se ancla al catálogo real con su costo, tiempo y fuerza de evidencia; no inventa experimentos." },
  { q: "¿Puedo intervenir en el proceso?", a: "Sí. Hay tres puntos de control: editas las hipótesis, ajustas el mapa de priorización 2×2 arrastrando los puntos, y apruebas el blueprint final." },
  { q: "¿Qué modelo de IA usa?", a: "Es agnóstico: funciona con distintos proveedores (Anthropic, OpenAI y endpoints compatibles). Cada agente entrega salida estructurada y validada para que el resultado sea reproducible." },
  { q: "¿Puedo exportar el resultado?", a: "Sí, en Markdown o JSON. Además puedes comparar versiones del blueprint para ver cómo evoluciona el diseño entre revisiones." },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <a href="#contenido" className="sr-only rounded-lg bg-blueprint-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50">
        Saltar al contenido
      </a>

      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-9 text-[13.5px] font-medium text-ink/60 md:flex">
            <a href="#beneficios" className="transition-colors hover:text-ink">Beneficios</a>
            <a href="#proceso" className="transition-colors hover:text-ink">Cómo funciona</a>
            <a href="#casos" className="transition-colors hover:text-ink">Casos de uso</a>
            <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthCta variant="nav" />
          </div>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="bp-grid pointer-events-none absolute inset-0 -z-10" />
          <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(70% 60% at 50% -10%, rgba(15,138,95,0.10), transparent 70%)" }} />
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-24 sm:py-32 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span className="badge mb-7 border border-blueprint-200 bg-blueprint-500/[0.07] text-blueprint-700 dark:text-blueprint-300">
                <span className="annot text-blueprint-700 dark:text-blueprint-300">Método</span>
                Testing Business Ideas · Bland &amp; Osterwalder
              </span>
              <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-7xl">
                El plano de tu <span className="text-gradient">validación</span>, trazado en una sesión
              </h1>
              <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-ink/60 sm:text-xl">
                Siete agentes leen tu idea y devuelven un blueprint accionable: hipótesis, riesgos,
                qué probar primero y con qué experimento — con métricas y criterios de éxito. Tú
                decides en cada paso clave.
              </p>
              <div className="mt-10"><AuthCta variant="hero" /></div>
              <p className="annot mt-6 text-ink/40">Sin tarjeta · Multi-proyecto · Exporta a Markdown / JSON</p>
            </div>
            <HeroMap />
          </div>
        </section>

        {/* Estadísticas */}
        <section className="border-b border-line bg-paper/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
            {STATS.map(([big, small]) => (
              <div key={small} className="text-center">
                <div className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{big}</div>
                <div className="mt-1.5 text-sm text-ink/50">{small}</div>
              </div>
            ))}
          </div>
        </section>

        {/* D/F/V */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-5 px-6 py-14 sm:grid-cols-3">
            {DFV.map((r) => (
              <div key={r.k} className="card flex items-center gap-4 p-5">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${r.cls}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} />
                </span>
                <div>
                  <div className="font-display text-sm font-semibold text-ink">{r.k}</div>
                  <div className="text-sm text-ink/50">{r.q}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Beneficios */}
        <section id="beneficios" className="mx-auto max-w-6xl px-6 py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="annot text-blueprint-600">Por qué importa</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Menos corazonadas, más método</h2>
            <p className="mt-5 text-lg text-ink/60">El valor no es generar texto: es decidir con rigor qué probar y cómo.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.t} className="card group flex gap-5 p-7 transition duration-200 hover:-translate-y-1 hover:shadow-lift">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blueprint-600 text-white">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={b.icon} /></svg>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-ink">{b.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="proceso" className="border-y border-line bg-paper/50">
          <div className="mx-auto max-w-6xl px-6 py-28">
            <div className="mx-auto max-w-2xl text-center">
              <span className="annot text-blueprint-600">El proceso</span>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Siete estaciones, un plano</h2>
              <p className="mt-5 text-lg text-ink/60">Cada agente es de triaje: decide y entrega un artefacto al siguiente. El orden importa, y aquí se respeta.</p>
            </div>
            <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {STAGES.map((s) => (
                <div key={s.id} className="card group relative p-7 transition duration-200 hover:-translate-y-1 hover:shadow-lift">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-blueprint-600">{s.id}</span>
                    <span className="h-px flex-1 bg-line" />
                    <h3 className="font-display text-base font-semibold text-ink">{s.t}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-ink/60">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Casos de uso */}
        <section id="casos" className="mx-auto max-w-6xl px-6 py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="annot text-blueprint-600">Para quién</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Tres formas de usarlo</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {CASES.map((c) => (
              <div key={c.tag} className="card flex flex-col p-7 transition duration-200 hover:-translate-y-1 hover:shadow-lift">
                <span className="badge mb-4 w-fit bg-blueprint-500/10 text-blueprint-700 dark:text-blueprint-300">{c.tag}</span>
                <h3 className="font-display text-lg font-semibold text-ink">{c.t}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Alcance */}
        <section id="alcance" className="relative overflow-hidden bg-night">
          <div className="bp-grid-dark pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-5xl px-6 py-28">
            <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
              <div>
                <span className="annot text-blueprint-400">Enfoque deliberado</span>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Trazamos el plan. La obra es tuya.</h2>
                <p className="mt-6 text-lg leading-relaxed text-white/65">
                  El sistema diseña la validación: hipótesis, riesgos, experimentos, métricas y criterios de éxito.
                  No ejecuta experimentos ni espera resultados del mercado — eso es justo lo que acelera el diseño y mejora su calidad.
                </p>
              </div>
              <div className="grid gap-3">
                {[
                  ["Sí diseña", "Hipótesis, riesgos D/F/V, priorización, experimentos, Test Cards y crítica.", "viab"],
                  ["No ejecuta", "No corre experimentos ni recoge evidencia real. Eso queda como trabajo futuro.", "muted"],
                ].map(([t, d, tone]) => (
                  <div key={t as string} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-sm ${tone === "viab" ? "bg-blueprint-500 text-white" : "bg-white/15 text-white/70"}`}>{tone === "viab" ? "✓" : "—"}</span>
                      <span className="font-display font-semibold text-white">{t}</span>
                    </div>
                    <p className="pl-8 text-sm text-white/60">{d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
          <div className="text-center">
            <span className="annot text-blueprint-600">Preguntas frecuentes</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Lo que la gente pregunta</h2>
          </div>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => (
              <details key={i} className="card group overflow-hidden p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 font-display font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blueprint-500">
                  {f.q}
                  <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper text-ink/60 transition group-open:rotate-45">+</span>
                </summary>
                <p className="px-6 pb-6 text-sm leading-relaxed text-ink/60">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-blueprint-700 bg-blueprint-700 px-8 py-16 text-center shadow-lift">
            <div className="bp-grid-dark pointer-events-none absolute inset-0 opacity-70" />
            <h2 className="relative font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Empieza por la hipótesis más riesgosa</h2>
            <p className="relative mx-auto mt-5 max-w-xl text-lg text-blueprint-100">Crea tu primer proyecto y obtén un blueprint de validación completo hoy.</p>
            <div className="relative mt-9 flex justify-center"><AuthCta variant="hero" /></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-9 text-sm text-ink/50 sm:flex-row">
          <Logo small />
          <p>Diseño de experimentos de validación · Tesis (Design Science Research)</p>
          <div className="flex gap-5">
            <Link href="/login" className="transition-colors hover:text-ink">Entrar</Link>
            <Link href="/register" className="transition-colors hover:text-ink">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Mapa de supuestos 2×2 — el artefacto firma. */
function HeroMap() {
  const dots = [
    { x: 18, y: 22, r: true, id: "h1" }, { x: 30, y: 34, r: true, id: "h2" },
    { x: 68, y: 30, id: "h3" }, { x: 78, y: 66, id: "h4" },
    { x: 40, y: 72, id: "h5" }, { x: 24, y: 58, r: true, id: "h6" },
  ];
  return (
    <div className="animate-draw-in">
      <div className="card overflow-hidden p-2 shadow-lift">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="annot">Fig.1 — Mapa de supuestos</span>
          <span className="annot">importancia × evidencia</span>
        </div>
        <div className="relative aspect-[4/3] rounded-xl bg-paper bp-grid">
          <div className="absolute left-0 top-0 h-1/2 w-1/2 rounded-tl-xl bg-accent-500/15" />
          <span className="annot absolute left-2 top-2 text-accent-700">Probar primero</span>
          <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-line" />
          <span className="annot absolute bottom-1.5 left-2">sin evidencia</span>
          <span className="annot absolute bottom-1.5 right-2">con evidencia</span>
          {dots.map((d) => (
            <span key={d.id} className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono text-[9px] font-semibold ring-2 ring-surface"
              style={{ left: `${d.x}%`, top: `${d.y}%`, width: 22, height: 22, background: d.r ? "#c9973f" : "#0e8fa8", color: "#fff" }}>
              {d.id}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-5 px-3 py-2.5 text-xs text-ink/60">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent-500" /> probar primero</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-feas" /> con evidencia</span>
        </div>
      </div>
    </div>
  );
}

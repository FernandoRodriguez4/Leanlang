import { Logo } from "./Logo";

/** Layout dividido para autenticación: panel de plano + formulario. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-night lg:block">
        <div className="bp-grid-dark absolute inset-0" />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(60% 50% at 15% 0%, rgba(15,138,95,0.28), transparent 60%)" }}
        />
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logo invert />
          <div>
            <span className="annot text-blueprint-400">El plano de tu validación</span>
            <h2 className="mt-4 max-w-md text-balance font-display text-4xl font-bold leading-tight text-white">
              De la idea a un plan con método.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
              Hipótesis, riesgos D/F/V, priorización 2×2 y los experimentos correctos del catálogo de
              Testing Business Ideas — trazados por agentes, validados por ti.
            </p>
            <ul className="mt-9 space-y-3.5">
              {[
                "7 agentes especialistas orquestados",
                "44 experimentos del libro, sin inventos",
                "Tú apruebas cada paso clave",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-white/80">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blueprint-500 text-white">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="annot text-white/35">Tesis · Design Science Research</p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

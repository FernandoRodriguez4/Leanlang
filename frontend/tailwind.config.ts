import type { Config } from "tailwindcss";

const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // — Neutros semánticos (adaptan a tema vía variables CSS) —
        paper: withAlpha("--bg"), // fondo de la app + rellenos sutiles
        surface: withAlpha("--surface"), // tarjetas / inputs
        ink: withAlpha("--text"), // texto principal
        line: withAlpha("--border"), // bordes / hairlines
        tint: withAlpha("--tint"), // realce de selección/activo
        night: "#0a0a0a", // superficie oscura fija (paneles dark)

        // Verde — color estructural y de acción (único acento de marca)
        blueprint: {
          50: "#effbf6", 100: "#d7f3e7", 200: "#afe7d0", 300: "#7dd4b3", 400: "#45b48d",
          500: "#1f9670", 600: "#0f8a5f", 700: "#0c6e4c", 800: "#0f5a40", 900: "#0e4a36", 950: "#082c20",
        },
        // Ámbar atenuado — resalte funcional secundario (prioridad / estado), uso moderado
        accent: { 300: "#e9d7a8", 400: "#dcbb72", 500: "#c9973f", 600: "#a97a2c", 700: "#8a6222" },

        // Trío de riesgo (Testing Business Ideas)
        desire: { DEFAULT: "#c97a0e", soft: withAlpha("--desire-soft"), ink: withAlpha("--desire-ink") },
        feas: { DEFAULT: "#0e8fa8", soft: withAlpha("--feas-soft"), ink: withAlpha("--feas-ink") },
        viab: { DEFAULT: "#1f9d57", soft: withAlpha("--viab-soft"), ink: withAlpha("--viab-ink") },

        // Semaforización (estado: verde / ámbar / rojo) — adapta a claro/oscuro
        ok: { DEFAULT: withAlpha("--ok"), soft: withAlpha("--ok-soft"), ink: withAlpha("--ok-ink") },
        warn: { DEFAULT: withAlpha("--warn"), soft: withAlpha("--warn-soft"), ink: withAlpha("--warn-ink") },
        danger: { DEFAULT: withAlpha("--danger"), soft: withAlpha("--danger-soft"), ink: withAlpha("--danger-ink") },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(17 17 17 / 0.03), 0 1px 3px -1px rgb(17 17 17 / 0.05)",
        lift: "0 20px 44px -20px rgb(17 17 17 / 0.16)",
        glow: "0 0 0 1px rgb(15 138 95 / 0.16), 0 14px 36px -16px rgb(15 138 95 / 0.35)",
        amber: "0 0 0 1px rgb(201 151 63 / 0.2), 0 12px 28px -14px rgb(201 151 63 / 0.35)",
      },
      borderRadius: { xl: "0.625rem", "2xl": "1.25rem" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "draw-in": { "0%": { opacity: "0", transform: "scale(0.96)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease both",
        "draw-in": "draw-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;

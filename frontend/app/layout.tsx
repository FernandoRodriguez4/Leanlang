import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const display = Inter({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono", display: "swap" });

const TITLE = "Validation Blueprint — Diseña tu validación con método";
const DESC =
  "Sistema multiagente que convierte tu idea en un plan de validación: hipótesis, riesgos D/F/V, priorización 2×2 y los experimentos correctos de Testing Business Ideas.";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: { default: TITLE, template: "%s · Validation Blueprint" },
  description: DESC,
  applicationName: "Validation Blueprint",
  keywords: ["validación", "experimentos", "Testing Business Ideas", "hipótesis", "lean startup", "multiagente", "IA"],
  authors: [{ name: "Validation Blueprint" }],
  openGraph: { title: TITLE, description: DESC, type: "website", locale: "es_ES", siteName: "Validation Blueprint" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  icons: { icon: "/icon.svg" },
};

// Evita el parpadeo de tema: aplica la clase antes del primer pintado.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('vb_theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

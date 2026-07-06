"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Bienvenido de vuelta</h1>
      <p className="mt-1.5 text-sm text-ink/55">Inicia sesión para continuar con tus proyectos.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" placeholder="tú@empresa.com" type="email"
            autoComplete="email" aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined}
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pw">Contraseña</label>
          <input id="pw" className="input" placeholder="••••••••" type="password"
            autoComplete="current-password" aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <p id="auth-error" role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">{error}</p>
        )}
        <button className="btn-primary w-full py-3" disabled={loading} aria-busy={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/55">
        ¿No tienes cuenta?{" "}
        <Link className="font-semibold text-blueprint-600 hover:text-blueprint-700" href="/register">
          Regístrate gratis
        </Link>
      </p>
    </AuthShell>
  );
}

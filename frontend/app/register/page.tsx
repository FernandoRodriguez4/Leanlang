"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  const { register } = useAuth();
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
      await register(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error && err.message ? "No se pudo registrar. ¿Ya existe ese email?" : "No se pudo registrar.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Crea tu cuenta</h1>
      <p className="mt-1.5 text-sm text-ink/55">Gratis. Empieza a diseñar tu validación en minutos.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" placeholder="tú@empresa.com" type="email"
            autoComplete="email" aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined}
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pw">Contraseña</label>
          <input id="pw" className="input" placeholder="Mínimo 8 caracteres" type="password"
            autoComplete="new-password" minLength={8} aria-describedby="pw-hint"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <p id="pw-hint" className="annot mt-1.5">Usa al menos 8 caracteres.</p>
        </div>
        {error && (
          <p id="auth-error" role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">{error}</p>
        )}
        <button className="btn-primary w-full py-3" disabled={loading} aria-busy={loading}>
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/55">
        ¿Ya tienes cuenta?{" "}
        <Link className="font-semibold text-blueprint-600 hover:text-blueprint-700" href="/login">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}

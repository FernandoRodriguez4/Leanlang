// Cliente HTTP minimo con JWT bearer.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "vb_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Error de API con código de estado, para que la UI reaccione (p. ej. 401 -> reloguear). */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const FIELD_ES: Record<string, string> = {
  raw_idea: "La idea de negocio",
  name: "El nombre",
  password: "La contraseña",
  email: "El email",
};

/** Traduce un error de validación de FastAPI (422) a un mensaje claro en español. */
function translateValidation(d: any): string {
  const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : undefined;
  const label = (field && FIELD_ES[field]) || "Un campo";
  const min = d?.ctx?.min_length;
  if (d?.type?.includes("too_short") || /at least/i.test(d?.msg || "")) {
    return `${label} es muy corta${min ? ` (mínimo ${min} caracteres)` : ""}.`;
  }
  if (d?.type?.includes("missing")) return `${label} es obligatoria.`;
  return `${label}: ${d?.msg || "valor inválido"}.`;
}

/** Construye un mensaje legible a partir de la respuesta de error. */
async function friendlyMessage(res: Response): Promise<string> {
  if (res.status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  let body: any;
  try { body = await res.json(); } catch { return `Error del servidor (${res.status}).`; }
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(translateValidation).join(" ");
  return `Error del servidor (${res.status}).`;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  throw new ApiError(res.status, await friendlyMessage(res));
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

/** DELETE sin cuerpo de respuesta (204). */
export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE", headers: { ...authHeaders() } });
  if (!res.ok) throw new ApiError(res.status, await friendlyMessage(res));
}

export async function login(email: string, password: string): Promise<string> {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error("Credenciales invalidas");
  const data = await res.json();
  return data.access_token as string;
}

export async function register(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
}

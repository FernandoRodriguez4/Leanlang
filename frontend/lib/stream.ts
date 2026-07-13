// Cliente SSE sobre fetch (EventSource no permite cabecera Authorization).
// Lee text/event-stream incrementalmente y parsea bloques event:/data:.

import { API_URL, getToken } from "./api";
import type { SSEEvent } from "./types";

async function streamSSE(
  path: string,
  body: unknown,
  onEvent: (ev: SSEEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(await _errorMessage(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    // sse-starlette separa eventos con CRLF; normalizamos a LF para partir por "\n\n".
    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseBlock(raw);
      if (parsed) onEvent(parsed);
    }
  }
}

// El backend puede rechazar el request antes de abrir el stream (ej. 422 al editar
// hipotesis) devolviendo JSON {detail: "..."} en vez de text/event-stream.
async function _errorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // no era JSON: se usa el texto crudo
  }
  return text;
}

function parseBlock(raw: string): SSEEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  let data: any = {};
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    data = { raw: dataLines.join("\n") };
  }

  switch (event) {
    case "started":
      return { event, blueprint_id: data.blueprint_id };
    case "agent_update":
      return { event, node: data.node, trace: data.trace, artifacts: data.artifacts };
    case "interrupt":
      return { event, type: data.type, payload: data };
    case "awaiting_input":
      return { event, blueprint: data };
    case "done":
      return { event, blueprint: data };
    case "error":
      return { event, message: data.message || "error" };
    default:
      return null;
  }
}

export function runBlueprint(
  projectId: string,
  onEvent: (ev: SSEEvent) => void,
  constraints?: unknown,
) {
  return streamSSE(`/projects/${projectId}/blueprint/run`, { constraints: constraints ?? null }, onEvent);
}

export function resumeBlueprint(
  blueprintId: string,
  stage: string,
  payload: Record<string, unknown>,
  onEvent: (ev: SSEEvent) => void,
) {
  return streamSSE(`/blueprint/${blueprintId}/resume`, { stage, payload }, onEvent);
}

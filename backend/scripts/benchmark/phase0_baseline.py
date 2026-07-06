"""Harness de carga para la Fase 0 (linea base pre-RAG).

Conduce el flujo real de negocio via HTTP (registro/login, crear proyecto,
correr blueprint por SSE, resolver los 3 interrupts HITL) a niveles de
concurrencia fijos, y registra metricas crudas de latencia/tiempos.

No modifica codigo de la aplicacion ni arquitectura: es un cliente externo.
Hace llamadas LLM reales contra lo que este configurado en `.env`.

Uso:
    python scripts/benchmark/phase0_baseline.py --levels 1,5,10,20 --out docs/audits/phase0_baseline_evidence
    python scripts/benchmark/phase0_baseline.py --levels 1 --out /tmp/smoke   # smoke test rapido
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
import uuid
from pathlib import Path

import httpx

BASE_URL = os.environ.get("BENCH_BASE_URL", "http://127.0.0.1:8000")
EMAIL = "phase0-benchmark@leanlang-bench.example.com"
PASSWORD = "benchmark-phase0-2026"

# Escenario fijo (misma semilla en todas las corridas, para reducir varianza).
RAW_IDEA = "Kits de ciencia por suscripcion mensual para padres millennials."
CONSTRAINTS = {"budget_level": "low", "time_horizon": "weeks", "stage": "discovery"}

# Mapeo interrupt.type -> ResumeRequest.stage (ver app/agents/supervisor.py e app/schemas/api.py).
INTERRUPT_STAGE_MAP = {
    "review_hypotheses": "hypotheses",
    "review_prioritization": "prioritization",
    "approve_blueprint": "approval",
}
# payload vacio -> el backend usa el default {"accepted": True} / {"approved": True}
# (app/api/routes/blueprint.py:110). Escenario documentado explicitamente en el reporte.
RESUME_PAYLOAD: dict = {}

REQUEST_TIMEOUT = httpx.Timeout(900.0, connect=30.0)


async def ensure_user(client: httpx.AsyncClient) -> str:
    r = await client.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code not in (201, 400):
        r.raise_for_status()
    r = await client.post(
        f"{BASE_URL}/auth/login",
        data={"username": EMAIL, "password": PASSWORD},
    )
    r.raise_for_status()
    return r.json()["access_token"]


async def sse_call(client: httpx.AsyncClient, url: str, token: str, json_body: dict) -> dict:
    """POST a un endpoint SSE; devuelve eventos parseados y marcas de tiempo (monotonic)."""
    events: list[dict] = []
    t_sent = time.monotonic()
    t_first_event = None
    headers = {"Authorization": f"Bearer {token}"}
    async with client.stream("POST", url, json=json_body, headers=headers) as resp:
        resp.raise_for_status()
        event_name = None
        data_lines: list[str] = []

        async def flush():
            nonlocal t_first_event
            if not data_lines:
                return
            raw = "\n".join(data_lines)
            if t_first_event is None:
                t_first_event = time.monotonic()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = raw
            events.append({"event": event_name, "data": data, "t": time.monotonic()})

        async for line in resp.aiter_lines():
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                event_name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_lines.append(line[len("data:"):].strip())
            elif line == "":
                await flush()
                event_name = None
                data_lines = []
        await flush()
    t_end = time.monotonic()
    return {
        "events": events,
        "t_sent": t_sent,
        "t_first_event": t_first_event,
        "t_end": t_end,
        "n_events": len(events),
    }


async def run_one_blueprint(client: httpx.AsyncClient, token: str, run_tag: str) -> dict:
    result: dict = {"run_tag": run_tag, "ok": False, "errors": []}
    try:
        r = await client.post(
            f"{BASE_URL}/projects",
            json={
                "name": f"phase0-bench-{run_tag}-{uuid.uuid4().hex[:8]}",
                "raw_idea": RAW_IDEA,
                "constraints": CONSTRAINTS,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        project_id = r.json()["id"]
        result["project_id"] = project_id

        run_res = await sse_call(
            client, f"{BASE_URL}/projects/{project_id}/blueprint/run", token, json_body={}
        )
        result["run_call"] = {k: v for k, v in run_res.items() if k != "events"}

        blueprint_id = None
        for e in run_res["events"]:
            if e["event"] == "started":
                blueprint_id = e["data"]["blueprint_id"]
        if blueprint_id is None:
            raise RuntimeError(
                f"no llego evento 'started' (eventos={[e['event'] for e in run_res['events']]})"
            )
        result["blueprint_id"] = blueprint_id

        resumes = []
        pending = run_res
        cycles = 0
        while True:
            events = pending["events"]
            done_ev = next((e for e in events if e["event"] == "done"), None)
            if done_ev is not None:
                break
            interrupt_ev = next((e for e in events if e["event"] == "interrupt"), None)
            if interrupt_ev is None:
                awaiting_ev = next((e for e in events if e["event"] == "awaiting_input"), None)
                raise RuntimeError(
                    "stream termino sin 'interrupt' ni 'done' "
                    f"(eventos={[e['event'] for e in events]}, awaiting={bool(awaiting_ev)})"
                )
            itype = interrupt_ev["data"].get("type") if isinstance(interrupt_ev["data"], dict) else None
            stage = INTERRUPT_STAGE_MAP.get(itype)
            if stage is None:
                raise RuntimeError(f"tipo de interrupt desconocido: {itype!r}")

            resume_res = await sse_call(
                client,
                f"{BASE_URL}/blueprint/{blueprint_id}/resume",
                token,
                json_body={"stage": stage, "payload": RESUME_PAYLOAD},
            )
            recovery_s = (
                resume_res["t_first_event"] - resume_res["t_sent"]
                if resume_res["t_first_event"] is not None
                else None
            )
            resumes.append(
                {
                    "stage": stage,
                    **{k: v for k, v in resume_res.items() if k != "events"},
                    "recovery_s": recovery_s,
                }
            )
            pending = resume_res
            cycles += 1
            if cycles > 6:
                raise RuntimeError("demasiados ciclos de resume; abortando (posible loop)")

        result["resumes"] = resumes
        final_t_end = resumes[-1]["t_end"] if resumes else run_res["t_end"]
        result["total_latency_s"] = final_t_end - run_res["t_sent"]
        result["ok"] = True
    except Exception as exc:  # noqa: BLE001 - se registra para el baseline, no se re-lanza
        result["errors"].append(repr(exc))
    return result


async def run_level(concurrency: int, level_tag: str) -> dict:
    limits = httpx.Limits(max_connections=concurrency + 10, max_keepalive_connections=concurrency + 10)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, limits=limits) as client:
        token = await ensure_user(client)
        t_level_start = time.monotonic()
        tasks = [
            run_one_blueprint(client, token, f"{level_tag}-{i}") for i in range(concurrency)
        ]
        results = await asyncio.gather(*tasks)
        t_level_end = time.monotonic()
    return {
        "concurrency": concurrency,
        "t_level_start": t_level_start,
        "t_level_end": t_level_end,
        "wall_clock_s": t_level_end - t_level_start,
        "results": results,
    }


async def main_async(levels: list[int], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {"base_url": BASE_URL, "raw_idea": RAW_IDEA, "constraints": CONSTRAINTS, "levels": []}
    for level in levels:
        print(f"=== nivel de concurrencia: {level} ===", flush=True)
        level_result = await run_level(level, f"c{level}")
        ok = [r for r in level_result["results"] if r["ok"]]
        errors = [r for r in level_result["results"] if not r["ok"]]
        print(
            f"nivel {level}: {len(ok)}/{level} ok, wall_clock={level_result['wall_clock_s']:.1f}s",
            flush=True,
        )
        for r in errors:
            print(f"  ERROR run={r['run_tag']}: {r['errors']}", flush=True)
        raw_path = out_dir / f"level_{level}.json"
        raw_path.write_text(json.dumps(level_result, ensure_ascii=False, indent=2), encoding="utf-8")
        summary["levels"].append(
            {
                "concurrency": level,
                "ok_count": len(ok),
                "error_count": len(errors),
                "wall_clock_s": level_result["wall_clock_s"],
                "raw_file": str(raw_path),
            }
        )
    summary_path = out_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nResumen escrito en {summary_path}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--levels", default="1,5,10,20", help="niveles de concurrencia separados por coma")
    parser.add_argument("--out", default="docs/audits/phase0_baseline_evidence", help="directorio de salida")
    args = parser.parse_args()
    levels = [int(x) for x in args.levels.split(",") if x.strip()]
    out_dir = Path(args.out)
    asyncio.run(main_async(levels, out_dir))


if __name__ == "__main__":
    main()

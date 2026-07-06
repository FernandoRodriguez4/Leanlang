"""Monitor externo de recursos para la Fase 0 (linea base pre-RAG).

Muestrea, sin tocar el codigo de la app:
  - CPU% y RSS (memoria) del proceso de Uvicorn (via psutil, por PID).
  - Uso del pool de PostgreSQL via `pg_stat_activity` (conexion de solo lectura,
    independiente del pool de la app).

Escribe una fila CSV por muestra a stdout (o a un archivo si se pasa --out).
Se detiene con Ctrl+C / SIGTERM (o al agotar --duration si se especifica).

Uso:
    python scripts/benchmark/monitor.py --pid 12345 --out docs/audits/phase0_baseline_evidence/resources.csv
"""
from __future__ import annotations

import argparse
import csv
import signal
import sys
import time

import psutil
from sqlalchemy import create_engine, text

sys.path.insert(0, ".")
from app.core.config import settings  # noqa: E402

FIELDS = [
    "t_wall",
    "cpu_percent",
    "rss_mb",
    "num_threads",
    "pg_total",
    "pg_active",
    "pg_idle",
    "pg_idle_in_tx",
]

_stop = False


def _handle_stop(signum, frame):
    global _stop
    _stop = True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True, help="PID del proceso uvicorn a monitorear")
    parser.add_argument("--out", default=None, help="ruta de archivo CSV (default: stdout)")
    parser.add_argument("--interval", type=float, default=1.0, help="segundos entre muestras")
    parser.add_argument("--duration", type=float, default=None, help="segundos totales (default: indefinido)")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    proc = psutil.Process(args.pid)
    proc.cpu_percent(interval=None)  # prime

    dsn = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
    engine = create_engine(dsn, pool_size=1, max_overflow=0)

    out_fh = open(args.out, "w", newline="", encoding="utf-8") if args.out else sys.stdout
    writer = csv.DictWriter(out_fh, fieldnames=FIELDS)
    writer.writeheader()
    out_fh.flush()

    t_start = time.monotonic()
    try:
        while not _stop:
            row = {"t_wall": round(time.monotonic() - t_start, 3)}
            try:
                row["cpu_percent"] = proc.cpu_percent(interval=None)
                mem = proc.memory_info()
                row["rss_mb"] = round(mem.rss / (1024 * 1024), 2)
                row["num_threads"] = proc.num_threads()
            except psutil.NoSuchProcess:
                break

            try:
                with engine.connect() as conn:
                    counts = conn.execute(
                        text(
                            "select state, count(*) from pg_stat_activity "
                            "where datname = current_database() group by state"
                        )
                    ).fetchall()
                by_state = {(s or "unknown"): c for s, c in counts}
                row["pg_total"] = sum(by_state.values())
                row["pg_active"] = by_state.get("active", 0)
                row["pg_idle"] = by_state.get("idle", 0)
                row["pg_idle_in_tx"] = by_state.get("idle in transaction", 0)
            except Exception as exc:  # noqa: BLE001
                row["pg_total"] = row["pg_active"] = row["pg_idle"] = row["pg_idle_in_tx"] = None
                print(f"[monitor] error consultando pg_stat_activity: {exc!r}", file=sys.stderr)

            writer.writerow(row)
            out_fh.flush()

            if args.duration is not None and (time.monotonic() - t_start) >= args.duration:
                break
            time.sleep(args.interval)
    finally:
        if args.out:
            out_fh.close()
        engine.dispose()


if __name__ == "__main__":
    main()

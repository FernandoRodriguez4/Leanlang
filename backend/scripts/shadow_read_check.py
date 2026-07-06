"""Validacion temporal Fase 2: compara `blueprints.state` (proyeccion) contra
el checkpointer (fuente de verdad) para uno o varios blueprints.

No modifica nada: solo lee via `shadow_read_check()`
(app/api/routes/blueprint.py) y reporta divergencias. Pensado para correrse
periodicamente durante el periodo de validacion, antes de confiar
definitivamente en la proyeccion para servir `GET /blueprint/{id}`
(ver docs/audits/backend_architecture_evolution_validation.md, Punto 2).

Uso:
    python scripts/shadow_read_check.py                 # todos los blueprints
    python scripts/shadow_read_check.py <blueprint_id>   # uno solo
"""
from __future__ import annotations

import sys

from app.api.routes.blueprint import shadow_read_check
from app.db.models import Blueprint
from app.db.session import SessionLocal


def _all_blueprint_ids() -> list[str]:
    with SessionLocal() as db:
        return [str(bp_id) for (bp_id,) in db.query(Blueprint.id).all()]


def main() -> None:
    ids = sys.argv[1:] or _all_blueprint_ids()
    if not ids:
        print("No hay blueprints para verificar.")
        return

    mismatches = []
    for blueprint_id in ids:
        report = shadow_read_check(blueprint_id)
        if not report.get("found"):
            print(f"[NO ENCONTRADO] {blueprint_id}")
            continue
        tag = "OK" if report["match"] else "DIVERGENCIA"
        print(
            f"[{tag}] {blueprint_id} — proyeccion={report['projected_status']!r} "
            f"checkpoint={report['checkpoint_status']!r} diff_keys={report['diff_keys']}"
        )
        if not report["match"]:
            mismatches.append(report)

    print(f"\n{len(ids) - len(mismatches)}/{len(ids)} consistentes.")
    if mismatches:
        print(f"{len(mismatches)} con divergencia — revisar arriba.")
        sys.exit(1)


if __name__ == "__main__":
    main()

"""Siembra la tabla `experiments` desde experiments.json (idempotente)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.catalog.service import load_catalog
from app.db.models import Experiment


def seed_experiments(db: Session) -> int:
    catalog = load_catalog()
    count = 0
    for item in catalog:
        existing = db.get(Experiment, item.id)
        data = dict(
            id=item.id,
            name=item.name,
            category=item.category.value,
            subcategory=item.subcategory,
            types=[t.value for t in item.types],
            cost=item.cost,
            setup_time=item.setup_time,
            run_time=item.run_time,
            evidence_strength=item.evidence_strength,
            capabilities=item.capabilities,
            description=item.description,
            pairings_before=item.pairings_before,
            pairings_after=item.pairings_after,
            page_ref=item.page_ref,
        )
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
        else:
            db.add(Experiment(**data))
            count += 1
    db.commit()
    return count


if __name__ == "__main__":  # pragma: no cover
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        n = seed_experiments(session)
        print(f"Seed completado. Nuevos experimentos insertados: {n}")

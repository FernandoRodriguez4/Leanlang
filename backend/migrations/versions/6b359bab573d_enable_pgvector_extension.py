"""enable pgvector extension

Revision ID: 6b359bab573d
Revises: 82c106cacc45
Create Date: 2026-07-05 00:58:51.293754

Fase 3 (pre-RAG, ver docs/audits/phase3_architecture_changes.md #6-7). Alcance
deliberadamente minimo: unicamente habilita la extension `vector` a nivel de
servidor. No crea tablas, columnas `vector` ni indices HNSW/IVFFlat -- el
esquema fisico de la tabla de conocimiento se define en la Fase 4, cuando el
proveedor de embeddings (y por tanto la dimension del vector) quede
seleccionado. No modifica `experiments` ni el esquema `langgraph`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b359bab573d'
down_revision: Union[str, Sequence[str], None] = '82c106cacc45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Idempotente por construccion (IF NOT EXISTS). No toca ninguna tabla.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")


def downgrade() -> None:
    """Downgrade schema."""
    # No-op deliberado: NO se ejecuta `DROP EXTENSION vector`.
    #
    # Motivo (contrato aprobado, ver docs/audits/phase3_architecture_changes.md #7):
    # revertir esta migracion no debe eliminar la extension mientras no exista
    # todavia ningun objeto que dependa de ella. Si una migracion futura de la
    # Fase 4 crea una tabla con columna `vector` y alguien revierte esta
    # migracion sin darse cuenta del orden de dependencias, un `DROP EXTENSION`
    # rompería esa migracion posterior. El rollback real de la extension queda
    # diferido a la Fase 4, junto con el downgrade de la tabla que la use.
    pass

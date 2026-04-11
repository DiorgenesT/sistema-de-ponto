"""facial_embeddings — adiciona coluna enrollment_photo

Revision ID: 004
Revises: 003
Create Date: 2026-04-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "facial_embeddings",
        sa.Column("enrollment_photo", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("facial_embeddings", "enrollment_photo")

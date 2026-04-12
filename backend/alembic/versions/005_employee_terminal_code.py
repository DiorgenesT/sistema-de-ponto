"""employees — adiciona terminal_code (código de acesso ao terminal)

Revision ID: 005
Revises: 004
Create Date: 2026-04-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "employees",
        sa.Column("terminal_code", sa.String(6), nullable=True),
    )
    # Índice único por empresa (permite mesmo código em empresas diferentes)
    op.create_index(
        "idx_employees_terminal_code_company",
        "employees",
        ["terminal_code", "company_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND terminal_code IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_employees_terminal_code_company", table_name="employees")
    op.drop_column("employees", "terminal_code")

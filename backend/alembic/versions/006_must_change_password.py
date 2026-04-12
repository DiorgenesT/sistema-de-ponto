"""employees — adiciona must_change_password

Revision ID: 006
Revises: 005
Create Date: 2026-04-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "employees",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )
    # Funcionários já existentes não precisam mudar senha
    op.execute("UPDATE employees SET must_change_password = false")


def downgrade() -> None:
    op.drop_column("employees", "must_change_password")

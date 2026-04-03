"""work_schedules — refatora colunas e enum schedule_type

Revision ID: 003
Revises: 002
Create Date: 2026-04-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Adiciona novo enum com os valores corretos
    op.execute("CREATE TYPE schedule_type_new AS ENUM ('FIXED', 'VARIABLE', '12X36')")

    # 2. Altera a coluna para usar o novo enum (FIXED e VARIABLE são compatíveis)
    op.execute("""
        ALTER TABLE work_schedules
        ALTER COLUMN schedule_type TYPE schedule_type_new
        USING schedule_type::text::schedule_type_new
    """)

    # 3. Remove o enum antigo e renomeia o novo
    op.execute("DROP TYPE schedule_type")
    op.execute("ALTER TYPE schedule_type_new RENAME TO schedule_type")

    # 4. Remove colunas antigas
    op.drop_column("work_schedules", "daily_hours")
    op.drop_column("work_schedules", "weekly_hours")
    op.drop_column("work_schedules", "work_days")
    op.drop_column("work_schedules", "entry_time")
    op.drop_column("work_schedules", "exit_time")
    op.drop_column("work_schedules", "lunch_start")
    op.drop_column("work_schedules", "lunch_end")

    # 5. Adiciona colunas novas
    op.add_column("work_schedules", sa.Column("default_start", sa.Time(), nullable=True))
    op.add_column("work_schedules", sa.Column("default_end", sa.Time(), nullable=True))
    op.add_column("work_schedules", sa.Column("daily_minutes", sa.Integer(), nullable=False, server_default="480"))
    op.add_column("work_schedules", sa.Column("workdays_mask", sa.Integer(), nullable=False, server_default="31"))
    op.add_column("work_schedules", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "work_schedules",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="RESTRICT"), nullable=True),
    )
    op.add_column("work_schedules", sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("work_schedules", sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))

    # Preenche created_by e updated_at nos registros existentes com o primeiro admin encontrado
    op.execute("""
        UPDATE work_schedules ws
        SET
            created_by = (SELECT id FROM employees WHERE role = 'SUPER_ADMIN' LIMIT 1),
            updated_at = ws.created_at
        WHERE created_by IS NULL
    """)

    # Torna created_by NOT NULL após preencher
    op.alter_column("work_schedules", "created_by", nullable=False)
    op.alter_column("work_schedules", "updated_at", nullable=False)


def downgrade() -> None:
    # Reverte para o schema da migration 001
    op.drop_column("work_schedules", "deleted_at")
    op.drop_column("work_schedules", "updated_at")
    op.drop_column("work_schedules", "created_by")
    op.drop_column("work_schedules", "description")
    op.drop_column("work_schedules", "workdays_mask")
    op.drop_column("work_schedules", "daily_minutes")
    op.drop_column("work_schedules", "default_end")
    op.drop_column("work_schedules", "default_start")

    op.add_column("work_schedules", sa.Column("daily_hours", sa.Numeric(4, 2), nullable=False, server_default="8.00"))
    op.add_column("work_schedules", sa.Column("weekly_hours", sa.Numeric(5, 2), nullable=False, server_default="44.00"))
    op.add_column("work_schedules", sa.Column("work_days", postgresql.ARRAY(sa.Integer()), nullable=True))
    op.add_column("work_schedules", sa.Column("entry_time", sa.Time(), nullable=True))
    op.add_column("work_schedules", sa.Column("exit_time", sa.Time(), nullable=True))
    op.add_column("work_schedules", sa.Column("lunch_start", sa.Time(), nullable=True))
    op.add_column("work_schedules", sa.Column("lunch_end", sa.Time(), nullable=True))

    op.execute("CREATE TYPE schedule_type_old AS ENUM ('FIXED', 'VARIABLE', 'SCALE_12_36', 'SCALE_24_48')")
    op.execute("""
        ALTER TABLE work_schedules
        ALTER COLUMN schedule_type TYPE schedule_type_old
        USING schedule_type::text::schedule_type_old
    """)
    op.execute("DROP TYPE schedule_type")
    op.execute("ALTER TYPE schedule_type_old RENAME TO schedule_type")

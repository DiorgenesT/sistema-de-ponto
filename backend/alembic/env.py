import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Importar todos os models para o Alembic detectar
from app.infrastructure.database import Base  # noqa: F401

# -- models serão importados aqui conforme criados:
# from app.domain.employees.models import Employee  # noqa: F401
# from app.domain.attendance.models import AttendanceRecord  # noqa: F401
# from app.domain.hour_bank.models import HourBankEntry, HourBankBalance  # noqa: F401
# from app.domain.facial.models import FacialEmbedding  # noqa: F401
# from app.domain.devices.models import AuthorizedDevice, DeviceAccessLog  # noqa: F401
# from app.domain.schedules.models import WorkSchedule, ScheduleException  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

DATABASE_URL = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url", ""))
# Alembic usa psycopg2 para migrations síncronas; trocar asyncpg por psycopg2
SYNC_DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def run_migrations_offline() -> None:
    context.configure(
        url=SYNC_DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):  # type: ignore[no-untyped-def]
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(DATABASE_URL, echo=False)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

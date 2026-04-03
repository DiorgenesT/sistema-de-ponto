import asyncio
import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Carrega .env do backend (ou da raiz do projeto como fallback)
for _env_path in [Path(__file__).resolve().parents[1] / ".env", Path(__file__).resolve().parents[2] / ".env"]:
    if _env_path.exists():
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _, _v = _line.partition("=")
                    _v = _v.split("#")[0].strip()
                    os.environ.setdefault(_k.strip(), _v)
        break

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
    import asyncpg

    async def _creator() -> asyncpg.Connection:
        import re
        m = re.match(r"postgresql\+asyncpg://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)", DATABASE_URL)
        if not m:
            raise ValueError(f"Não foi possível parsear DATABASE_URL: {DATABASE_URL}")
        user, password, host, port, database = m.groups()
        return await asyncpg.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            database=database,
            ssl="require",
            statement_cache_size=0,
        )

    connectable = create_async_engine("postgresql+asyncpg://", async_creator=_creator, echo=False)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

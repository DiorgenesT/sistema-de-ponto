from collections.abc import AsyncGenerator
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
# Pooler Supabase requer ssl=require e statement_cache_size=0 via asyncpg direto
_is_pooler = "pooler.supabase.com" in settings.DATABASE_URL

if _is_sqlite:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
elif _is_pooler:
    import asyncpg

    _parsed = urlparse(settings.DATABASE_URL)

    async def _asyncpg_creator() -> asyncpg.Connection:
        return await asyncpg.connect(
            host=_parsed.hostname,
            port=_parsed.port or 5432,
            user=_parsed.username,
            password=_parsed.password,
            database=(_parsed.path or "/postgres").lstrip("/"),
            ssl="require",
            statement_cache_size=0,
        )

    engine = create_async_engine(
        "postgresql+asyncpg://",
        async_creator=_asyncpg_creator,
        echo=False,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )
else:
    # Conexão direta (Railway com IPv6, SQLite, etc.)
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base declarativa compartilhada por todos os models SQLAlchemy."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependência FastAPI que fornece AsyncSession por request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

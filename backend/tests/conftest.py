"""
Conftest raiz — configura variáveis de ambiente antes de qualquer import de app.
Imports pesados (DeepFace, app) ficam dentro dos fixtures para não bloquear testes unitários.
"""

import asyncio
import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

import pytest

# Variáveis de ambiente para testes — definidas antes de qualquer import de app
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-64-chars-long-please-make-it-long")
os.environ.setdefault("FACIAL_ENCRYPTION_KEY", "dGVzdC1rZXktMzItYnl0ZXMtYWVzMjU2a2V5MQ==")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ---- Fixtures de integração — importam app apenas quando necessário ----------

@pytest.fixture(scope="session")
def _app():
    """Carrega o app FastAPI — apenas para testes de integração."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import StaticPool
    from app.infrastructure import database as _db_module
    from app.infrastructure.database import Base
    from app.main import app

    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _db_module.engine = test_engine
    _db_module.AsyncSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)
    return app, test_engine, Base


@pytest.fixture
async def db_session(_app) -> AsyncGenerator:
    _, test_engine, Base = _app
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from sqlalchemy.ext.asyncio import async_sessionmaker
    async with async_sessionmaker(test_engine, expire_on_commit=False)() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client(db_session) -> AsyncGenerator:
    from httpx import ASGITransport, AsyncClient
    from app.infrastructure.database import get_db
    app, _, _ = _app  # noqa: F841 — obtido via fixture
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ---- Factories -------------------------------------------------------------

@pytest.fixture
def make_employee() -> Any:
    def _factory(**kwargs: Any):
        from app.domain.employees.models import Employee, EmployeeRole
        now = datetime.now(timezone.utc)
        defaults: dict[str, Any] = {
            "id": uuid.uuid4(),
            "company_id": uuid.uuid4(),
            "full_name": "Funcionário Teste",
            "cpf_hash": "abc123",
            "email": "teste@empresa.com",
            "role": EmployeeRole.EMPLOYEE,
            "is_active": True,
            "password_hash": "$2b$12$test",
            "created_at": now,
            "updated_at": now,
        }
        defaults.update(kwargs)
        return Employee(**defaults)
    return _factory


@pytest.fixture
def make_device() -> Any:
    def _factory(**kwargs: Any):
        from app.domain.devices.models import AuthorizedDevice
        now = datetime.now(timezone.utc)
        defaults: dict[str, Any] = {
            "id": uuid.uuid4(),
            "company_id": uuid.uuid4(),
            "token_hash": "abc123hash",
            "label": "Terminal Teste",
            "ip_ranges": ["127.0.0.1/32"],
            "is_active": True,
            "created_by": uuid.uuid4(),
            "created_at": now,
        }
        defaults.update(kwargs)
        return AuthorizedDevice(**defaults)
    return _factory

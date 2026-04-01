import asyncio
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.domain.employees.models import Employee, EmployeeRole
from app.domain.devices.models import AuthorizedDevice
from app.infrastructure.database import Base, get_db
from app.main import app


# ---- Engine de teste (SQLite em memória para unit tests) -------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ---- Factories -------------------------------------------------------------

@pytest.fixture
def make_employee() -> Any:
    def _factory(**kwargs: Any) -> Employee:
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
    def _factory(**kwargs: Any) -> AuthorizedDevice:
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

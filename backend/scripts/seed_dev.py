#!/usr/bin/env python3
"""
Seed de dados para ambiente de desenvolvimento.

Cria:
  - 1 empresa demo
  - 4 funcionários: super_admin, admin, gerente, 2 operacionais
  - 1 escala de trabalho padrão 8h (seg–sex)
  - 1 dispositivo autorizado (token impresso no terminal)
  - Consentimentos LGPD para todos
  - Registros de ponto dos últimos 5 dias úteis (João e Maria)

Uso:
  cd backend
  python scripts/seed_dev.py
"""

import asyncio
import hashlib
import os
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

# Garante que backend/ está no sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Carrega .env da raiz do projeto se DATABASE_URL não estiver no ambiente
_root_env = Path(__file__).resolve().parents[2] / ".env"
if _root_env.exists() and not os.environ.get("DATABASE_URL"):
    with open(_root_env) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                _val = _val.split("#")[0].strip()
                os.environ.setdefault(_key.strip(), _val)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import generate_token, hash_password, hash_token
from app.domain.attendance.models import AttendanceRecord, RecordType
from app.domain.devices.models import AuthorizedDevice
from app.domain.employees.models import Company, Employee, EmployeeConsent, EmployeeRole
from app.domain.schedules.models import ScheduleType, WorkSchedule


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _cpf_hash(cpf: str) -> str:
    """SHA-256 do CPF sem formatação."""
    return hashlib.sha256(cpf.replace(".", "").replace("-", "").encode()).hexdigest()


def _last_weekdays(n: int) -> list[date]:
    """Retorna os últimos N dias úteis (seg–sex) até ontem."""
    days: list[date] = []
    d = date.today() - timedelta(days=1)
    while len(days) < n:
        if d.weekday() < 5:  # 0=seg, 4=sex
            days.append(d)
        d -= timedelta(days=1)
    return days


# ---------------------------------------------------------------------------
# Seed principal
# ---------------------------------------------------------------------------

async def seed(session: AsyncSession) -> None:
    now = _now()

    # ------------------------------------------------------------------
    # 0. Limpa dados existentes (ordem reversa de FK)
    # ------------------------------------------------------------------
    print("Limpando dados existentes...")
    for table in [
        "hour_bank_balance",
        "hour_bank_entries",
        "attendance_records",
        "employee_consents",
        "device_access_log",
        "authorized_devices",
        "facial_embeddings",
        "schedule_exceptions",
        "employees",
        "work_schedules",
        "companies",
    ]:
        await session.execute(text(f"DELETE FROM {table}"))  # noqa: S608 — dev only
    await session.flush()
    print("  OK")

    # ------------------------------------------------------------------
    # 1. Empresa
    # ------------------------------------------------------------------
    print("Criando empresa...")
    company = Company(
        id=uuid.uuid4(),
        name="Empresa Demo LTDA",
        cnpj="12.345.678/0001-90",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    session.add(company)
    await session.flush()
    print(f"  Empresa: {company.name} ({company.id})")

    # ------------------------------------------------------------------
    # 2. Super Admin (bootstrap — sem work_schedule)
    # ------------------------------------------------------------------
    print("Criando funcionários...")
    super_admin = Employee(
        id=uuid.uuid4(),
        company_id=company.id,
        full_name="Administrador Sistema",
        cpf_hash=_cpf_hash("000.000.000-00"),
        email="admin@empresa.com",
        role=EmployeeRole.SUPER_ADMIN,
        department="TI",
        is_active=True,
        password_hash=hash_password("Admin@123"),
        hired_at=date(2024, 1, 1),
        created_at=now,
        updated_at=now,
    )
    session.add(super_admin)
    await session.flush()

    # ------------------------------------------------------------------
    # 3. Escala de trabalho padrão (criada pelo super_admin)
    # ------------------------------------------------------------------
    print("Criando escala de trabalho...")
    schedule = WorkSchedule(
        id=uuid.uuid4(),
        company_id=company.id,
        name="Jornada Padrão 8h (seg–sex)",
        schedule_type=ScheduleType.FIXED,
        default_start=time(8, 0),
        default_end=time(17, 0),
        daily_minutes=480,
        workdays_mask=31,  # seg=1, ter=2, qua=4, qui=8, sex=16 → 31
        description="Horário comercial padrão com 1h de almoço.",
        is_active=True,
        created_by=super_admin.id,
        created_at=now,
        updated_at=now,
    )
    session.add(schedule)
    await session.flush()
    print(f"  Escala: {schedule.name} ({schedule.id})")

    # ------------------------------------------------------------------
    # 4. Demais funcionários (com work_schedule)
    # ------------------------------------------------------------------
    admin_emp = Employee(
        id=uuid.uuid4(),
        company_id=company.id,
        full_name="Ana Lima",
        cpf_hash=_cpf_hash("111.111.111-11"),
        email="ana.lima@empresa.com",
        role=EmployeeRole.ADMIN,
        department="RH",
        work_schedule_id=schedule.id,
        is_active=True,
        password_hash=hash_password("Admin@123"),
        hired_at=date(2024, 3, 1),
        created_at=now,
        updated_at=now,
    )
    manager_emp = Employee(
        id=uuid.uuid4(),
        company_id=company.id,
        full_name="Carlos Mendes",
        cpf_hash=_cpf_hash("222.222.222-22"),
        email="carlos.mendes@empresa.com",
        role=EmployeeRole.MANAGER,
        department="Operações",
        work_schedule_id=schedule.id,
        is_active=True,
        password_hash=hash_password("Gerente@123"),
        hired_at=date(2024, 6, 1),
        created_at=now,
        updated_at=now,
    )
    joao = Employee(
        id=uuid.uuid4(),
        company_id=company.id,
        full_name="João Silva",
        cpf_hash=_cpf_hash("333.333.333-33"),
        email="joao.silva@empresa.com",
        role=EmployeeRole.EMPLOYEE,
        department="Operações",
        work_schedule_id=schedule.id,
        is_active=True,
        password_hash=hash_password("Joao@123"),
        hired_at=date(2024, 9, 1),
        created_at=now,
        updated_at=now,
    )
    maria = Employee(
        id=uuid.uuid4(),
        company_id=company.id,
        full_name="Maria Santos",
        cpf_hash=_cpf_hash("444.444.444-44"),
        email="maria.santos@empresa.com",
        role=EmployeeRole.EMPLOYEE,
        department="Atendimento",
        work_schedule_id=schedule.id,
        is_active=True,
        password_hash=hash_password("Maria@123"),
        hired_at=date(2025, 1, 15),
        created_at=now,
        updated_at=now,
    )

    for emp in [admin_emp, manager_emp, joao, maria]:
        session.add(emp)
    await session.flush()

    all_employees = [super_admin, admin_emp, manager_emp, joao, maria]
    for emp in all_employees:
        print(f"  {emp.role.value:12s}  {emp.full_name:25s}  {emp.email}")

    # ------------------------------------------------------------------
    # 5. Dispositivo autorizado
    # ------------------------------------------------------------------
    print("\nCriando dispositivo autorizado...")
    raw_token = generate_token(32)
    token_hash = hash_token(raw_token)
    device = AuthorizedDevice(
        id=uuid.uuid4(),
        company_id=company.id,
        token_hash=token_hash,
        label="Terminal Recepção - PC 01",
        ip_ranges=["0.0.0.0/0"],  # dev: aceita qualquer IP
        is_active=True,
        created_by=super_admin.id,
        created_at=now,
    )
    session.add(device)
    await session.flush()
    print(f"  Dispositivo: {device.label} ({device.id})")

    # ------------------------------------------------------------------
    # 6. Consentimentos LGPD
    # ------------------------------------------------------------------
    print("Criando consentimentos LGPD...")
    for emp in all_employees:
        consent = EmployeeConsent(
            id=uuid.uuid4(),
            employee_id=emp.id,
            term_version="1.0",
            granted_at=now,
            ip_address="127.0.0.1",
            is_active=True,
        )
        session.add(consent)
    await session.flush()
    print(f"  {len(all_employees)} consentimentos criados")

    # ------------------------------------------------------------------
    # 7. Registros de ponto — últimos 5 dias úteis para João e Maria
    # ------------------------------------------------------------------
    print("Criando registros de ponto...")
    weekdays = _last_weekdays(5)

    records_created = 0
    for emp in [joao, maria]:
        for day in weekdays:
            # Entrada: 08:00 (±5 min de variação para parecer real)
            entry_hour = 8
            entry_min = 0 if emp is joao else 3

            entry_dt = datetime(
                day.year, day.month, day.day,
                entry_hour, entry_min, 0,
                tzinfo=timezone.utc,
            )
            # Saída: 17:00 (João às 17:02, Maria às 17:00)
            exit_min = 2 if emp is joao else 0
            exit_dt = datetime(
                day.year, day.month, day.day,
                17, exit_min, 0,
                tzinfo=timezone.utc,
            )

            for record_type, recorded_at in [(RecordType.IN, entry_dt), (RecordType.OUT, exit_dt)]:
                record = AttendanceRecord(
                    id=uuid.uuid4(),
                    employee_id=emp.id,
                    device_id=device.id,
                    recorded_at=recorded_at,
                    record_type=record_type,
                    facial_confidence=0.92,
                    ip_address="127.0.0.1",
                    is_adjustment=False,
                    created_at=recorded_at,
                )
                session.add(record)
                records_created += 1

    await session.flush()
    print(f"  {records_created} registros de ponto criados ({len(weekdays)} dias)")

    # ------------------------------------------------------------------
    # Commit
    # ------------------------------------------------------------------
    await session.commit()

    # ------------------------------------------------------------------
    # Resumo final
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("SEED CONCLUÍDO")
    print("=" * 60)
    print("\nCredenciais de acesso:")
    print(f"  {'Email':35s}  {'Senha':15s}  {'Role'}")
    print(f"  {'-'*35}  {'-'*15}  {'-'*12}")
    credentials = [
        ("admin@empresa.com",          "Admin@123",  "SUPER_ADMIN"),
        ("ana.lima@empresa.com",        "Admin@123",  "ADMIN"),
        ("carlos.mendes@empresa.com",   "Gerente@123","MANAGER"),
        ("joao.silva@empresa.com",      "Joao@123",   "EMPLOYEE"),
        ("maria.santos@empresa.com",    "Maria@123",  "EMPLOYEE"),
    ]
    for email, senha, role in credentials:
        print(f"  {email:35s}  {senha:15s}  {role}")

    print(f"\nDevice token (copie para X-Device-Token no frontend):")
    print(f"  {raw_token}")
    print(f"\nDevice ID: {device.id}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main() -> None:
    import asyncpg as _asyncpg

    async def _creator() -> _asyncpg.Connection:
        return await _asyncpg.connect(
            host="aws-1-sa-east-1.pooler.supabase.com",
            port=6543,
            user="postgres.dzrigbptvlpbruxtkbuu",
            password=settings.DATABASE_URL.split(":")[2].split("@")[0],
            database="postgres",
            ssl="require",
            statement_cache_size=0,
        )

    engine = create_async_engine(
        "postgresql+asyncpg://",
        async_creator=_creator,
        echo=False,
    )
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

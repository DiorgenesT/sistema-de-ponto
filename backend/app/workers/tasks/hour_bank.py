"""
Tasks Celery para recálculo de banco de horas.
Disparadas após aprovação de justificativa ou mensalmente.
"""

import asyncio
from datetime import date, datetime, timedelta

import structlog

from app.workers.celery_app import celery_app

log = structlog.get_logger(__name__)


def _run(coro):  # type: ignore[no-untyped-def]
    """Executa coroutine em task Celery síncrona."""
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.workers.tasks.hour_bank.recalculate_hour_bank_task", bind=True, max_retries=3)
def recalculate_hour_bank_task(self, employee_id: str, reference_date_str: str) -> dict:  # type: ignore[no-untyped-def]
    """
    Recalcula banco de horas de um dia específico.
    Disparado após aprovação de justificativa.

    Args:
        employee_id: UUID do funcionário como string.
        reference_date_str: Data no formato YYYY-MM-DD.
    """
    import uuid
    from app.infrastructure.database import AsyncSessionLocal
    from app.domain.attendance.repository import AttendanceRepository
    from app.domain.hour_bank.repository import HourBankRepository
    from app.domain.hour_bank.service import HourBankService

    async def _execute() -> dict:
        async with AsyncSessionLocal() as db:
            svc = HourBankService(
                HourBankRepository(db),
                AttendanceRepository(db),
            )
            ref_date = date.fromisoformat(reference_date_str)
            entry = await svc.recalculate_day(uuid.UUID(employee_id), ref_date)
            await db.commit()
            return {"balance_minutes": entry.balance_minutes, "date": reference_date_str}

    try:
        result = _run(_execute())
        log.info("task.hour_bank.recalculated", employee_id=employee_id, date=reference_date_str)
        return result
    except Exception as exc:
        log.error("task.hour_bank.failed", employee_id=employee_id, date=reference_date_str, error=str(exc))
        raise self.retry(exc=exc, countdown=60) from exc


@celery_app.task(name="app.workers.tasks.hour_bank.monthly_recalculate_all")
def monthly_recalculate_all() -> dict:
    """
    Recalcula banco de horas de todos os funcionários no mês anterior.
    Agendado pelo Celery Beat todo dia 1 às 02:00.
    """
    from app.infrastructure.database import AsyncSessionLocal
    from app.domain.employees.models import Employee
    from sqlalchemy import select

    async def _execute() -> dict:
        now = datetime.now()
        first_of_month = now.replace(day=1)
        last_month_end = first_of_month - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        async with AsyncSessionLocal() as db:
            from app.domain.attendance.repository import AttendanceRepository
            from app.domain.hour_bank.repository import HourBankRepository
            from app.domain.hour_bank.service import HourBankService

            result = await db.execute(
                select(Employee.id).where(Employee.is_active.is_(True), Employee.deleted_at.is_(None))
            )
            employee_ids = list(result.scalars().all())

            processed = 0
            for emp_id in employee_ids:
                svc = HourBankService(HourBankRepository(db), AttendanceRepository(db))
                await svc.recalculate_period(emp_id, last_month_start.date(), last_month_end.date())
                processed += 1

            await db.commit()
            return {"processed": processed, "period": f"{last_month_start.date()} → {last_month_end.date()}"}

    result = _run(_execute())
    log.info("task.hour_bank.monthly_done", **result)
    return result


@celery_app.task(name="app.workers.tasks.hour_bank.ntp_sync")
def ntp_sync() -> dict:
    """Mantém sincronização NTP periódica no worker."""
    from app.core.ntp import sync_ntp

    async def _execute() -> None:
        await sync_ntp()

    try:
        _run(_execute())
        return {"status": "synced"}
    except Exception as exc:
        log.error("task.ntp_sync.failed", error=str(exc))
        return {"status": "failed", "error": str(exc)}

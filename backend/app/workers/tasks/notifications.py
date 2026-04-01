"""
Tasks Celery para notificações.
"""

import asyncio
from datetime import date, timedelta

import structlog

from app.workers.celery_app import celery_app

log = structlog.get_logger(__name__)


def _run(coro):  # type: ignore[no-untyped-def]
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.workers.tasks.notifications.alert_expiring_hour_banks")
def alert_expiring_hour_banks() -> dict:
    """
    Alerta gestores sobre banco de horas prestes a vencer (< 30 dias).
    Agendado diariamente às 08:00.
    """
    from app.infrastructure.database import AsyncSessionLocal
    from app.domain.hour_bank.models import HourBankBalance
    from sqlalchemy import select

    async def _execute() -> dict:
        today = date.today()
        alert_threshold = today + timedelta(days=30)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(HourBankBalance).where(
                    HourBankBalance.expires_at <= alert_threshold,
                    HourBankBalance.expires_at >= today,
                    HourBankBalance.balance_minutes > 0,
                    HourBankBalance.alerted_at.is_(None),
                )
            )
            expiring = list(result.scalars().all())

            for balance in expiring:
                log.warning(
                    "hour_bank.expiry_alert",
                    employee_id=str(balance.employee_id),
                    balance_hours=round(balance.balance_minutes / 60, 2),
                    expires_at=str(balance.expires_at),
                )
                # TODO: integrar com sistema de e-mail/push notification
                from app.core.ntp import get_current_time
                balance.alerted_at = get_current_time()

            await db.commit()
            return {"alerted": len(expiring)}

    result = _run(_execute())
    log.info("task.notifications.expiry_done", **result)
    return result

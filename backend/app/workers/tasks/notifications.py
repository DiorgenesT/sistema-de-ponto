"""
Tasks Celery para notificações de banco de horas.

Alertas implementados:
- Banco de horas > 40h acumuladas (gestor deve agendar compensação)
- Banco de horas com vencimento em < 30 dias (prazo de compensação 180 dias)
"""

import asyncio
from datetime import date, timedelta

import structlog

from app.workers.celery_app import celery_app

log = structlog.get_logger(__name__)

HOUR_BANK_OVERFLOW_LIMIT_MINUTES = 40 * 60   # 40h acumuladas
EXPIRY_ALERT_DAYS = 30                        # alertar 30 dias antes do vencimento


def _run(coro):  # type: ignore[no-untyped-def]
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _build_expiry_email_html(employee_name: str, balance_hours: float, expires_at: date) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d97706;">⚠️ Banco de horas prestes a vencer</h2>
      <p>O funcionário <strong>{employee_name}</strong> possui banco de horas que vencerá em
         <strong>{expires_at.strftime("%d/%m/%Y")}</strong>.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; color: #6b7280;">Saldo</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">
            {balance_hours:.1f}h
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; color: #6b7280;">Vencimento</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: #d97706;">
            {expires_at.strftime("%d/%m/%Y")}
          </td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 0.875rem; margin-top: 16px;">
        Conforme Art. 59 §5º CLT, o banco de horas deve ser compensado em até 6 meses.
        Programe a compensação antes do vencimento para evitar pagamento em folha.
      </p>
      <p style="color: #9ca3af; font-size: 0.75rem;">Sistema de Ponto Eletrônico — notificação automática</p>
    </div>
    """


def _build_overflow_email_html(employee_name: str, balance_hours: float) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">🔴 Banco de horas elevado</h2>
      <p>O funcionário <strong>{employee_name}</strong> acumulou
         <strong>{balance_hours:.1f}h</strong> no banco de horas (limite recomendado: 40h).</p>
      <p>Recomenda-se agendar compensação para evitar passivo trabalhista.</p>
      <p style="color: #9ca3af; font-size: 0.75rem;">Sistema de Ponto Eletrônico — notificação automática</p>
    </div>
    """


@celery_app.task(name="app.workers.tasks.notifications.alert_expiring_hour_banks")
def alert_expiring_hour_banks() -> dict:
    """
    Alerta gestores sobre banco de horas prestes a vencer (< 30 dias).
    Agendado diariamente às 08:00.
    """

    async def _execute() -> dict:
        from sqlalchemy import select
        from app.infrastructure.database import AsyncSessionLocal
        from app.infrastructure.email import send_email
        from app.domain.hour_bank.models import HourBankBalance
        from app.domain.employees.models import Employee
        from app.core.ntp import get_current_time

        today = date.today()
        alert_threshold = today + timedelta(days=EXPIRY_ALERT_DAYS)
        sent = 0
        skipped = 0

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
                # Buscar nome e email do funcionário
                emp_result = await db.execute(
                    select(Employee.full_name, Employee.email).where(
                        Employee.id == balance.employee_id
                    )
                )
                emp = emp_result.first()
                if not emp:
                    skipped += 1
                    continue

                balance_hours = round(balance.balance_minutes / 60, 1)
                ok = await send_email(
                    to=emp.email,
                    subject=f"[Ponto] Banco de horas vence em {balance.expires_at.strftime('%d/%m/%Y')}",
                    body_html=_build_expiry_email_html(emp.full_name, balance_hours, balance.expires_at),
                )
                if ok:
                    sent += 1
                    balance.alerted_at = get_current_time()
                    log.warning(
                        "hour_bank.expiry_alert.sent",
                        employee_id=str(balance.employee_id),
                        balance_hours=balance_hours,
                        expires_at=str(balance.expires_at),
                    )
                else:
                    log.error(
                        "hour_bank.expiry_alert.email_failed",
                        employee_id=str(balance.employee_id),
                    )

            await db.commit()

        return {"alerted": sent, "skipped": skipped}

    result = _run(_execute())
    log.info("task.notifications.expiry_done", **result)
    return result


@celery_app.task(name="app.workers.tasks.notifications.alert_overflow_hour_banks")
def alert_overflow_hour_banks() -> dict:
    """
    Alerta gestores quando um funcionário ultrapassa 40h acumuladas.
    Agendado semanalmente às segundas às 07:00.
    """

    async def _execute() -> dict:
        from sqlalchemy import func, select
        from app.infrastructure.database import AsyncSessionLocal
        from app.infrastructure.email import send_email
        from app.domain.hour_bank.models import HourBankBalance
        from app.domain.employees.models import Employee, EmployeeRole

        alerted = 0

        async with AsyncSessionLocal() as db:
            # Funcionários com saldo total > 40h
            overflow_result = await db.execute(
                select(
                    HourBankBalance.employee_id,
                    func.sum(HourBankBalance.balance_minutes).label("total_minutes"),
                )
                .where(HourBankBalance.balance_minutes > 0)
                .group_by(HourBankBalance.employee_id)
                .having(func.sum(HourBankBalance.balance_minutes) > HOUR_BANK_OVERFLOW_LIMIT_MINUTES)
            )
            overflows = overflow_result.all()

            for row in overflows:
                emp_result = await db.execute(
                    select(Employee).where(Employee.id == row.employee_id)
                )
                employee = emp_result.scalar_one_or_none()
                if not employee or not employee.email:
                    continue

                balance_hours = round(row.total_minutes / 60, 1)

                # Notificar o próprio funcionário e o gestor (mesmo email por ora)
                ok = await send_email(
                    to=employee.email,
                    subject=f"[Ponto] Banco de horas elevado: {balance_hours}h acumuladas",
                    body_html=_build_overflow_email_html(employee.full_name, balance_hours),
                )
                if ok:
                    alerted += 1
                    log.warning(
                        "hour_bank.overflow_alert.sent",
                        employee_id=str(employee.id),
                        balance_hours=balance_hours,
                    )

        return {"alerted": alerted}

    result = _run(_execute())
    log.info("task.notifications.overflow_done", **result)
    return result

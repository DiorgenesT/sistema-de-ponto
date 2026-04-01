import uuid
from datetime import date, datetime, timedelta, timezone

import structlog

from app.core.ntp import get_current_time
from app.domain.attendance.repository import AttendanceRepository
from app.domain.hour_bank.calculator import (
    HOUR_BANK_COMPENSATION_DAYS,
    calculate_day,
)
from app.domain.hour_bank.models import HourBankBalance, HourBankEntry
from app.domain.hour_bank.repository import HourBankRepository

log = structlog.get_logger(__name__)

ALERT_THRESHOLD_MINUTES = 40 * 60  # alertar gestor se > 40h acumuladas


class HourBankService:
    def __init__(
        self,
        hour_bank_repo: HourBankRepository,
        attendance_repo: AttendanceRepository,
    ) -> None:
        self._repo = hour_bank_repo
        self._attendance_repo = attendance_repo

    async def recalculate_day(
        self,
        employee_id: uuid.UUID,
        reference_date: date,
        expected_minutes: int = 8 * 60,
        is_holiday: bool = False,
    ) -> HourBankEntry:
        """
        Recalcula banco de horas de um dia específico.
        Chamado via Celery após aprovação de ajuste.

        Args:
            employee_id: ID do funcionário.
            reference_date: Data a recalcular.
            expected_minutes: Minutos esperados pela escala.
            is_holiday: True se feriado/domingo.

        Returns:
            HourBankEntry atualizado.
        """
        records = await self._attendance_repo.get_daily_records(employee_id, reference_date)
        result = calculate_day(records, reference_date, expected_minutes, is_holiday)

        entry = HourBankEntry(
            employee_id=employee_id,
            reference_date=reference_date,
            worked_minutes=result.worked_minutes,
            expected_minutes=result.expected_minutes,
            balance_minutes=result.balance_minutes,
            extra_minutes_50pct=result.extra_minutes_50pct,
            extra_minutes_100pct=result.extra_minutes_100pct,
            intrajornada_discounted=result.intrajornada_discounted,
            is_holiday=result.is_holiday,
            calculated_at=get_current_time(),
        )

        entry = await self._repo.upsert_entry(entry)
        log.info(
            "hour_bank.recalculated",
            employee_id=str(employee_id),
            date=str(reference_date),
            balance_minutes=result.balance_minutes,
        )
        return entry

    async def recalculate_period(
        self,
        employee_id: uuid.UUID,
        start: date,
        end: date,
        expected_daily_minutes: int = 8 * 60,
    ) -> HourBankBalance:
        """
        Recalcula saldo do período e consolida HourBankBalance.
        Também agenda alerta se saldo > 40h (Portaria 671).

        Returns:
            HourBankBalance consolidado.
        """
        total_balance = 0

        current = start
        while current <= end:
            entry = await self.recalculate_day(employee_id, current, expected_daily_minutes)
            total_balance += entry.balance_minutes
            current += timedelta(days=1)

        expires_at = end + timedelta(days=HOUR_BANK_COMPENSATION_DAYS)
        now = get_current_time()

        balance = HourBankBalance(
            employee_id=employee_id,
            period_start=start,
            period_end=end,
            balance_minutes=total_balance,
            expires_at=expires_at,
            updated_at=now,
        )
        balance = await self._repo.upsert_balance(balance)

        if total_balance >= ALERT_THRESHOLD_MINUTES:
            log.warning(
                "hour_bank.threshold_exceeded",
                employee_id=str(employee_id),
                balance_hours=round(total_balance / 60, 2),
                expires_at=str(expires_at),
            )

        return balance

    async def get_summary(self, employee_id: uuid.UUID, start: date, end: date) -> dict:
        """
        Retorna resumo do banco de horas para o período.

        Returns:
            Dict com entradas diárias e saldo consolidado.
        """
        entries = await self._repo.get_entries_by_period(employee_id, start, end)
        balances = await self._repo.get_all_balances(employee_id)
        total = sum(e.balance_minutes for e in entries)

        return {
            "employee_id": employee_id,
            "total_balance_minutes": total,
            "total_balance_hours": round(total / 60, 2),
            "entries": entries,
            "balances": balances,
        }

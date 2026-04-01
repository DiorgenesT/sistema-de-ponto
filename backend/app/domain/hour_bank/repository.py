import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.hour_bank.models import HourBankBalance, HourBankEntry


class HourBankRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_entries_by_period(
        self, employee_id: uuid.UUID, start: date, end: date
    ) -> list[HourBankEntry]:
        """Lista entradas diárias de banco de horas no período."""
        result = await self._db.execute(
            select(HourBankEntry)
            .where(
                HourBankEntry.employee_id == employee_id,
                HourBankEntry.reference_date >= start,
                HourBankEntry.reference_date <= end,
            )
            .order_by(HourBankEntry.reference_date)
        )
        return list(result.scalars().all())

    async def upsert_entry(self, entry: HourBankEntry) -> HourBankEntry:
        """Insere ou substitui entrada diária (recálculo após ajuste)."""
        existing = await self._db.execute(
            select(HourBankEntry).where(
                HourBankEntry.employee_id == entry.employee_id,
                HourBankEntry.reference_date == entry.reference_date,
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            row.worked_minutes = entry.worked_minutes
            row.expected_minutes = entry.expected_minutes
            row.balance_minutes = entry.balance_minutes
            row.extra_minutes_50pct = entry.extra_minutes_50pct
            row.extra_minutes_100pct = entry.extra_minutes_100pct
            row.intrajornada_discounted = entry.intrajornada_discounted
            row.is_holiday = entry.is_holiday
            row.calculated_at = entry.calculated_at
            await self._db.flush()
            return row
        self._db.add(entry)
        await self._db.flush()
        await self._db.refresh(entry)
        return entry

    async def get_balance(self, employee_id: uuid.UUID, period_start: date, period_end: date) -> HourBankBalance | None:
        """Retorna saldo consolidado do período."""
        result = await self._db.execute(
            select(HourBankBalance).where(
                HourBankBalance.employee_id == employee_id,
                HourBankBalance.period_start == period_start,
                HourBankBalance.period_end == period_end,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_balance(self, balance: HourBankBalance) -> HourBankBalance:
        """Insere ou atualiza saldo consolidado."""
        existing = await self.get_balance(balance.employee_id, balance.period_start, balance.period_end)
        if existing:
            existing.balance_minutes = balance.balance_minutes
            existing.expires_at = balance.expires_at
            existing.updated_at = datetime.now(timezone.utc)
            await self._db.flush()
            return existing
        self._db.add(balance)
        await self._db.flush()
        await self._db.refresh(balance)
        return balance

    async def get_all_balances(self, employee_id: uuid.UUID) -> list[HourBankBalance]:
        """Lista todos os saldos do funcionário (para alerta de vencimento)."""
        result = await self._db.execute(
            select(HourBankBalance)
            .where(HourBankBalance.employee_id == employee_id)
            .order_by(HourBankBalance.period_start.desc())
        )
        return list(result.scalars().all())

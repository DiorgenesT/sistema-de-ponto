import uuid
from datetime import date, datetime

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.attendance.models import AttendanceRecord, RecordType


class AttendanceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, record_id: uuid.UUID) -> AttendanceRecord | None:
        """Busca registro por ID."""
        result = await self._db.execute(
            select(AttendanceRecord).where(AttendanceRecord.id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_last_for_employee_today(
        self, employee_id: uuid.UUID, reference_date: date
    ) -> AttendanceRecord | None:
        """Retorna o último registro do dia para verificar IN/OUT alternância."""
        result = await self._db.execute(
            select(AttendanceRecord)
            .where(
                AttendanceRecord.employee_id == employee_id,
                func.date(AttendanceRecord.recorded_at) == reference_date,
                AttendanceRecord.is_adjustment.is_(False),
            )
            .order_by(AttendanceRecord.recorded_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_daily_records(
        self, employee_id: uuid.UUID, reference_date: date
    ) -> list[AttendanceRecord]:
        """Lista todos os registros do dia (incluindo ajustes)."""
        result = await self._db.execute(
            select(AttendanceRecord)
            .where(
                AttendanceRecord.employee_id == employee_id,
                func.date(AttendanceRecord.recorded_at) == reference_date,
            )
            .order_by(AttendanceRecord.recorded_at)
        )
        return list(result.scalars().all())

    async def get_period_records(
        self,
        employee_id: uuid.UUID,
        start: datetime,
        end: datetime,
        include_adjustments: bool = True,
    ) -> list[AttendanceRecord]:
        """Lista registros em um período."""
        conditions = [
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.recorded_at >= start,
            AttendanceRecord.recorded_at <= end,
        ]
        if not include_adjustments:
            conditions.append(AttendanceRecord.is_adjustment.is_(False))

        result = await self._db.execute(
            select(AttendanceRecord)
            .where(and_(*conditions))
            .order_by(AttendanceRecord.recorded_at)
        )
        return list(result.scalars().all())

    async def create(self, record: AttendanceRecord) -> AttendanceRecord:
        """
        Insere novo registro de ponto.
        NUNCA fazer UPDATE em AttendanceRecord — trigger no banco bloqueia.
        """
        self._db.add(record)
        await self._db.flush()
        await self._db.refresh(record)
        return record

    async def count_today(self, employee_id: uuid.UUID, reference_date: date) -> int:
        """Conta registros do dia para validação de duplicidade."""
        result = await self._db.execute(
            select(func.count())
            .where(
                AttendanceRecord.employee_id == employee_id,
                func.date(AttendanceRecord.recorded_at) == reference_date,
                AttendanceRecord.is_adjustment.is_(False),
            )
        )
        return result.scalar_one()

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.schedules.models import ScheduleException, WorkSchedule


class ScheduleRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, schedule: WorkSchedule) -> WorkSchedule:
        """Persiste nova escala de trabalho."""
        self._db.add(schedule)
        await self._db.flush()
        await self._db.refresh(schedule, ["exceptions"])
        return schedule

    async def get_by_id(self, schedule_id: uuid.UUID) -> WorkSchedule | None:
        """Retorna escala por ID com exceções carregadas."""
        result = await self._db.execute(
            select(WorkSchedule)
            .options(selectinload(WorkSchedule.exceptions))
            .where(
                WorkSchedule.id == schedule_id,
                WorkSchedule.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[WorkSchedule]:
        """Lista escalas ativas da empresa."""
        result = await self._db.execute(
            select(WorkSchedule)
            .options(selectinload(WorkSchedule.exceptions))
            .where(
                WorkSchedule.company_id == company_id,
                WorkSchedule.is_active.is_(True),
                WorkSchedule.deleted_at.is_(None),
            )
            .order_by(WorkSchedule.name)
        )
        return list(result.scalars().all())

    async def get_exception_for_date(
        self, schedule_id: uuid.UUID, ref_date: date
    ) -> ScheduleException | None:
        """Retorna exceção pontual para uma data específica, se existir."""
        result = await self._db.execute(
            select(ScheduleException).where(
                ScheduleException.schedule_id == schedule_id,
                ScheduleException.exception_date == ref_date,
            )
        )
        return result.scalar_one_or_none()

    async def count_employees_with_schedule(self, schedule_id: uuid.UUID) -> int:
        """Conta funcionários ativos vinculados a esta escala."""
        from sqlalchemy import func
        from app.domain.employees.models import Employee

        result = await self._db.execute(
            select(func.count(Employee.id)).where(
                Employee.work_schedule_id == schedule_id,
                Employee.is_active.is_(True),
                Employee.deleted_at.is_(None),
            )
        )
        return result.scalar_one()

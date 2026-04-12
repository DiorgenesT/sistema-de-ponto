import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.justifications.models import Justification, JustificationStatus


class JustificationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, justification_id: uuid.UUID) -> Justification | None:
        result = await self._db.execute(
            select(Justification).where(Justification.id == justification_id)
        )
        return result.scalar_one_or_none()

    async def list_by_employee(self, employee_id: uuid.UUID) -> list[Justification]:
        result = await self._db.execute(
            select(Justification)
            .where(Justification.employee_id == employee_id)
            .order_by(Justification.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_pending_by_company(self, company_id: uuid.UUID) -> list[Justification]:
        """Lista justificativas pendentes da empresa para revisão do gestor."""
        from app.domain.employees.models import Employee
        result = await self._db.execute(
            select(Justification)
            .join(Employee, Justification.employee_id == Employee.id)
            .where(
                Employee.company_id == company_id,
                Justification.status == JustificationStatus.PENDING,
            )
            .order_by(Justification.created_at)
        )
        return list(result.scalars().all())

    async def count_pending(self, company_id: uuid.UUID) -> int:
        """Conta justificativas pendentes da empresa."""
        from sqlalchemy import func
        from app.domain.employees.models import Employee
        result = await self._db.execute(
            select(func.count(Justification.id))
            .join(Employee, Justification.employee_id == Employee.id)
            .where(
                Employee.company_id == company_id,
                Justification.status == JustificationStatus.PENDING,
            )
        )
        return result.scalar_one() or 0

    async def create(self, justification: Justification) -> Justification:
        self._db.add(justification)
        await self._db.flush()
        await self._db.refresh(justification)
        return justification

    async def update(self, justification: Justification) -> Justification:
        await self._db.flush()
        await self._db.refresh(justification)
        return justification

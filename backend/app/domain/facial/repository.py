import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.facial.models import FacialEmbedding


class FacialRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_all_active_by_company(self, company_id: uuid.UUID) -> list[FacialEmbedding]:
        """Retorna todos os embeddings ativos de funcionários de uma empresa (para identificação 1:N)."""
        from app.domain.employees.models import Employee
        result = await self._db.execute(
            select(FacialEmbedding)
            .join(Employee, FacialEmbedding.employee_id == Employee.id)
            .where(
                Employee.company_id == company_id,
                Employee.is_active.is_(True),
                FacialEmbedding.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_active_by_employee(self, employee_id: uuid.UUID) -> FacialEmbedding | None:
        """Retorna embedding ativo do funcionário."""
        result = await self._db.execute(
            select(FacialEmbedding).where(
                FacialEmbedding.employee_id == employee_id,
                FacialEmbedding.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, embedding: FacialEmbedding) -> FacialEmbedding:
        """Persiste novo embedding."""
        self._db.add(embedding)
        await self._db.flush()
        await self._db.refresh(embedding)
        return embedding

    async def deactivate(self, embedding: FacialEmbedding) -> None:
        """Desativa embedding (substituído por novo cadastro)."""
        embedding.is_active = False
        await self._db.flush()

    async def delete_all_for_employee(self, employee_id: uuid.UUID) -> None:
        """Exclui todos os embeddings do funcionário (Art. 18 LGPD)."""
        await self._db.execute(
            delete(FacialEmbedding).where(FacialEmbedding.employee_id == employee_id)
        )
        await self._db.flush()

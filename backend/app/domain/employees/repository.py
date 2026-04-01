import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.employees.models import Employee, EmployeeConsent


class EmployeeRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, employee_id: str | uuid.UUID) -> Employee | None:
        """Busca funcionário ativo por ID."""
        result = await self._db.execute(
            select(Employee).where(
                Employee.id == employee_id,
                Employee.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str, company_id: uuid.UUID) -> Employee | None:
        """Busca funcionário por email dentro da empresa."""
        result = await self._db.execute(
            select(Employee).where(
                Employee.email == email,
                Employee.company_id == company_id,
                Employee.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_cpf_hash(self, cpf_hash: str, company_id: uuid.UUID) -> Employee | None:
        """Busca funcionário por hash do CPF."""
        result = await self._db.execute(
            select(Employee).where(
                Employee.cpf_hash == cpf_hash,
                Employee.company_id == company_id,
                Employee.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_company(
        self,
        company_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        active_only: bool = True,
    ) -> tuple[list[Employee], int]:
        """Lista funcionários com paginação. Retorna (items, total)."""
        query = select(Employee).where(
            Employee.company_id == company_id,
            Employee.deleted_at.is_(None),
        )
        if active_only:
            query = query.where(Employee.is_active.is_(True))

        total_result = await self._db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = total_result.scalar_one()

        result = await self._db.execute(
            query.order_by(Employee.full_name).offset((page - 1) * page_size).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, employee: Employee) -> Employee:
        """Persiste novo funcionário."""
        self._db.add(employee)
        await self._db.flush()
        await self._db.refresh(employee)
        return employee

    async def update(self, employee: Employee) -> Employee:
        """Persiste alterações em funcionário existente."""
        employee.updated_at = datetime.now(timezone.utc)
        await self._db.flush()
        await self._db.refresh(employee)
        return employee

    async def soft_delete(self, employee: Employee) -> None:
        """Soft delete — nunca excluir registros de funcionários."""
        employee.deleted_at = datetime.now(timezone.utc)
        employee.is_active = False
        await self._db.flush()

    async def get_active_consent(self, employee_id: uuid.UUID) -> EmployeeConsent | None:
        """Retorna consentimento LGPD ativo do funcionário."""
        result = await self._db.execute(
            select(EmployeeConsent).where(
                EmployeeConsent.employee_id == employee_id,
                EmployeeConsent.is_active.is_(True),
                EmployeeConsent.revoked_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def create_consent(self, consent: EmployeeConsent) -> EmployeeConsent:
        """Registra novo consentimento LGPD."""
        self._db.add(consent)
        await self._db.flush()
        await self._db.refresh(consent)
        return consent

import hashlib
import uuid
from datetime import datetime, timezone

import structlog

from app.core.exceptions import ConsentNotGrantedError, EmployeeNotFoundError
from app.core.security import hash_password
from app.core.ntp import get_current_time
from app.domain.employees.models import Employee, EmployeeConsent
from app.domain.employees.repository import EmployeeRepository
from app.domain.employees.schemas import EmployeeCreateRequest, EmployeeUpdateRequest

log = structlog.get_logger(__name__)

CURRENT_CONSENT_VERSION = "1.0.0"


def _hash_cpf(cpf: str) -> str:
    """SHA-256 do CPF — nunca armazenar CPF em plain text."""
    return hashlib.sha256(cpf.encode()).hexdigest()


class EmployeeService:
    def __init__(self, repository: EmployeeRepository) -> None:
        self._repo = repository

    async def create(self, data: EmployeeCreateRequest, created_by_id: uuid.UUID) -> Employee:
        """
        Cria novo funcionário.

        Args:
            data: Dados do funcionário.
            created_by_id: ID do admin que está criando.

        Returns:
            Employee criado e persistido.

        Raises:
            DomainException: Email ou CPF já cadastrado.
        """
        cpf_hash = _hash_cpf(data.cpf)
        now = get_current_time()

        existing = await self._repo.get_by_cpf_hash(cpf_hash, data.company_id)
        if existing:
            from app.domain.employees.exceptions import EmployeeAlreadyExistsError
            raise EmployeeAlreadyExistsError("CPF já cadastrado nesta empresa.")

        existing_email = await self._repo.get_by_email(data.email, data.company_id)
        if existing_email:
            from app.domain.employees.exceptions import EmployeeAlreadyExistsError
            raise EmployeeAlreadyExistsError("E-mail já cadastrado nesta empresa.")

        employee = Employee(
            company_id=data.company_id,
            full_name=data.full_name,
            cpf_hash=cpf_hash,
            email=data.email,
            pis=data.pis,
            registration_number=data.registration_number,
            role=data.role,
            department=data.department,
            work_schedule_id=data.work_schedule_id,
            hired_at=data.hired_at,
            password_hash=hash_password(data.password),
            is_active=True,
            created_at=now,
            updated_at=now,
        )

        employee = await self._repo.create(employee)
        log.info("employee.created", employee_id=str(employee.id), company_id=str(data.company_id), created_by=str(created_by_id))
        return employee

    async def update(self, employee_id: uuid.UUID, data: EmployeeUpdateRequest, updated_by_id: uuid.UUID) -> Employee:
        """
        Atualiza dados do funcionário.

        Raises:
            EmployeeNotFoundError: Funcionário não encontrado.
        """
        employee = await self._repo.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundError()

        if data.full_name is not None:
            employee.full_name = data.full_name
        if data.email is not None:
            employee.email = data.email
        if data.role is not None:
            employee.role = data.role
        if data.department is not None:
            employee.department = data.department
        if data.work_schedule_id is not None:
            employee.work_schedule_id = data.work_schedule_id
        if data.is_active is not None:
            employee.is_active = data.is_active

        employee = await self._repo.update(employee)
        log.info("employee.updated", employee_id=str(employee_id), updated_by=str(updated_by_id))
        return employee

    async def get_or_raise(self, employee_id: uuid.UUID) -> Employee:
        """
        Busca funcionário ou lança exceção.

        Raises:
            EmployeeNotFoundError: Funcionário não encontrado ou inativo.
        """
        employee = await self._repo.get_by_id(employee_id)
        if not employee or not employee.is_active:
            raise EmployeeNotFoundError()
        return employee

    async def grant_lgpd_consent(self, employee_id: uuid.UUID, ip_address: str) -> EmployeeConsent:
        """
        Registra consentimento LGPD para dados biométricos.

        Returns:
            EmployeeConsent criado.
        """
        employee = await self.get_or_raise(employee_id)

        # Revogar consentimento anterior se existir
        existing = await self._repo.get_active_consent(employee_id)
        if existing:
            existing.is_active = False
            existing.revoked_at = get_current_time()

        consent = EmployeeConsent(
            employee_id=employee.id,
            term_version=CURRENT_CONSENT_VERSION,
            granted_at=get_current_time(),
            ip_address=ip_address,
            is_active=True,
        )
        consent = await self._repo.create_consent(consent)
        log.info("employee.consent.granted", employee_id=str(employee_id), version=CURRENT_CONSENT_VERSION)
        return consent

    async def verify_consent_active(self, employee_id: uuid.UUID) -> None:
        """
        Verifica se consentimento LGPD está ativo.

        Raises:
            ConsentNotGrantedError: Sem consentimento ativo.
        """
        consent = await self._repo.get_active_consent(employee_id)
        if not consent:
            raise ConsentNotGrantedError()

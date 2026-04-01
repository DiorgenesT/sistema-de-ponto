import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentEmployee, DBSession, require_admin
from app.domain.employees.repository import EmployeeRepository
from app.domain.employees.schemas import (
    EmployeeCreateRequest,
    EmployeeListResponse,
    EmployeeResponse,
    EmployeeUpdateRequest,
)
from app.domain.employees.service import EmployeeService

router = APIRouter()


def _build_service(db: AsyncSession) -> EmployeeService:
    return EmployeeService(EmployeeRepository(db))


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeResponse)
async def create_employee(
    body: EmployeeCreateRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> EmployeeResponse:
    """Cria funcionário. Requer ADMIN."""
    await require_admin(current_employee)
    svc = _build_service(db)
    employee = await svc.create(body, created_by_id=current_employee.id)
    return EmployeeResponse.model_validate(employee)


@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    db: DBSession,
    current_employee: CurrentEmployee,
    page: int = 1,
    page_size: int = 20,
) -> EmployeeListResponse:
    """Lista funcionários da empresa. Requer MANAGER."""
    from app.api.deps import require_manager
    await require_manager(current_employee)

    repo = EmployeeRepository(db)
    items, total = await repo.list_by_company(
        company_id=current_employee.company_id,
        page=page,
        page_size=page_size,
    )
    return EmployeeListResponse(
        items=[EmployeeResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/me", response_model=EmployeeResponse)
async def get_me(current_employee: CurrentEmployee) -> EmployeeResponse:
    """Retorna dados do funcionário autenticado."""
    return EmployeeResponse.model_validate(current_employee)


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: uuid.UUID,
    body: EmployeeUpdateRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> EmployeeResponse:
    """Atualiza funcionário. Requer ADMIN."""
    await require_admin(current_employee)
    svc = _build_service(db)
    employee = await svc.update(employee_id, body, updated_by_id=current_employee.id)
    return EmployeeResponse.model_validate(employee)


@router.post("/{employee_id}/consent", status_code=status.HTTP_201_CREATED)
async def grant_consent(
    employee_id: uuid.UUID,
    request: Request,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> dict:
    """Registra consentimento LGPD para dados biométricos."""
    # Funcionário só pode conceder seu próprio consentimento
    if current_employee.id != employee_id:
        from app.core.exceptions import InsufficientPermissionsError
        raise InsufficientPermissionsError("Só é possível conceder seu próprio consentimento.")

    svc = _build_service(db)
    ip = request.client.host if request.client else "unknown"
    consent = await svc.grant_lgpd_consent(employee_id, ip)
    return {"id": str(consent.id), "term_version": consent.term_version, "granted_at": consent.granted_at.isoformat()}

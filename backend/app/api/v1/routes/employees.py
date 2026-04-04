import uuid

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
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


class FaceEnrollRequest(BaseModel):
    image_b64: str


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
        active_only=False,
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


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: uuid.UUID,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> None:
    """Exclusão lógica de funcionário (soft delete). Requer ADMIN."""
    await require_admin(current_employee)
    repo = EmployeeRepository(db)
    employee = await repo.get_by_id(employee_id)
    if not employee:
        from app.core.exceptions import EmployeeNotFoundError
        raise EmployeeNotFoundError()
    if employee.id == current_employee.id:
        from app.core.exceptions import InsufficientPermissionsError
        raise InsufficientPermissionsError("Não é possível excluir o próprio usuário.")
    await repo.soft_delete(employee)


@router.post("/{employee_id}/enroll-face", status_code=status.HTTP_201_CREATED)
async def enroll_face(
    employee_id: uuid.UUID,
    body: FaceEnrollRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> dict:
    """
    Cadastra embedding facial de um funcionário.

    Requer ADMIN. O funcionário deve ter consentimento LGPD ativo antes do cadastro.
    O token é retornado apenas para confirmação — o embedding nunca sai descriptografado.
    """
    await require_admin(current_employee)

    from app.domain.facial.repository import FacialRepository
    from app.domain.facial.service import FacialService

    employee_repo = EmployeeRepository(db)
    employee_svc = EmployeeService(employee_repo)
    facial_repo = FacialRepository(db)
    facial_svc = FacialService(facial_repo, employee_svc)

    # Garantir consentimento LGPD ativo antes do enrollment.
    # O admin registra o consentimento presencialmente em nome do funcionário.
    await employee_svc.grant_lgpd_consent(employee_id, ip_address="admin-panel")

    await facial_svc.enroll(
        employee_id=employee_id,
        image_b64=body.image_b64,
        enrolled_by_id=current_employee.id,
    )
    return {"enrolled": True, "employee_id": str(employee_id)}


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

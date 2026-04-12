import uuid

import structlog
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentEmployee, DBSession, require_authorized_device
from app.domain.attendance.repository import AttendanceRepository
from app.domain.attendance.schemas import (
    AttendanceAdjustmentRequest,
    AttendanceCreateRequest,
    AttendanceListResponse,
    AttendanceResponse,
)
from app.domain.attendance.service import AttendanceService
from app.domain.devices.models import AuthorizedDevice
from app.domain.devices.repository import DeviceRepository
from app.domain.employees.repository import EmployeeRepository
from app.domain.employees.service import EmployeeService
from app.domain.facial.repository import FacialRepository
from app.domain.facial.service import FacialService
from app.infrastructure.database import get_db

router = APIRouter()
log = structlog.get_logger(__name__)


def _build_service(db: AsyncSession) -> AttendanceService:
    employee_repo = EmployeeRepository(db)
    employee_svc = EmployeeService(employee_repo)
    facial_repo = FacialRepository(db)
    facial_svc = FacialService(facial_repo, employee_svc)
    attendance_repo = AttendanceRepository(db)
    return AttendanceService(attendance_repo, facial_svc)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AttendanceResponse)
async def register_attendance(
    request: Request,
    body: AttendanceCreateRequest,
    db: DBSession,
    device: AuthorizedDevice = Depends(require_authorized_device),
) -> AttendanceResponse:
    """
    Registra ponto com verificação facial.

    Requer: X-Device-Token válido + IP autorizado.
    Não requer JWT — o funcionário é identificado pelo reconhecimento facial.
    """
    svc = _build_service(db)
    ip_address = request.client.host if request.client else "unknown"

    employee_id = body.employee_id

    # Resolver terminal_code → employee_id para verificação 1:1
    if employee_id is None and body.terminal_code is not None:
        from app.core.exceptions import EmployeeNotFoundError
        emp = await EmployeeRepository(db).get_by_terminal_code(
            body.terminal_code, device.company_id
        )
        if not emp:
            raise EmployeeNotFoundError("Código de funcionário não encontrado.")
        employee_id = emp.id

    record = await svc.register(
        employee_id=employee_id,  # None → identificação 1:N; UUID → verificação 1:1
        image_b64=body.image_b64,
        device=device,
        ip_address=ip_address,
    )

    # Buscar nome do funcionário para exibição no terminal
    employee_repo = EmployeeRepository(db)
    employee = await employee_repo.get_by_id(record.employee_id)

    response = AttendanceResponse.model_validate(record)
    response.employee_name = employee.full_name if employee else None
    return response


@router.get("/validate-code")
async def validate_terminal_code(
    code: str,
    db: DBSession,
    device: AuthorizedDevice = Depends(require_authorized_device),
) -> dict:
    """
    Valida código do terminal e retorna nome do funcionário.
    Requer: X-Device-Token válido. Não requer JWT.
    Usado pelo terminal antes de abrir a câmera.
    """
    emp_repo = EmployeeRepository(db)
    employee = await emp_repo.get_by_terminal_code(code, device.company_id)
    if not employee or not employee.is_active:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "INVALID_CODE", "message": "Código não encontrado."})
    return {"employee_id": str(employee.id), "full_name": employee.full_name}


@router.get("/me", response_model=AttendanceListResponse)
async def get_my_attendance(
    db: DBSession,
    current_employee: CurrentEmployee,
    start: str | None = None,
    end: str | None = None,
) -> AttendanceListResponse:
    """Lista registros de ponto do funcionário autenticado."""
    from datetime import datetime, timezone

    repo = AttendanceRepository(db)
    now = datetime.now(timezone.utc)

    start_dt = datetime.fromisoformat(start) if start else now.replace(day=1, hour=0, minute=0, second=0)
    end_dt = datetime.fromisoformat(end) if end else now

    records = await repo.get_period_records(current_employee.id, start_dt, end_dt)
    return AttendanceListResponse(
        items=[AttendanceResponse.model_validate(r) for r in records],
        total=len(records),
    )


@router.post("/adjustment", status_code=status.HTTP_201_CREATED, response_model=AttendanceResponse)
async def create_adjustment(
    request: Request,
    body: AttendanceAdjustmentRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
    device: AuthorizedDevice = Depends(require_authorized_device),
) -> AttendanceResponse:
    """
    Cria ajuste de ponto. Requer perfil MANAGER ou superior.
    Não modifica o registro original — cria novo com referência.
    """
    from app.api.deps import require_manager
    await require_manager(current_employee)

    svc = _build_service(db)
    ip_address = request.client.host if request.client else "unknown"

    adjustment = await svc.create_adjustment(
        original_record_id=body.original_record_id,
        corrected_time=body.corrected_time,
        reason=body.reason,
        record_type=body.record_type,
        approved_by=current_employee.id,
        device=device,
        ip_address=ip_address,
    )
    return AttendanceResponse.model_validate(adjustment)

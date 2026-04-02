import uuid
from datetime import date

from fastapi import APIRouter, status

from app.api.deps import CurrentEmployee, DBSession, require_admin, require_manager
from app.domain.schedules.repository import ScheduleRepository
from app.domain.schedules.schemas import (
    WorkScheduleCreateRequest,
    WorkScheduleResponse,
    WorkScheduleUpdateRequest,
)
from app.domain.schedules.service import ScheduleService

router = APIRouter()


def _build_service(db) -> ScheduleService:  # type: ignore[no-untyped-def]
    return ScheduleService(ScheduleRepository(db))


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkScheduleResponse)
async def create_schedule(
    body: WorkScheduleCreateRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> WorkScheduleResponse:
    """Cria escala de trabalho. Requer ADMIN."""
    await require_admin(current_employee)
    svc = _build_service(db)
    schedule = await svc.create(body, created_by_id=current_employee.id)
    return WorkScheduleResponse.model_validate(schedule)


@router.get("", response_model=list[WorkScheduleResponse])
async def list_schedules(
    db: DBSession,
    current_employee: CurrentEmployee,
) -> list[WorkScheduleResponse]:
    """Lista escalas da empresa. Requer MANAGER."""
    await require_manager(current_employee)
    repo = ScheduleRepository(db)
    schedules = await repo.list_by_company(current_employee.company_id)
    return [WorkScheduleResponse.model_validate(s) for s in schedules]


@router.get("/{schedule_id}", response_model=WorkScheduleResponse)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> WorkScheduleResponse:
    """Retorna escala por ID. Requer MANAGER."""
    await require_manager(current_employee)
    repo = ScheduleRepository(db)
    schedule = await repo.get_by_id(schedule_id)
    if not schedule:
        from app.domain.schedules.exceptions import ScheduleNotFoundError
        raise ScheduleNotFoundError()
    return WorkScheduleResponse.model_validate(schedule)


@router.patch("/{schedule_id}", response_model=WorkScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    body: WorkScheduleUpdateRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> WorkScheduleResponse:
    """Atualiza escala de trabalho. Requer ADMIN."""
    await require_admin(current_employee)
    svc = _build_service(db)
    schedule = await svc.update(schedule_id, body, updated_by_id=current_employee.id)
    return WorkScheduleResponse.model_validate(schedule)


@router.get("/{schedule_id}/date/{ref_date}")
async def get_schedule_for_date(
    schedule_id: uuid.UUID,
    ref_date: date,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> dict:
    """
    Retorna parâmetros efetivos da escala para uma data (com exceções aplicadas).
    Útil para o calculador de banco de horas saber os minutos esperados.
    Requer MANAGER.
    """
    await require_manager(current_employee)
    svc = _build_service(db)
    return await svc.get_for_date(schedule_id, ref_date)

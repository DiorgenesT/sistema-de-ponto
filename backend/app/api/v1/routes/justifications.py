import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentEmployee, DBSession
from app.domain.justifications.repository import JustificationRepository
from app.domain.justifications.schemas import (
    JustificationCreateRequest,
    JustificationResponse,
    JustificationReviewRequest,
)
from app.domain.justifications.service import JustificationService

router = APIRouter()


def _build_service(db) -> JustificationService:  # type: ignore[no-untyped-def]
    return JustificationService(JustificationRepository(db))


@router.post("", status_code=status.HTTP_201_CREATED, response_model=JustificationResponse)
async def create_justification(
    body: JustificationCreateRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> JustificationResponse:
    """Cria solicitação de justificativa/ajuste de ponto."""
    svc = _build_service(db)
    justification = await svc.create(current_employee.id, body)
    return JustificationResponse.model_validate(justification)


@router.get("/me", response_model=list[JustificationResponse])
async def get_my_justifications(
    db: DBSession,
    current_employee: CurrentEmployee,
) -> list[JustificationResponse]:
    """Lista justificativas do funcionário autenticado."""
    repo = JustificationRepository(db)
    items = await repo.list_by_employee(current_employee.id)
    return [JustificationResponse.model_validate(j) for j in items]


@router.get("/pending", response_model=list[JustificationResponse])
async def get_pending_justifications(
    db: DBSession,
    current_employee: CurrentEmployee,
) -> list[JustificationResponse]:
    """Lista justificativas pendentes da empresa. Requer MANAGER."""
    from app.api.deps import require_manager
    await require_manager(current_employee)

    repo = JustificationRepository(db)
    items = await repo.list_pending_by_company(current_employee.company_id)
    return [JustificationResponse.model_validate(j) for j in items]


@router.patch("/{justification_id}/review", response_model=JustificationResponse)
async def review_justification(
    justification_id: uuid.UUID,
    body: JustificationReviewRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> JustificationResponse:
    """
    Aprova ou rejeita justificativa. Requer MANAGER.
    Aprovação dispara recálculo de banco de horas via Celery.
    """
    from app.api.deps import require_manager
    await require_manager(current_employee)

    svc = _build_service(db)
    justification = await svc.review(justification_id, body, reviewed_by=current_employee.id)
    return JustificationResponse.model_validate(justification)

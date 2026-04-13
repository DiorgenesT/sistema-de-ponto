import uuid

import structlog

from app.core.exceptions import InsufficientPermissionsError
from app.core.ntp import get_current_time
from app.domain.justifications.models import Justification, JustificationStatus
from app.domain.justifications.repository import JustificationRepository
from app.domain.justifications.schemas import JustificationCreateRequest, JustificationReviewRequest

log = structlog.get_logger(__name__)


class JustificationService:
    def __init__(self, repository: JustificationRepository) -> None:
        self._repo = repository

    async def create(
        self,
        employee_id: uuid.UUID,
        data: JustificationCreateRequest,
    ) -> Justification:
        """
        Cria solicitação de justificativa/ajuste.

        Returns:
            Justification com status PENDING.
        """
        justification = Justification(
            employee_id=employee_id,
            attendance_record_id=data.attendance_record_id,
            justification_type=data.justification_type,
            reference_date=data.reference_date,
            description=data.description,
            attachment_path=data.attachment_b64 if data.attachment_b64 else None,
            status=JustificationStatus.PENDING,
            created_at=get_current_time(),
        )
        justification = await self._repo.create(justification)
        log.info("justification.created", id=str(justification.id), employee_id=str(employee_id))
        return justification

    async def review(
        self,
        justification_id: uuid.UUID,
        data: JustificationReviewRequest,
        reviewed_by: uuid.UUID,
    ) -> Justification:
        """
        Aprova ou rejeita justificativa.
        Se aprovada, dispara recálculo do banco de horas via Celery.

        Args:
            justification_id: ID da justificativa.
            data: Status (APPROVED/REJECTED) e notas.
            reviewed_by: ID do gestor/admin que revisou.

        Returns:
            Justification atualizada.

        Raises:
            JustificationNotFoundError: Justificativa não encontrada.
            DomainException: Tentativa de revisar justificativa já revisada.
        """
        from app.domain.justifications.exceptions import (
            JustificationAlreadyReviewedError,
            JustificationNotFoundError,
        )

        justification = await self._repo.get_by_id(justification_id)
        if not justification:
            raise JustificationNotFoundError()

        if justification.status != JustificationStatus.PENDING:
            raise JustificationAlreadyReviewedError()

        if data.status == JustificationStatus.PENDING:
            raise InsufficientPermissionsError("Status de revisão deve ser APPROVED ou REJECTED.")

        justification.status = data.status
        justification.reviewed_by = reviewed_by
        justification.reviewed_at = get_current_time()
        justification.review_notes = data.review_notes

        justification = await self._repo.update(justification)

        if data.status == JustificationStatus.APPROVED:
            # Disparar recálculo de banco de horas via Celery (async)
            from app.workers.tasks.hour_bank import recalculate_hour_bank_task
            recalculate_hour_bank_task.delay(
                str(justification.employee_id),
                str(justification.reference_date),
            )
            log.info(
                "justification.approved",
                id=str(justification_id),
                employee_id=str(justification.employee_id),
                date=str(justification.reference_date),
            )
        else:
            log.info("justification.rejected", id=str(justification_id))

        return justification

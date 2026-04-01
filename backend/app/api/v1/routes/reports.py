import uuid
from datetime import date

from fastapi import APIRouter, status

from app.api.deps import CurrentEmployee, DBSession, require_super_admin

router = APIRouter()


@router.post("/afd", status_code=status.HTTP_202_ACCEPTED)
async def request_afd(
    company_id: uuid.UUID,
    start_date: date,
    end_date: date,
    current_employee: CurrentEmployee,
) -> dict:
    """
    Solicita geração do AFD (Arquivo Fonte de Dados).
    Processamento assíncrono via Celery.
    Requer SUPER_ADMIN — rota protegida para fiscalização.
    """
    await require_super_admin(current_employee)

    from app.workers.tasks.reports import generate_afd
    task = generate_afd.delay(
        str(company_id),
        str(start_date),
        str(end_date),
        str(current_employee.id),
    )

    return {
        "task_id": task.id,
        "status": "queued",
        "message": "AFD sendo gerado. Consulte o Storage quando concluído.",
    }


@router.get("/afd/status/{task_id}")
async def get_afd_status(task_id: str, current_employee: CurrentEmployee) -> dict:
    """Consulta status da geração do AFD."""
    await require_super_admin(current_employee)

    from app.workers.celery_app import celery_app
    task = celery_app.AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": task.status,
        "result": task.result if task.ready() else None,
    }

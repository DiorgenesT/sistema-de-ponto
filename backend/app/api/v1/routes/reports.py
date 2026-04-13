import uuid
from datetime import date, datetime, timezone

import structlog
from fastapi import APIRouter, status
from fastapi.responses import PlainTextResponse

from app.api.deps import CurrentEmployee, DBSession, require_super_admin

log = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/afd/download", response_class=PlainTextResponse)
async def download_afd(
    company_id: uuid.UUID,
    start_date: date,
    end_date: date,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> PlainTextResponse:
    """
    Gera e baixa o AFD (Arquivo Fonte de Dados) de forma síncrona.
    Formato conforme Portaria 671/2021, Anexo I.
    Requer SUPER_ADMIN.
    """
    await require_super_admin(current_employee)

    content = await _build_afd_content(db, company_id, start_date, end_date)
    filename = f"AFD_{start_date}_{end_date}.txt"

    log.info(
        "reports.afd.downloaded",
        company_id=str(company_id),
        start_date=str(start_date),
        end_date=str(end_date),
        requested_by=str(current_employee.id),
    )

    return PlainTextResponse(
        content=content,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "text/plain; charset=utf-8",
        },
    )


@router.post("/afd", status_code=status.HTTP_202_ACCEPTED)
async def request_afd(
    company_id: uuid.UUID,
    start_date: date,
    end_date: date,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> dict:
    """
    Solicita geração do AFD via Celery (fallback assíncrono).
    Requer SUPER_ADMIN.
    """
    await require_super_admin(current_employee)

    try:
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
    except Exception:
        return {
            "task_id": None,
            "status": "unavailable",
            "message": "Worker não disponível. Use o download direto.",
        }


@router.get("/afd/status/{task_id}")
async def get_afd_status(task_id: str, current_employee: CurrentEmployee) -> dict:
    """Consulta status da geração do AFD via Celery."""
    await require_super_admin(current_employee)

    try:
        from app.workers.celery_app import celery_app
        task = celery_app.AsyncResult(task_id)
        return {
            "task_id": task_id,
            "status": task.status,
            "result": task.result if task.ready() else None,
        }
    except Exception:
        return {"task_id": task_id, "status": "UNKNOWN", "result": None}


async def _build_afd_content(db, company_id: uuid.UUID, start: date, end: date) -> str:
    """
    Monta conteúdo do AFD no formato fixo da Portaria 671/2021.
    Tipo 1: Header — Tipo 2: Registros — Tipo 9: Trailer
    """
    from app.domain.attendance.models import AttendanceRecord
    from app.domain.employees.models import Employee
    from sqlalchemy import select

    lines: list[str] = []

    now = datetime.now(timezone.utc)
    lines.append(
        "1"
        + now.strftime("%d%m%Y")
        + now.strftime("%H%M%S")
        + str(company_id).replace("-", "")[:14].ljust(14)
        + " " * 49
        + "001"
    )

    result = await db.execute(
        select(AttendanceRecord, Employee)
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(
            Employee.company_id == company_id,
            AttendanceRecord.recorded_at >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
            AttendanceRecord.recorded_at <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .order_by(AttendanceRecord.recorded_at)
    )

    seq = 1
    for record, employee in result:
        pis = (getattr(employee, "pis", None) or "00000000000").ljust(11)[:11]
        ts = record.recorded_at
        lines.append(
            "2"
            + ts.strftime("%d%m%Y")
            + ts.strftime("%H%M")
            + pis
            + str(seq).zfill(9)
        )
        seq += 1

    lines.append("9" + str(seq - 1).zfill(9))

    return "\r\n".join(lines) + "\r\n"

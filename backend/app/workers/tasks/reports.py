"""
Tasks Celery para geração de relatórios.
AFD — Arquivo Fonte de Dados (Portaria 671/2021, Anexo I).
"""

import asyncio

import structlog

from app.workers.celery_app import celery_app

log = structlog.get_logger(__name__)


def _run(coro):  # type: ignore[no-untyped-def]
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.workers.tasks.reports.generate_afd", bind=True, max_retries=2)
def generate_afd(self, company_id: str, start_date: str, end_date: str, requested_by: str) -> dict:  # type: ignore[no-untyped-def]
    """
    Gera Arquivo Fonte de Dados (AFD) conforme Portaria 671/2021, Anexo I.
    Armazena resultado no Supabase Storage.

    Args:
        company_id: UUID da empresa.
        start_date: Data início (YYYY-MM-DD).
        end_date: Data fim (YYYY-MM-DD).
        requested_by: UUID do SUPER_ADMIN que solicitou.

    Returns:
        Dict com path do arquivo gerado no Storage.
    """
    import uuid
    from datetime import date
    from app.infrastructure.database import AsyncSessionLocal
    from app.infrastructure.supabase import get_supabase_client

    async def _execute() -> dict:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)

        async with AsyncSessionLocal() as db:
            afd_content = await _build_afd_content(db, uuid.UUID(company_id), start, end)

        # Persistir no Supabase Storage (mínimo 5 anos — Portaria 671)
        client = get_supabase_client()
        filename = f"afd/{company_id}/{start_date}_{end_date}.txt"
        client.storage.from_("reports").upload(
            path=filename,
            file=afd_content.encode("utf-8"),
            file_options={"content-type": "text/plain"},
        )

        log.info("reports.afd.generated", company_id=company_id, file=filename, requested_by=requested_by)
        return {"path": filename, "lines": afd_content.count("\n")}

    try:
        return _run(_execute())
    except Exception as exc:
        log.error("reports.afd.failed", company_id=company_id, error=str(exc))
        raise self.retry(exc=exc, countdown=120) from exc


async def _build_afd_content(db, company_id, start, end) -> str:  # type: ignore[no-untyped-def]
    """
    Monta conteúdo do AFD no formato fixo da Portaria 671/2021.

    Tipo 1: Header
    Tipo 2: Registro de ponto
    Tipo 9: Trailer
    """
    from app.domain.attendance.models import AttendanceRecord
    from app.domain.employees.models import Employee
    from sqlalchemy import select
    from datetime import datetime, timezone

    lines = []

    # Tipo 1 — Header
    now = datetime.now(timezone.utc)
    lines.append(
        "1"                                    # tipo registro
        + now.strftime("%d%m%Y")               # data geração
        + now.strftime("%H%M%S")               # hora geração
        + str(company_id).replace("-", "")[:14].ljust(14)  # CNPJ/CPF empregador
        + " " * 49                             # razão social (simplificado)
        + "001"                                # nº sequencial
    )

    # Tipo 2 — Registros de ponto
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
        pis = (employee.pis or "00000000000").ljust(11)[:11]
        ts = record.recorded_at
        lines.append(
            "2"                                # tipo registro
            + ts.strftime("%d%m%Y")            # data
            + ts.strftime("%H%M")              # hora
            + pis                              # PIS/PASEP
            + str(seq).zfill(9)               # nº sequencial
        )
        seq += 1

    # Tipo 9 — Trailer
    lines.append(
        "9"
        + str(seq - 1).zfill(9)               # total de registros tipo 2
    )

    return "\r\n".join(lines) + "\r\n"

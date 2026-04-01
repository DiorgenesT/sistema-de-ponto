import uuid
from datetime import date

from fastapi import APIRouter

from app.api.deps import CurrentEmployee, DBSession
from app.domain.attendance.repository import AttendanceRepository
from app.domain.hour_bank.repository import HourBankRepository
from app.domain.hour_bank.schemas import HourBankBalanceResponse, HourBankSummaryResponse
from app.domain.hour_bank.service import HourBankService

router = APIRouter()


def _build_service(db) -> HourBankService:  # type: ignore[no-untyped-def]
    return HourBankService(HourBankRepository(db), AttendanceRepository(db))


@router.get("/me", response_model=HourBankSummaryResponse)
async def get_my_hour_bank(
    db: DBSession,
    current_employee: CurrentEmployee,
    start: date | None = None,
    end: date | None = None,
) -> HourBankSummaryResponse:
    """Retorna resumo do banco de horas do funcionário autenticado."""
    from datetime import date as d
    today = d.today()
    period_start = start or today.replace(day=1)
    period_end = end or today

    svc = _build_service(db)
    summary = await svc.get_summary(current_employee.id, period_start, period_end)

    from app.domain.hour_bank.schemas import HourBankEntryResponse
    return HourBankSummaryResponse(
        employee_id=summary["employee_id"],
        total_balance_minutes=summary["total_balance_minutes"],
        total_balance_hours=summary["total_balance_hours"],
        entries=[HourBankEntryResponse.model_validate(e) for e in summary["entries"]],
        balances=[HourBankBalanceResponse.from_model(b) for b in summary["balances"]],
    )


@router.get("/{employee_id}", response_model=HourBankSummaryResponse)
async def get_employee_hour_bank(
    employee_id: uuid.UUID,
    db: DBSession,
    current_employee: CurrentEmployee,
    start: date | None = None,
    end: date | None = None,
) -> HourBankSummaryResponse:
    """Retorna banco de horas de um funcionário. Requer MANAGER."""
    from app.api.deps import require_manager
    await require_manager(current_employee)

    from datetime import date as d
    today = d.today()
    period_start = start or today.replace(day=1)
    period_end = end or today

    svc = _build_service(db)
    summary = await svc.get_summary(employee_id, period_start, period_end)

    from app.domain.hour_bank.schemas import HourBankEntryResponse
    return HourBankSummaryResponse(
        employee_id=summary["employee_id"],
        total_balance_minutes=summary["total_balance_minutes"],
        total_balance_hours=summary["total_balance_hours"],
        entries=[HourBankEntryResponse.model_validate(e) for e in summary["entries"]],
        balances=[HourBankBalanceResponse.from_model(b) for b in summary["balances"]],
    )

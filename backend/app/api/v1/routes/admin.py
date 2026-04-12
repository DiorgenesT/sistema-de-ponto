"""
Rotas administrativas — estatísticas e visões de gestão.
"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter

from app.api.deps import CurrentEmployee, DBSession
from app.domain.attendance.repository import AttendanceRepository
from app.domain.attendance.schemas import AttendanceListResponse, AttendanceResponse
from app.domain.employees.repository import EmployeeRepository
from app.domain.employees.schemas import EmployeeResponse

router = APIRouter()


@router.get("/stats")
async def get_admin_stats(
    db: DBSession,
    current_employee: CurrentEmployee,
) -> dict:
    """
    Estatísticas gerais para o dashboard administrativo.
    Requer MANAGER ou superior.
    """
    from app.api.deps import require_manager
    from app.domain.facial.repository import FacialRepository
    from app.domain.justifications.repository import JustificationRepository
    from app.domain.justifications.models import JustificationStatus
    from sqlalchemy import select, func
    from app.domain.attendance.models import AttendanceRecord
    from app.domain.employees.models import Employee

    await require_manager(current_employee)
    company_id = current_employee.company_id

    emp_repo = EmployeeRepository(db)

    # Total e ativos
    all_employees, total = await emp_repo.list_by_company(company_id, page=1, page_size=1, active_only=False)
    active_employees, active_total = await emp_repo.list_by_company(company_id, page=1, page_size=1, active_only=True)

    # Registros de hoje
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)

    today_count_result = await db.execute(
        select(func.count(AttendanceRecord.id))
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(
            Employee.company_id == company_id,
            AttendanceRecord.recorded_at >= today_start,
            AttendanceRecord.recorded_at <= today_end,
            AttendanceRecord.is_adjustment.is_(False),
        )
    )
    today_count = today_count_result.scalar_one() or 0

    # Funcionários que bateram ponto hoje (únicos)
    today_employees_result = await db.execute(
        select(func.count(AttendanceRecord.employee_id.distinct()))
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(
            Employee.company_id == company_id,
            AttendanceRecord.recorded_at >= today_start,
            AttendanceRecord.recorded_at <= today_end,
        )
    )
    today_employees = today_employees_result.scalar_one() or 0

    # Justificativas pendentes
    just_repo = JustificationRepository(db)
    pending_justifications = await just_repo.count_pending(company_id)

    # Funcionários com biometria
    facial_repo = FacialRepository(db)
    enrolled_ids = await facial_repo.get_enrolled_employee_ids(company_id)

    return {
        "total_employees": total,
        "active_employees": active_total,
        "employees_with_face": len(enrolled_ids),
        "today_registrations": today_count,
        "today_employees_present": today_employees,
        "pending_justifications": pending_justifications,
    }


@router.get("/attendance", response_model=AttendanceListResponse)
async def list_all_attendance(
    db: DBSession,
    current_employee: CurrentEmployee,
    employee_id: uuid.UUID | None = None,
    start: date | None = None,
    end: date | None = None,
    page: int = 1,
    page_size: int = 50,
) -> AttendanceListResponse:
    """
    Lista registros de ponto de toda a empresa (ou de um funcionário específico).
    Requer MANAGER ou superior.
    """
    from app.api.deps import require_manager
    from sqlalchemy import select, func
    from app.domain.attendance.models import AttendanceRecord
    from app.domain.employees.models import Employee

    await require_manager(current_employee)
    company_id = current_employee.company_id

    today = date.today()
    period_start = datetime.combine(start or today.replace(day=1), datetime.min.time()).replace(tzinfo=timezone.utc)
    period_end = datetime.combine(end or today, datetime.max.time()).replace(tzinfo=timezone.utc)

    query = (
        select(AttendanceRecord)
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(
            Employee.company_id == company_id,
            AttendanceRecord.recorded_at >= period_start,
            AttendanceRecord.recorded_at <= period_end,
        )
    )
    if employee_id:
        query = query.where(AttendanceRecord.employee_id == employee_id)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one() or 0

    records_result = await db.execute(
        query.order_by(AttendanceRecord.recorded_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    records = list(records_result.scalars().all())

    # Enriquecer com nomes dos funcionários
    emp_repo = EmployeeRepository(db)
    emp_cache: dict[uuid.UUID, str] = {}
    responses = []
    for r in records:
        if r.employee_id not in emp_cache:
            emp = await emp_repo.get_by_id(r.employee_id)
            emp_cache[r.employee_id] = emp.full_name if emp else "—"
        resp = AttendanceResponse.model_validate(r)
        resp.employee_name = emp_cache[r.employee_id]
        responses.append(resp)

    return AttendanceListResponse(items=responses, total=total)

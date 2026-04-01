import structlog
from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EmployeeNotFoundError, InvalidDeviceTokenError
from app.core.security import create_access_token, create_refresh_token, hash_token, verify_password
from app.domain.employees.repository import EmployeeRepository
from app.infrastructure.database import get_db

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
log = structlog.get_logger(__name__)


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Autenticação via email + senha.
    Retorna access token (15min) + refresh token (7 dias).
    """
    repo = EmployeeRepository(db)
    employee = await repo.get_by_email(form_data.username, company_id=None)  # type: ignore[arg-type]

    # Busca por email sem company_id — ajustar para multi-tenant se necessário
    if not employee:
        # Busca global por email
        from sqlalchemy import select
        from app.domain.employees.models import Employee
        result = await db.execute(
            select(Employee).where(
                Employee.email == form_data.username,
                Employee.is_active.is_(True),
                Employee.deleted_at.is_(None),
            ).limit(1)
        )
        employee = result.scalar_one_or_none()

    if not employee or not employee.password_hash:
        raise InvalidDeviceTokenError("Credenciais inválidas.")

    if not verify_password(form_data.password, employee.password_hash):
        log.warning("auth.login.failed", email=form_data.username, ip=request.client.host if request.client else "unknown")
        raise InvalidDeviceTokenError("Credenciais inválidas.")

    access_token = create_access_token(
        subject=str(employee.id),
        extra_claims={"role": employee.role.value, "company_id": str(employee.company_id)},
    )
    raw_refresh, expires_at = create_refresh_token(str(employee.id))

    # TODO: persistir hash do refresh token no banco para rotação
    log.info("auth.login.success", employee_id=str(employee.id))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 15 * 60,
        "employee": {
            "id": str(employee.id),
            "full_name": employee.full_name,
            "role": employee.role.value,
            "company_id": str(employee.company_id),
        },
    }


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh_token(request: Request) -> dict:
    """
    Renova access token via refresh token.
    TODO: implementar rotação de refresh token com persistência no banco.
    """
    # Implementação completa na próxima iteração
    raise NotImplementedError("Refresh token rotation — próxima sprint")

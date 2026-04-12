import structlog
from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EmployeeNotFoundError, InvalidCredentialsError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
    verify_password,
)
from app.domain.auth.repository import RefreshTokenRepository
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
    Persiste hash do refresh token no banco para rotação segura.
    """
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
        log.warning("auth.login.invalid_email", email=form_data.username)
        raise InvalidCredentialsError()

    if not verify_password(form_data.password, employee.password_hash):
        log.warning(
            "auth.login.wrong_password",
            employee_id=str(employee.id),
            ip=request.client.host if request.client else "unknown",
        )
        raise InvalidCredentialsError()

    access_token = create_access_token(
        subject=str(employee.id),
        extra_claims={"role": employee.role.value, "company_id": str(employee.company_id)},
    )
    raw_refresh, expires_at = create_refresh_token(str(employee.id))

    # Persiste hash — nunca o token raw
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    await RefreshTokenRepository(db).create(
        employee_id=employee.id,
        token_hash=hash_token(raw_refresh),
        expires_at=expires_at,
        ip_address=ip,
        user_agent=ua[:255] if ua else None,
    )

    log.info("auth.login.success", employee_id=str(employee.id))

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": 15 * 60,
        "must_change_password": employee.must_change_password,
        "employee": {
            "id": str(employee.id),
            "full_name": employee.full_name,
            "role": employee.role.value,
            "company_id": str(employee.company_id),
        },
    }


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh_token(
    request: Request,
    x_refresh_token: str = Header(..., alias="X-Refresh-Token"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Renova access token via refresh token com rotação.

    - Valida hash no banco (não revogado, não expirado)
    - Revoga token antigo imediatamente
    - Emite novo par (access + refresh)
    """
    from sqlalchemy import select
    from app.domain.employees.models import Employee
    from app.core.exceptions import InvalidCredentialsError

    repo = RefreshTokenRepository(db)
    token_hash = hash_token(x_refresh_token)
    stored = await repo.get_valid(token_hash)

    if not stored:
        log.warning("auth.refresh.invalid_token", ip=request.client.host if request.client else "unknown")
        raise InvalidCredentialsError("Refresh token inválido ou expirado.")

    # Buscar funcionário
    result = await db.execute(
        select(Employee).where(
            Employee.id == stored.employee_id,
            Employee.is_active.is_(True),
        ).limit(1)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise InvalidCredentialsError("Funcionário não encontrado ou inativo.")

    # Revogar token atual (rotação)
    await repo.revoke(token_hash)

    # Emitir novos tokens
    access_token = create_access_token(
        subject=str(employee.id),
        extra_claims={"role": employee.role.value, "company_id": str(employee.company_id)},
    )
    raw_refresh, expires_at = create_refresh_token(str(employee.id))
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    await repo.create(
        employee_id=employee.id,
        token_hash=hash_token(raw_refresh),
        expires_at=expires_at,
        ip_address=ip,
        user_agent=ua[:255] if ua else None,
    )

    log.info("auth.refresh.success", employee_id=str(employee.id))

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": 15 * 60,
    }


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def change_password(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Troca a senha do funcionário autenticado.
    Obrigatório no primeiro login (must_change_password=true).
    """
    from pydantic import BaseModel
    from app.core.security import hash_password, decode_access_token
    from app.domain.employees.repository import EmployeeRepository
    from fastapi import HTTPException
    import uuid

    class ChangePasswordRequest(BaseModel):
        current_password: str
        new_password: str

    body = ChangePasswordRequest.model_validate(await request.json())

    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Nova senha deve ter mínimo 8 caracteres.")

    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    employee_id = uuid.UUID(payload["sub"])

    repo = EmployeeRepository(db)
    employee = await repo.get_by_id(employee_id)
    if not employee or not employee.is_active:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")

    if not verify_password(body.current_password, employee.password_hash or ""):
        raise HTTPException(status_code=400, detail={"code": "WRONG_PASSWORD", "message": "Senha atual incorreta."})

    employee.password_hash = hash_password(body.new_password)
    employee.must_change_password = False
    await db.commit()
    log.info("auth.password_changed", employee_id=str(employee.id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def logout(
    request: Request,
    x_refresh_token: str = Header(..., alias="X-Refresh-Token"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Encerra sessão revogando o refresh token.
    Access token expira naturalmente em 15min.
    """
    await RefreshTokenRepository(db).revoke(hash_token(x_refresh_token))
    log.info("auth.logout", ip=request.client.host if request.client else "unknown")

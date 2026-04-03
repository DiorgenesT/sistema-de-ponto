"""
Dependências injetáveis do FastAPI.
Todas as rotas devem usar estas dependências — nunca reimplementar a lógica aqui.
"""

from collections.abc import AsyncGenerator
from typing import Annotated

import jwt
import structlog
from fastapi import Depends, Header, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InsufficientPermissionsError,
    InvalidDeviceTokenError,
    UnauthorizedDeviceError,
)
from app.core.security import decode_access_token, hash_token
from app.infrastructure.database import get_db

log = structlog.get_logger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ---- Banco de dados --------------------------------------------------------

DBSession = Annotated[AsyncSession, Depends(get_db)]


# ---- Autenticação JWT ------------------------------------------------------

async def get_current_employee(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DBSession,
) -> "Employee":  # type: ignore[name-defined]  # noqa: F821
    """
    Valida JWT e retorna Employee autenticado.

    Raises:
        InvalidDeviceTokenError: token inválido ou expirado.
        EmployeeNotFoundError: funcionário não encontrado.
    """
    from app.domain.employees.repository import EmployeeRepository
    from app.core.exceptions import EmployeeNotFoundError

    try:
        payload = decode_access_token(token)
        employee_id: str = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise InvalidDeviceTokenError("Token de acesso expirado.")
    except jwt.InvalidTokenError:
        raise InvalidDeviceTokenError("Token de acesso inválido.")

    repo = EmployeeRepository(db)
    employee = await repo.get_by_id(employee_id)
    if not employee:
        raise EmployeeNotFoundError()
    return employee


CurrentEmployee = Annotated["Employee", Depends(get_current_employee)]  # type: ignore[name-defined]  # noqa: F821


# ---- RBAC ------------------------------------------------------------------

async def require_manager(
    employee: CurrentEmployee,
) -> "Employee":  # type: ignore[name-defined]  # noqa: F821
    from app.domain.employees.models import EmployeeRole
    if employee.role not in (EmployeeRole.MANAGER, EmployeeRole.ADMIN, EmployeeRole.SUPER_ADMIN):
        raise InsufficientPermissionsError("Requer perfil MANAGER ou superior.")
    return employee


async def require_admin(
    employee: CurrentEmployee,
) -> "Employee":  # type: ignore[name-defined]  # noqa: F821
    from app.domain.employees.models import EmployeeRole
    if employee.role not in (EmployeeRole.ADMIN, EmployeeRole.SUPER_ADMIN):
        raise InsufficientPermissionsError("Requer perfil ADMIN ou superior.")
    return employee


async def require_super_admin(
    employee: CurrentEmployee,
) -> "Employee":  # type: ignore[name-defined]  # noqa: F821
    from app.domain.employees.models import EmployeeRole
    if employee.role != EmployeeRole.SUPER_ADMIN:
        raise InsufficientPermissionsError("Requer perfil SUPER_ADMIN.")
    return employee


# ---- Dispositivo autorizado ------------------------------------------------

async def require_authorized_device(
    request: Request,
    x_device_token: Annotated[str, Header(alias="X-Device-Token")],
    db: DBSession,
) -> "AuthorizedDevice":  # type: ignore[name-defined]  # noqa: F821
    """
    Valida dispositivo via token + IP whitelist.
    Deve ser usado em TODAS as rotas de registro de ponto.

    Raises:
        InvalidDeviceTokenError: token não encontrado ou inativo.
        UnauthorizedDeviceError: IP não autorizado para o dispositivo.
    """
    from app.domain.devices.repository import DeviceRepository
    import ipaddress

    token_hash = hash_token(x_device_token)
    repo = DeviceRepository(db)
    device = await repo.get_active_by_token_hash(token_hash)

    if not device:
        log.warning(
            "device.auth.token_not_found",
            token_prefix=x_device_token[:8] + "...",
            ip=request.client.host if request.client else "unknown",
        )
        raise InvalidDeviceTokenError()

    # Validação de IP whitelist — pulada se ranges vazio ou contém 0.0.0.0/0 (allow-all)
    if device.ip_ranges and "0.0.0.0/0" not in device.ip_ranges:
        client_ip = request.client.host if request.client else ""
        authorized = False
        for cidr in device.ip_ranges:
            try:
                if ipaddress.ip_address(client_ip) in ipaddress.ip_network(cidr, strict=False):
                    authorized = True
                    break
            except ValueError:
                continue

        if not authorized:
            log.warning(
                "device.auth.ip_rejected",
                device_id=str(device.id),
                client_ip=client_ip,
                authorized_ranges=device.ip_ranges,
            )
            raise UnauthorizedDeviceError(f"IP {client_ip} não autorizado para este dispositivo.")

    await repo.update_last_seen(device.id)
    return device


AuthorizedDevice = Annotated["AuthorizedDevice", Depends(require_authorized_device)]  # type: ignore[name-defined]  # noqa: F821

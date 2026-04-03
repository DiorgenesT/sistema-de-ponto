import uuid

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.api.deps import CurrentEmployee, DBSession, require_admin
from app.core.security import hash_token
from app.domain.devices.repository import DeviceRepository
from app.domain.devices.schemas import DeviceCreateRequest, DeviceOnboardResponse, DeviceResponse
from app.domain.devices.service import DeviceService

router = APIRouter()


class DeviceVerifyRequest(BaseModel):
    fingerprint: str


@router.post("/verify", response_model=DeviceResponse)
async def verify_device(
    body: DeviceVerifyRequest,
    db: DBSession,
    x_device_token: str = Header(..., alias="X-Device-Token"),
) -> DeviceResponse:
    """
    Verifica se o token de dispositivo é válido e atualiza last_seen_at.
    Chamado pelo frontend antes de liberar o terminal de ponto.
    """
    token_hash = hash_token(x_device_token)
    repo = DeviceRepository(db)
    device = await repo.get_active_by_token_hash(token_hash)
    if not device:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou dispositivo não autorizado.")
    await repo.update_last_seen(device.id)
    return DeviceResponse.model_validate(device)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DeviceOnboardResponse)
async def onboard_device(
    body: DeviceCreateRequest,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> DeviceOnboardResponse:
    """
    Registra novo dispositivo autorizado.
    O token raw é retornado UMA ÚNICA VEZ — salvar em arquivo local seguro.
    Requer ADMIN.
    """
    await require_admin(current_employee)
    svc = DeviceService(DeviceRepository(db))
    device, raw_token = await svc.onboard(body, created_by_id=current_employee.id)
    return DeviceOnboardResponse(
        device=DeviceResponse.model_validate(device),
        token=raw_token,
    )


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    db: DBSession,
    current_employee: CurrentEmployee,
) -> list[DeviceResponse]:
    """Lista dispositivos da empresa. Requer ADMIN."""
    await require_admin(current_employee)
    repo = DeviceRepository(db)
    devices = await repo.list_by_company(current_employee.company_id)
    return [DeviceResponse.model_validate(d) for d in devices]


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_device(
    device_id: uuid.UUID,
    db: DBSession,
    current_employee: CurrentEmployee,
) -> None:
    """Desativa dispositivo autorizado. Requer ADMIN."""
    await require_admin(current_employee)
    svc = DeviceService(DeviceRepository(db))
    await svc.deactivate(device_id, deactivated_by=current_employee.id)

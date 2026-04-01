import uuid

import structlog

from app.core.ntp import get_current_time
from app.core.security import generate_token, hash_token
from app.domain.devices.models import AuthorizedDevice
from app.domain.devices.repository import DeviceRepository
from app.domain.devices.schemas import DeviceCreateRequest

log = structlog.get_logger(__name__)


class DeviceService:
    def __init__(self, repository: DeviceRepository) -> None:
        self._repo = repository

    async def onboard(
        self,
        data: DeviceCreateRequest,
        created_by_id: uuid.UUID,
    ) -> tuple[AuthorizedDevice, str]:
        """
        Registra novo dispositivo autorizado.

        Returns:
            Tuple (device, raw_token) — raw_token exibido UMA vez ao admin.
            Armazenar apenas o hash no banco.
        """
        raw_token = generate_token(32)
        token_hash = hash_token(raw_token)
        now = get_current_time()

        device = AuthorizedDevice(
            company_id=data.company_id,
            token_hash=token_hash,
            label=data.label,
            ip_ranges=data.ip_ranges,
            is_active=True,
            created_by=created_by_id,
            created_at=now,
        )
        device = await self._repo.create(device)

        log.info(
            "device.onboarded",
            device_id=str(device.id),
            label=data.label,
            company_id=str(data.company_id),
            created_by=str(created_by_id),
        )
        return device, raw_token

    async def deactivate(self, device_id: uuid.UUID, deactivated_by: uuid.UUID) -> None:
        """
        Desativa dispositivo autorizado.

        Raises:
            DeviceNotFoundError: Dispositivo não encontrado.
        """
        device = await self._repo.get_by_id(device_id)
        if not device:
            from app.domain.devices.exceptions import DeviceNotFoundError
            raise DeviceNotFoundError()

        await self._repo.deactivate(device)
        log.info("device.deactivated", device_id=str(device_id), by=str(deactivated_by))

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.devices.models import AuthorizedDevice, DeviceAccessLog


class DeviceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_active_by_token_hash(self, token_hash: str) -> AuthorizedDevice | None:
        """Busca dispositivo ativo pelo hash do token."""
        result = await self._db.execute(
            select(AuthorizedDevice).where(
                AuthorizedDevice.token_hash == token_hash,
                AuthorizedDevice.is_active.is_(True),
                AuthorizedDevice.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, device_id: uuid.UUID) -> AuthorizedDevice | None:
        """Busca dispositivo por ID."""
        result = await self._db.execute(
            select(AuthorizedDevice).where(
                AuthorizedDevice.id == device_id,
                AuthorizedDevice.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[AuthorizedDevice]:
        """Lista todos os dispositivos da empresa."""
        result = await self._db.execute(
            select(AuthorizedDevice).where(
                AuthorizedDevice.company_id == company_id,
                AuthorizedDevice.deleted_at.is_(None),
            ).order_by(AuthorizedDevice.label)
        )
        return list(result.scalars().all())

    async def create(self, device: AuthorizedDevice) -> AuthorizedDevice:
        """Persiste novo dispositivo autorizado."""
        self._db.add(device)
        await self._db.flush()
        await self._db.refresh(device)
        return device

    async def update_last_seen(self, device_id: uuid.UUID) -> None:
        """Atualiza timestamp de último acesso visto."""
        device = await self.get_by_id(device_id)
        if device:
            device.last_seen_at = datetime.now(timezone.utc)
            await self._db.flush()

    async def deactivate(self, device: AuthorizedDevice) -> None:
        """Desativa dispositivo."""
        device.is_active = False
        device.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()

    async def log_access(self, log_entry: DeviceAccessLog) -> None:
        """Registra tentativa de acesso (autorizada ou não)."""
        self._db.add(log_entry)
        await self._db.flush()

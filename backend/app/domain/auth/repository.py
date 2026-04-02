import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ntp import get_current_time
from app.domain.auth.models import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        employee_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> RefreshToken:
        """Persiste hash do refresh token."""
        now = get_current_time()
        token = RefreshToken(
            employee_id=employee_id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_revoked=False,
            created_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._db.add(token)
        await self._db.flush()
        return token

    async def get_valid(self, token_hash: str) -> RefreshToken | None:
        """Retorna token válido (não revogado e não expirado)."""
        now = get_current_time()
        result = await self._db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.is_revoked.is_(False),
                RefreshToken.expires_at > now,
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, token_hash: str) -> None:
        """Revoga token específico (rotação: invalidar token antigo ao emitir novo)."""
        now = get_current_time()
        await self._db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(is_revoked=True, revoked_at=now)
        )

    async def revoke_all_for_employee(self, employee_id: uuid.UUID) -> int:
        """Revoga todos os tokens do funcionário (ex: logout completo, troca de senha)."""
        now = get_current_time()
        result = await self._db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.employee_id == employee_id,
                RefreshToken.is_revoked.is_(False),
            )
            .values(is_revoked=True, revoked_at=now)
        )
        return result.rowcount  # type: ignore[return-value]

"""
Sincronização NTP — exigência da Portaria 671/2021.

NUNCA usar datetime.now() para registros de ponto.
Sempre usar get_ntp_time() ou get_current_time() deste módulo.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

import ntplib
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_ntp_offset_seconds: float = 0.0
_last_sync_at: Optional[datetime] = None


def _sync_ntp_blocking() -> float:
    """Consulta o servidor NTP e retorna o offset em segundos (bloqueante)."""
    client = ntplib.NTPClient()
    response = client.request(settings.NTP_SERVER, version=3, timeout=5)
    return float(response.offset)


async def sync_ntp() -> None:
    """Sincroniza com o servidor NTP de forma assíncrona."""
    global _ntp_offset_seconds, _last_sync_at

    try:
        offset = await asyncio.get_event_loop().run_in_executor(None, _sync_ntp_blocking)
        _ntp_offset_seconds = offset
        _last_sync_at = datetime.now(timezone.utc)
        log.info("ntp.sync.success", server=settings.NTP_SERVER, offset_ms=round(offset * 1000, 2))
    except Exception as exc:
        log.error("ntp.sync.failed", server=settings.NTP_SERVER, error=str(exc))
        # Não sobrescreve o offset anterior em caso de falha
        raise


def get_current_time() -> datetime:
    """
    Retorna o timestamp atual corrigido pelo offset NTP.

    Returns:
        datetime UTC sincronizado com servidor NTP autorizado.
    """
    raw = datetime.now(timezone.utc)
    from datetime import timedelta
    return raw + timedelta(seconds=_ntp_offset_seconds)


def is_synced() -> bool:
    """Retorna True se o NTP foi sincronizado ao menos uma vez."""
    return _last_sync_at is not None


def get_last_sync() -> Optional[datetime]:
    """Retorna o timestamp da última sincronização NTP bem-sucedida."""
    return _last_sync_at

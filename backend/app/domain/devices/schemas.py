import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DeviceCreateRequest(BaseModel):
    company_id: uuid.UUID
    label: str = Field(..., min_length=2, max_length=100, description="Ex: Recepção - PC 01")
    ip_ranges: list[str] = Field(..., min_length=1, description="Lista de CIDRs autorizados. Ex: ['192.168.1.0/24']")


class DeviceResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    label: str
    ip_ranges: list[str]
    is_active: bool
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceOnboardResponse(BaseModel):
    """Retornado apenas na criação — token raw nunca mais será visível."""
    device: DeviceResponse
    token: str = Field(..., description="Token do dispositivo — salvar em arquivo local seguro")

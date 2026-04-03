import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.attendance.models import RecordType


class AttendanceCreateRequest(BaseModel):
    employee_id: uuid.UUID | None = Field(
        None,
        description="ID do funcionário. Se omitido, o terminal faz identificação 1:N por reconhecimento facial.",
    )
    image_b64: str = Field(..., description="Frame capturado pelo terminal em base64")
    device_fingerprint: str | None = Field(None, description="Fingerprint do dispositivo para validação terciária")


class AttendanceAdjustmentRequest(BaseModel):
    employee_id: uuid.UUID
    original_record_id: uuid.UUID
    corrected_time: datetime
    reason: str = Field(..., min_length=10, max_length=500)
    record_type: RecordType


class AttendanceResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    device_id: uuid.UUID
    recorded_at: datetime
    record_type: RecordType
    facial_confidence: float
    is_adjustment: bool
    original_record_id: uuid.UUID | None
    created_at: datetime
    employee_name: str | None = None  # preenchido na rota para exibição no terminal

    model_config = {"from_attributes": True}


class AttendanceListResponse(BaseModel):
    items: list[AttendanceResponse]
    total: int

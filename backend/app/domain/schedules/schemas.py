import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, Field

from app.domain.schedules.models import ScheduleType


class ScheduleExceptionCreate(BaseModel):
    exception_date: date
    is_holiday: bool = False
    is_day_off: bool = False
    override_start: time | None = None
    override_end: time | None = None
    description: str | None = Field(None, max_length=255)


class WorkScheduleCreateRequest(BaseModel):
    company_id: uuid.UUID
    name: str = Field(..., min_length=2, max_length=100)
    schedule_type: ScheduleType
    default_start: time | None = None
    default_end: time | None = None
    daily_minutes: int = Field(480, ge=60, le=720, description="Minutos de trabalho por dia (60–720)")
    workdays_mask: int = Field(31, ge=1, le=127, description="Bitmask dias úteis (padrão: seg–sex = 31)")
    description: str | None = None
    exceptions: list[ScheduleExceptionCreate] = Field(default_factory=list)


class WorkScheduleUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    default_start: time | None = None
    default_end: time | None = None
    daily_minutes: int | None = Field(None, ge=60, le=720)
    workdays_mask: int | None = Field(None, ge=1, le=127)
    description: str | None = None
    is_active: bool | None = None


class ScheduleExceptionResponse(BaseModel):
    id: uuid.UUID
    schedule_id: uuid.UUID
    exception_date: date
    is_holiday: bool
    is_day_off: bool
    override_start: time | None
    override_end: time | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkScheduleResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    schedule_type: ScheduleType
    default_start: time | None
    default_end: time | None
    daily_minutes: int
    workdays_mask: int
    description: str | None
    is_active: bool
    created_at: datetime
    exceptions: list[ScheduleExceptionResponse] = []

    model_config = {"from_attributes": True}

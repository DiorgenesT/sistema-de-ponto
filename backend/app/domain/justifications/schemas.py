import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.domain.justifications.models import JustificationStatus, JustificationType


class JustificationCreateRequest(BaseModel):
    attendance_record_id: uuid.UUID | None = None
    justification_type: JustificationType
    reference_date: date
    description: str = Field(..., min_length=10, max_length=1000)


class JustificationReviewRequest(BaseModel):
    status: JustificationStatus = Field(..., description="APPROVED ou REJECTED")
    review_notes: str | None = Field(None, max_length=500)


class JustificationResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    attendance_record_id: uuid.UUID | None
    justification_type: JustificationType
    reference_date: date
    description: str
    status: JustificationStatus
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    review_notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

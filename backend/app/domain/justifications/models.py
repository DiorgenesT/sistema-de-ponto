import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, Enum, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class JustificationType(str, enum.Enum):
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    MEDICAL_CERTIFICATE = "MEDICAL_CERTIFICATE"
    ABSENCE = "ABSENCE"
    OTHER = "OTHER"


class JustificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Justification(Base):
    __tablename__ = "justifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    attendance_record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_records.id"), nullable=True)
    justification_type: Mapped[JustificationType] = mapped_column(
        Enum(JustificationType, name="justification_type", create_constraint=False), nullable=False
    )
    reference_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[JustificationStatus] = mapped_column(
        Enum(JustificationStatus, name="justification_status", create_constraint=False),
        nullable=False,
        default=JustificationStatus.PENDING,
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

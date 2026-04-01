import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


class RecordType(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("authorized_devices.id", ondelete="RESTRICT"), nullable=False)
    # Timestamp NTP — NUNCA datetime.now() ou timestamp do cliente (Portaria 671)
    recorded_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    record_type: Mapped[RecordType] = mapped_column(Enum(RecordType, name="record_type", create_constraint=False), nullable=False)
    facial_confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    audit_photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Campos de ajuste (imutabilidade via novo registro)
    is_adjustment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    original_record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_records.id"), nullable=True)
    adjustment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

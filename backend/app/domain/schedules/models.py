import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text, Time, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


class ScheduleType(str, enum.Enum):
    FIXED = "FIXED"        # horário fixo (ex: 08:00–17:00)
    VARIABLE = "VARIABLE"  # horário variável por dia
    SHIFT_12X36 = "12X36"  # 12h de trabalho, 36h de folga


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    schedule_type: Mapped[ScheduleType] = mapped_column(
        Enum(ScheduleType, name="schedule_type", create_constraint=False), nullable=False
    )
    # Para FIXED e 12X36: horários padrão de todos os dias
    default_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    default_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Minutos de trabalho esperados por dia (calculado a partir de start/end ou manual)
    daily_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=480)
    # Semana de trabalho: bitmask 1=seg, 2=ter, 4=qua, 8=qui, 16=sex, 32=sab, 64=dom
    workdays_mask: Mapped[int] = mapped_column(Integer, nullable=False, default=31)  # seg-sex
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    exceptions: Mapped[list["ScheduleException"]] = relationship(
        "ScheduleException", back_populates="schedule", cascade="all, delete-orphan"
    )


class ScheduleException(Base):
    """Exceções pontuais à escala: feriados, folgas programadas, banco de horas."""

    __tablename__ = "schedule_exceptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_schedules.id", ondelete="CASCADE"), nullable=False
    )
    exception_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_day_off: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    override_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    override_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

    schedule: Mapped["WorkSchedule"] = relationship("WorkSchedule", back_populates="exceptions")

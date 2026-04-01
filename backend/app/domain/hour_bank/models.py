import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class HourBankEntry(Base):
    __tablename__ = "hour_bank_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    reference_date: Mapped[date] = mapped_column(Date, nullable=False)
    worked_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    extra_minutes_50pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extra_minutes_100pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    intrajornada_discounted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_holiday: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calculated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class HourBankBalance(Base):
    __tablename__ = "hour_bank_balance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    balance_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    alerted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

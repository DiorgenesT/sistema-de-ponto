import uuid
from datetime import date, datetime

from pydantic import BaseModel


class HourBankEntryResponse(BaseModel):
    id: uuid.UUID
    reference_date: date
    worked_minutes: int
    expected_minutes: int
    balance_minutes: int
    extra_minutes_50pct: int
    extra_minutes_100pct: int
    intrajornada_discounted: int
    is_holiday: bool
    calculated_at: datetime

    model_config = {"from_attributes": True}


class HourBankBalanceResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    period_start: date
    period_end: date
    balance_minutes: int
    balance_hours: float
    expires_at: date | None
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, model: "HourBankBalance") -> "HourBankBalanceResponse":  # type: ignore[name-defined]  # noqa: F821
        return cls(
            id=model.id,
            employee_id=model.employee_id,
            period_start=model.period_start,
            period_end=model.period_end,
            balance_minutes=model.balance_minutes,
            balance_hours=round(model.balance_minutes / 60, 2),
            expires_at=model.expires_at,
            updated_at=model.updated_at,
        )


class HourBankSummaryResponse(BaseModel):
    employee_id: uuid.UUID
    total_balance_minutes: int
    total_balance_hours: float
    entries: list[HourBankEntryResponse]
    balances: list[HourBankBalanceResponse]

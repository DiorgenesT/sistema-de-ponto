"""
Testes unitários do calculador de banco de horas.
Foco: regras CLT e Portaria 671/2021.
"""

import uuid
from datetime import date, datetime, timezone

import pytest

from app.domain.attendance.models import AttendanceRecord, RecordType
from app.domain.hour_bank.calculator import (
    STANDARD_DAILY_MINUTES,
    calculate_day,
    _apply_tolerance,
    _calculate_intrajornada_discount,
    _calculate_worked_minutes,
)


def make_record(record_type: RecordType, hour: int, minute: int = 0) -> AttendanceRecord:
    """Helper para criar registros de teste."""
    from unittest.mock import MagicMock
    record = MagicMock(spec=AttendanceRecord)
    record.id = uuid.uuid4()
    record.employee_id = uuid.uuid4()
    record.device_id = uuid.uuid4()
    record.recorded_at = datetime(2026, 3, 31, hour, minute, 0, tzinfo=timezone.utc)
    record.record_type = record_type
    record.facial_confidence = 0.95
    record.ip_address = "127.0.0.1"
    record.is_adjustment = False
    record.original_record_id = None
    record.created_at = datetime(2026, 3, 31, hour, minute, 0, tzinfo=timezone.utc)
    return record


class TestCalculateWorkedMinutes:
    def test_single_pair_8h(self):
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 17, 0),
        ]
        # 9h bruto - mas com almoço fora do cálculo
        assert _calculate_worked_minutes(records) == 9 * 60

    def test_two_pairs_with_lunch(self):
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 12, 0),
            make_record(RecordType.IN, 13, 0),
            make_record(RecordType.OUT, 17, 0),
        ]
        assert _calculate_worked_minutes(records) == 8 * 60

    def test_no_records_returns_zero(self):
        assert _calculate_worked_minutes([]) == 0


class TestIntrajornada:
    def test_no_discount_for_short_journey(self):
        """Jornadas <= 6h não exigem intervalo."""
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 14, 0),
        ]
        discount = _calculate_intrajornada_discount(records, 6 * 60)
        assert discount == 0

    def test_discount_when_no_break_in_long_journey(self):
        """Jornada > 6h sem intervalo: descontar 60 min."""
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 17, 0),
        ]
        discount = _calculate_intrajornada_discount(records, 9 * 60)
        assert discount == 60

    def test_no_discount_when_sufficient_break(self):
        """Jornada > 6h com 1h de intervalo: sem desconto."""
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 12, 0),
            make_record(RecordType.IN, 13, 0),
            make_record(RecordType.OUT, 17, 0),
        ]
        discount = _calculate_intrajornada_discount(records, 8 * 60)
        assert discount == 0

    def test_partial_discount_for_short_break(self):
        """Intervalo de 30min em jornada > 6h: descontar 30min."""
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 12, 0),
            make_record(RecordType.IN, 12, 30),
            make_record(RecordType.OUT, 17, 0),
        ]
        discount = _calculate_intrajornada_discount(records, 8 * 60 + 30)
        assert discount == 30


class TestTolerance:
    def test_within_tolerance_treated_as_full_day(self):
        """5 min de atraso: dentro da tolerância — jornada completa."""
        worked = STANDARD_DAILY_MINUTES - 5
        result = _apply_tolerance(worked, STANDARD_DAILY_MINUTES)
        assert result == STANDARD_DAILY_MINUTES

    def test_10min_tolerance_treated_as_full_day(self):
        """10 min de atraso: no limite da tolerância — jornada completa."""
        worked = STANDARD_DAILY_MINUTES - 10
        result = _apply_tolerance(worked, STANDARD_DAILY_MINUTES)
        assert result == STANDARD_DAILY_MINUTES

    def test_11min_not_tolerated(self):
        """11 min de atraso: fora da tolerância — debitar."""
        worked = STANDARD_DAILY_MINUTES - 11
        result = _apply_tolerance(worked, STANDARD_DAILY_MINUTES)
        assert result == STANDARD_DAILY_MINUTES - 11


class TestCalculateDay:
    def test_standard_8h_day(self):
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 12, 0),
            make_record(RecordType.IN, 13, 0),
            make_record(RecordType.OUT, 17, 0),
        ]
        result = calculate_day(records, date(2026, 3, 31))
        assert result.worked_minutes == 8 * 60
        assert result.balance_minutes == 0
        assert result.extra_minutes_50pct == 0
        assert result.extra_minutes_100pct == 0

    def test_overtime_weekday_50pct(self):
        """2h extras em dia útil → 50%."""
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 12, 0),
            make_record(RecordType.IN, 13, 0),
            make_record(RecordType.OUT, 19, 0),  # 2h a mais
        ]
        result = calculate_day(records, date(2026, 3, 31))
        assert result.extra_minutes_50pct == 2 * 60
        assert result.extra_minutes_100pct == 0

    def test_overtime_sunday_100pct(self):
        """1h extra no domingo → 100%. 8:00-12:00 + 13:00-18:00 = 9h - 8h padrão = 1h extra."""
        sunday = date(2026, 3, 29)  # domingo
        records = [
            make_record(RecordType.IN, 8, 0),
            make_record(RecordType.OUT, 12, 0),
            make_record(RecordType.IN, 13, 0),
            make_record(RecordType.OUT, 18, 0),
        ]
        result = calculate_day(records, sunday)
        assert result.extra_minutes_100pct == 60
        assert result.extra_minutes_50pct == 0

    def test_no_records_full_debit(self):
        """Sem registros: débito de jornada completa."""
        result = calculate_day([], date(2026, 3, 31))
        assert result.balance_minutes == -STANDARD_DAILY_MINUTES
        assert result.worked_minutes == 0

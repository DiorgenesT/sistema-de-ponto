"""
Testes unitários do AttendanceService.
Foco: registro de ponto, alternância IN/OUT, tolerância por marcação.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.attendance.models import AttendanceRecord, RecordType
from app.domain.attendance.service import AttendanceService


def _make_record(record_type: RecordType, dt: datetime | None = None) -> AttendanceRecord:
    record = MagicMock(spec=AttendanceRecord)
    record.id = uuid.uuid4()
    record.employee_id = uuid.uuid4()
    record.device_id = uuid.uuid4()
    record.recorded_at = dt or datetime(2026, 4, 1, 8, 0, 0, tzinfo=timezone.utc)
    record.record_type = record_type
    record.facial_confidence = 0.92
    record.ip_address = "127.0.0.1"
    record.is_adjustment = False
    record.original_record_id = None
    record.created_at = record.recorded_at
    return record


def _make_device() -> MagicMock:
    device = MagicMock()
    device.id = uuid.uuid4()
    return device


@pytest.fixture
def mock_attendance_repo():
    repo = AsyncMock()
    repo.create = AsyncMock(side_effect=lambda r: r)
    repo.get_last_for_employee_today = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_facial_service():
    svc = AsyncMock()
    svc.verify_identity = AsyncMock(return_value=0.92)
    return svc


@pytest.fixture
def service(mock_attendance_repo, mock_facial_service):
    return AttendanceService(mock_attendance_repo, mock_facial_service)


class TestDetermineRecordType:
    def test_first_record_of_day_is_in(self):
        assert AttendanceService._determine_record_type(None) == RecordType.IN

    def test_after_out_is_in(self):
        last = _make_record(RecordType.OUT)
        assert AttendanceService._determine_record_type(last) == RecordType.IN

    def test_after_in_is_out(self):
        last = _make_record(RecordType.IN)
        assert AttendanceService._determine_record_type(last) == RecordType.OUT


class TestApplyPerRecordTolerance:
    def test_rounds_down_when_seconds_within_tolerance(self):
        """08:00:03 → arredonda para 08:00:00 (3s dentro dos 5min de tolerância)."""
        dt = datetime(2026, 4, 1, 8, 0, 3, tzinfo=timezone.utc)
        result = AttendanceService._apply_per_record_tolerance(dt, None, RecordType.IN)
        assert result.second == 0
        assert result.microsecond == 0

    def test_rounds_up_when_near_next_minute(self):
        """17:59:58 → arredonda para 18:00:00 (2s do próximo minuto, dentro dos 5min)."""
        dt = datetime(2026, 4, 1, 17, 59, 58, tzinfo=timezone.utc)
        result = AttendanceService._apply_per_record_tolerance(dt, None, RecordType.OUT)
        assert result.hour == 18
        assert result.minute == 0
        assert result.second == 0

    def test_no_rounding_when_outside_tolerance(self):
        """08:00:45 → mantém como está (45s fora da janela de tolerância por segundo)."""
        dt = datetime(2026, 4, 1, 8, 0, 45, tzinfo=timezone.utc)
        result = AttendanceService._apply_per_record_tolerance(dt, None, RecordType.IN)
        assert result == dt


class TestRegister:
    @pytest.mark.asyncio
    async def test_registers_first_record_as_in(
        self, service, mock_attendance_repo, mock_facial_service
    ):
        employee_id = uuid.uuid4()
        device = _make_device()
        mock_attendance_repo.get_last_for_employee_today.return_value = None

        with patch("app.domain.attendance.service.get_current_time") as mock_time:
            mock_time.return_value = datetime(2026, 4, 1, 8, 0, 0, tzinfo=timezone.utc)
            record = await service.register(
                employee_id=employee_id,
                image_b64="base64data",
                device=device,
                ip_address="127.0.0.1",
            )

        assert record.record_type == RecordType.IN
        assert record.employee_id == employee_id
        assert record.facial_confidence == pytest.approx(0.92)
        mock_facial_service.verify_identity.assert_called_once_with(employee_id, "base64data")

    @pytest.mark.asyncio
    async def test_alternates_to_out_after_in(
        self, service, mock_attendance_repo
    ):
        last_in = _make_record(RecordType.IN)
        mock_attendance_repo.get_last_for_employee_today.return_value = last_in

        with patch("app.domain.attendance.service.get_current_time") as mock_time:
            mock_time.return_value = datetime(2026, 4, 1, 17, 0, 0, tzinfo=timezone.utc)
            record = await service.register(
                employee_id=last_in.employee_id,
                image_b64="base64data",
                device=_make_device(),
                ip_address="127.0.0.1",
            )

        assert record.record_type == RecordType.OUT

    @pytest.mark.asyncio
    async def test_facial_failure_prevents_registration(
        self, service, mock_facial_service, mock_attendance_repo
    ):
        from app.core.exceptions import FacialVerificationError

        mock_facial_service.verify_identity.side_effect = FacialVerificationError()

        with pytest.raises(FacialVerificationError):
            await service.register(
                employee_id=uuid.uuid4(),
                image_b64="base64data",
                device=_make_device(),
                ip_address="127.0.0.1",
            )

        mock_attendance_repo.create.assert_not_called()

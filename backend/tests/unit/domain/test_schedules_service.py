"""
Testes unitários do ScheduleService.
"""

import uuid
from datetime import date, time
from unittest.mock import AsyncMock

import pytest

from app.domain.schedules.exceptions import ScheduleInUseError, ScheduleNotFoundError
from app.domain.schedules.models import ScheduleType, WorkSchedule
from app.domain.schedules.service import ScheduleService


def _make_schedule(**kwargs):  # type: ignore[no-untyped-def]
    from datetime import datetime, timezone
    from unittest.mock import MagicMock
    now = datetime.now(timezone.utc)
    schedule = MagicMock(spec=WorkSchedule)
    schedule.id = uuid.uuid4()
    schedule.company_id = uuid.uuid4()
    schedule.name = "Jornada Padrão"
    schedule.schedule_type = ScheduleType.FIXED
    schedule.default_start = time(8, 0)
    schedule.default_end = time(17, 0)
    schedule.daily_minutes = 480
    schedule.workdays_mask = 31  # seg–sex
    schedule.description = None
    schedule.is_active = True
    schedule.exceptions = []
    schedule.created_by = uuid.uuid4()
    schedule.created_at = now
    schedule.updated_at = now
    schedule.deleted_at = None
    for k, v in kwargs.items():
        setattr(schedule, k, v)
    return schedule


@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=None)
    repo.count_employees_with_schedule = AsyncMock(return_value=0)
    repo.get_exception_for_date = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def service(mock_repo):
    return ScheduleService(mock_repo)


class TestGetForDate:
    @pytest.mark.asyncio
    async def test_weekday_is_workday(self, service, mock_repo):
        """Segunda-feira (weekday=0, bit=1) com mask 31 é dia útil."""
        schedule = _make_schedule(daily_minutes=480, workdays_mask=31)
        mock_repo.get_by_id.return_value = schedule

        result = await service.get_for_date(schedule.id, date(2026, 3, 30))  # segunda

        assert result["is_workday"] is True
        assert result["expected_minutes"] == 480

    @pytest.mark.asyncio
    async def test_saturday_not_in_workdays(self, service, mock_repo):
        """Sábado (weekday=5, bit=32) com mask 31 não é dia útil."""
        schedule = _make_schedule(workdays_mask=31)
        mock_repo.get_by_id.return_value = schedule

        result = await service.get_for_date(schedule.id, date(2026, 4, 4))  # sábado

        assert result["is_workday"] is False
        assert result["expected_minutes"] == 0

    @pytest.mark.asyncio
    async def test_sunday_is_holiday(self, service, mock_repo):
        """Domingo sempre retorna is_holiday=True."""
        schedule = _make_schedule(workdays_mask=127)  # todos os dias
        mock_repo.get_by_id.return_value = schedule

        result = await service.get_for_date(schedule.id, date(2026, 3, 29))  # domingo

        assert result["is_holiday"] is True

    @pytest.mark.asyncio
    async def test_holiday_exception_returns_day_off(self, service, mock_repo):
        """Exceção de feriado retorna is_workday=False."""
        from app.domain.schedules.models import ScheduleException

        schedule = _make_schedule()
        mock_repo.get_by_id.return_value = schedule

        from unittest.mock import MagicMock
        exception = MagicMock(spec=ScheduleException)
        exception.is_holiday = True
        exception.is_day_off = False
        exception.override_start = None
        exception.override_end = None
        mock_repo.get_exception_for_date.return_value = exception

        result = await service.get_for_date(schedule.id, date(2026, 4, 21))  # Tiradentes

        assert result["is_workday"] is False
        assert result["is_holiday"] is True

    @pytest.mark.asyncio
    async def test_schedule_not_found_raises(self, service, mock_repo):
        mock_repo.get_by_id.return_value = None
        with pytest.raises(ScheduleNotFoundError):
            await service.get_for_date(uuid.uuid4(), date(2026, 4, 1))


class TestUpdate:
    @pytest.mark.asyncio
    async def test_deactivate_with_employees_raises(self, service, mock_repo):
        """Não pode desativar escala com funcionários vinculados."""
        from app.domain.schedules.schemas import WorkScheduleUpdateRequest

        schedule = _make_schedule()
        mock_repo.get_by_id.return_value = schedule
        mock_repo.count_employees_with_schedule.return_value = 3

        with pytest.raises(ScheduleInUseError):
            await service.update(
                schedule.id,
                WorkScheduleUpdateRequest(is_active=False),
                updated_by_id=uuid.uuid4(),
            )

    @pytest.mark.asyncio
    async def test_update_name(self, service, mock_repo):
        from app.domain.schedules.schemas import WorkScheduleUpdateRequest

        schedule = _make_schedule()
        mock_repo.get_by_id.return_value = schedule

        updated = await service.update(
            schedule.id,
            WorkScheduleUpdateRequest(name="Nova Jornada"),
            updated_by_id=uuid.uuid4(),
        )

        assert updated.name == "Nova Jornada"

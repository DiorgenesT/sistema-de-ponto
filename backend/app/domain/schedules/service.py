import uuid
from datetime import date, datetime, timezone

import structlog

from app.core.ntp import get_current_time
from app.domain.schedules.exceptions import ScheduleInUseError, ScheduleNotFoundError
from app.domain.schedules.models import ScheduleException, ScheduleType, WorkSchedule
from app.domain.schedules.repository import ScheduleRepository
from app.domain.schedules.schemas import WorkScheduleCreateRequest, WorkScheduleUpdateRequest

log = structlog.get_logger(__name__)


class ScheduleService:
    def __init__(self, repo: ScheduleRepository) -> None:
        self._repo = repo

    async def create(
        self,
        body: WorkScheduleCreateRequest,
        created_by_id: uuid.UUID,
    ) -> WorkSchedule:
        """
        Cria escala de trabalho com exceções opcionais.

        Args:
            body: Dados da escala.
            created_by_id: ID do admin que criou.

        Returns:
            WorkSchedule criado.
        """
        now = get_current_time()
        schedule = WorkSchedule(
            company_id=body.company_id,
            name=body.name,
            schedule_type=body.schedule_type,
            default_start=body.default_start,
            default_end=body.default_end,
            daily_minutes=body.daily_minutes,
            workdays_mask=body.workdays_mask,
            description=body.description,
            created_by=created_by_id,
            created_at=now,
            updated_at=now,
        )
        schedule = await self._repo.create(schedule)

        for exc in body.exceptions:
            exception = ScheduleException(
                schedule_id=schedule.id,
                exception_date=exc.exception_date,
                is_holiday=exc.is_holiday,
                is_day_off=exc.is_day_off,
                override_start=exc.override_start,
                override_end=exc.override_end,
                description=exc.description,
                created_at=now,
            )
            self._repo._db.add(exception)

        log.info("schedule.created", schedule_id=str(schedule.id), name=schedule.name)
        return schedule

    async def update(
        self,
        schedule_id: uuid.UUID,
        body: WorkScheduleUpdateRequest,
        updated_by_id: uuid.UUID,
    ) -> WorkSchedule:
        """
        Atualiza escala de trabalho.

        Raises:
            ScheduleNotFoundError: Escala não existe.
            ScheduleInUseError: Tentativa de desativar escala com funcionários vinculados.
        """
        schedule = await self._repo.get_by_id(schedule_id)
        if not schedule:
            raise ScheduleNotFoundError()

        if body.is_active is False:
            count = await self._repo.count_employees_with_schedule(schedule_id)
            if count > 0:
                raise ScheduleInUseError()

        if body.name is not None:
            schedule.name = body.name
        if body.default_start is not None:
            schedule.default_start = body.default_start
        if body.default_end is not None:
            schedule.default_end = body.default_end
        if body.daily_minutes is not None:
            schedule.daily_minutes = body.daily_minutes
        if body.workdays_mask is not None:
            schedule.workdays_mask = body.workdays_mask
        if body.description is not None:
            schedule.description = body.description
        if body.is_active is not None:
            schedule.is_active = body.is_active

        schedule.updated_at = get_current_time()
        log.info("schedule.updated", schedule_id=str(schedule_id), updated_by=str(updated_by_id))
        return schedule

    async def get_for_date(
        self,
        schedule_id: uuid.UUID,
        ref_date: date,
    ) -> dict:
        """
        Retorna parâmetros efetivos da escala para uma data específica,
        considerando exceções (feriados, folgas).

        Returns:
            Dict com: is_workday, is_holiday, expected_minutes, start, end.
        """
        schedule = await self._repo.get_by_id(schedule_id)
        if not schedule:
            raise ScheduleNotFoundError()

        exception = await self._repo.get_exception_for_date(schedule_id, ref_date)

        if exception:
            if exception.is_day_off or exception.is_holiday:
                return {
                    "is_workday": False,
                    "is_holiday": exception.is_holiday,
                    "expected_minutes": 0,
                    "start": None,
                    "end": None,
                }
            # Exceção com horário override
            start = exception.override_start or schedule.default_start
            end = exception.override_end or schedule.default_end
        else:
            # Verificar se é dia útil pelo bitmask
            weekday_bit = 1 << ref_date.weekday()  # seg=1, ter=2, ... dom=64
            if not (schedule.workdays_mask & weekday_bit):
                return {
                    "is_workday": False,
                    "is_holiday": False,
                    "expected_minutes": 0,
                    "start": None,
                    "end": None,
                }
            start = schedule.default_start
            end = schedule.default_end

        is_sunday = ref_date.weekday() == 6
        return {
            "is_workday": True,
            "is_holiday": (exception.is_holiday if exception else False) or is_sunday,
            "expected_minutes": schedule.daily_minutes,
            "start": start,
            "end": end,
        }

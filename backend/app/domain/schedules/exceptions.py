from app.core.exceptions import DomainException


class ScheduleNotFoundError(DomainException):
    def __init__(self) -> None:
        super().__init__("Escala de trabalho não encontrada.", code="SCHEDULE_NOT_FOUND")


class ScheduleInUseError(DomainException):
    def __init__(self) -> None:
        super().__init__(
            "Escala está em uso por funcionários ativos e não pode ser desativada.",
            code="SCHEDULE_IN_USE",
        )

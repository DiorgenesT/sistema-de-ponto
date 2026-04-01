from fastapi import status

from app.core.exceptions import DomainException


class InvalidRecordSequenceError(DomainException):
    http_status = status.HTTP_409_CONFLICT

    def __init__(self, message: str = "Sequência de ponto inválida (IN/OUT alternância).") -> None:
        super().__init__(message, "INVALID_RECORD_SEQUENCE")


class AttendanceRecordNotFoundError(DomainException):
    http_status = status.HTTP_404_NOT_FOUND

    def __init__(self, message: str = "Registro de ponto não encontrado.") -> None:
        super().__init__(message, "ATTENDANCE_RECORD_NOT_FOUND")

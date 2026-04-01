from fastapi import status

from app.core.exceptions import DomainException


class EmployeeAlreadyExistsError(DomainException):
    http_status = status.HTTP_409_CONFLICT

    def __init__(self, message: str = "Funcionário já cadastrado.") -> None:
        super().__init__(message, "EMPLOYEE_ALREADY_EXISTS")

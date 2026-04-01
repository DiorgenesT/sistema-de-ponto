from fastapi import status

from app.core.exceptions import DomainException


class DeviceNotFoundError(DomainException):
    http_status = status.HTTP_404_NOT_FOUND

    def __init__(self, message: str = "Dispositivo não encontrado.") -> None:
        super().__init__(message, "DEVICE_NOT_FOUND")

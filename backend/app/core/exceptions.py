from fastapi import Request, status
from fastapi.responses import JSONResponse


class DomainException(Exception):
    """Base para todas as exceções de domínio."""

    http_status: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str, code: str) -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class UnauthorizedDeviceError(DomainException):
    http_status = status.HTTP_403_FORBIDDEN

    def __init__(self, message: str = "Dispositivo não autorizado.") -> None:
        super().__init__(message, "UNAUTHORIZED_DEVICE")


class InvalidDeviceTokenError(DomainException):
    http_status = status.HTTP_401_UNAUTHORIZED

    def __init__(self, message: str = "Token de dispositivo inválido ou expirado.") -> None:
        super().__init__(message, "INVALID_DEVICE_TOKEN")


class FacialVerificationError(DomainException):
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY

    def __init__(self, message: str = "Verificação facial falhou.", similarity: float = 0.0) -> None:
        self.similarity = similarity
        super().__init__(message, "FACIAL_VERIFICATION_FAILED")


class FaceNotDetectedError(DomainException):
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY

    def __init__(self, message: str = "Nenhum rosto detectado na imagem.") -> None:
        super().__init__(message, "FACE_NOT_DETECTED")


class AttendanceAlreadyRegisteredError(DomainException):
    http_status = status.HTTP_409_CONFLICT

    def __init__(self, message: str = "Ponto já registrado neste período.") -> None:
        super().__init__(message, "ATTENDANCE_ALREADY_REGISTERED")


class EmployeeNotFoundError(DomainException):
    http_status = status.HTTP_404_NOT_FOUND

    def __init__(self, message: str = "Funcionário não encontrado.") -> None:
        super().__init__(message, "EMPLOYEE_NOT_FOUND")


class ConsentNotGrantedError(DomainException):
    http_status = status.HTTP_403_FORBIDDEN

    def __init__(self, message: str = "Consentimento LGPD não concedido para dados biométricos.") -> None:
        super().__init__(message, "CONSENT_NOT_GRANTED")


class EmbeddingNotFoundError(DomainException):
    http_status = status.HTTP_404_NOT_FOUND

    def __init__(self, message: str = "Embedding facial não cadastrado para este funcionário.") -> None:
        super().__init__(message, "EMBEDDING_NOT_FOUND")


class HourBankCalculationError(DomainException):
    http_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str = "Erro no cálculo do banco de horas.") -> None:
        super().__init__(message, "HOUR_BANK_CALCULATION_ERROR")


class NTPSyncError(DomainException):
    http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    def __init__(self, message: str = "Falha na sincronização NTP. Registro não permitido.") -> None:
        super().__init__(message, "NTP_SYNC_FAILED")


class InsufficientPermissionsError(DomainException):
    http_status = status.HTTP_403_FORBIDDEN

    def __init__(self, message: str = "Permissões insuficientes.") -> None:
        super().__init__(message, "INSUFFICIENT_PERMISSIONS")


class InvalidCredentialsError(DomainException):
    http_status = status.HTTP_401_UNAUTHORIZED

    def __init__(self, message: str = "Credenciais inválidas.") -> None:
        super().__init__(message, "INVALID_CREDENTIALS")


# --- Handler global registrado em main.py ---

async def domain_exception_handler(request: Request, exc: DomainException) -> JSONResponse:
    """Converte exceções de domínio em respostas HTTP padronizadas."""
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
    )

from fastapi import status

from app.core.exceptions import DomainException


class JustificationNotFoundError(DomainException):
    http_status = status.HTTP_404_NOT_FOUND

    def __init__(self, message: str = "Justificativa não encontrada.") -> None:
        super().__init__(message, "JUSTIFICATION_NOT_FOUND")


class JustificationAlreadyReviewedError(DomainException):
    http_status = status.HTTP_409_CONFLICT

    def __init__(self, message: str = "Justificativa já foi revisada.") -> None:
        super().__init__(message, "JUSTIFICATION_ALREADY_REVIEWED")

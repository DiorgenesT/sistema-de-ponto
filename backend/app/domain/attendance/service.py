import uuid

import structlog

from app.core.ntp import get_current_time
from app.domain.attendance.exceptions import InvalidRecordSequenceError
from app.domain.attendance.models import AttendanceRecord, RecordType
from app.domain.attendance.repository import AttendanceRepository
from app.domain.devices.models import AuthorizedDevice
from app.domain.facial.service import FacialService

log = structlog.get_logger(__name__)


class AttendanceService:
    def __init__(
        self,
        attendance_repo: AttendanceRepository,
        facial_service: FacialService,
    ) -> None:
        self._repo = attendance_repo
        self._facial = facial_service

    async def register(
        self,
        employee_id: uuid.UUID,
        image_b64: str,
        device: AuthorizedDevice,
        ip_address: str,
        audit_photo_path: str | None = None,
    ) -> AttendanceRecord:
        """
        Registra ponto com verificação facial.

        Fluxo:
        1. Verificar identidade facial
        2. Determinar tipo (IN/OUT) pela alternância
        3. Persistir registro imutável com timestamp NTP

        Args:
            employee_id: ID do funcionário.
            image_b64: Frame do terminal em base64.
            device: Dispositivo autorizado já validado pelo dep. inject.
            ip_address: IP do cliente.
            audit_photo_path: Path da foto de auditoria no Supabase Storage.

        Returns:
            AttendanceRecord criado.

        Raises:
            FacialVerificationError: Rosto não reconhecido.
            FaceNotDetectedError: Sem rosto na imagem.
        """
        # 1. Verificação facial (lança exceção se falhar)
        confidence = await self._facial.verify_identity(employee_id, image_b64)

        # 2. Determinar tipo IN/OUT pela alternância
        now = get_current_time()
        last_record = await self._repo.get_last_for_employee_today(employee_id, now.date())
        record_type = self._determine_record_type(last_record)

        # 3. Criar registro imutável
        record = AttendanceRecord(
            employee_id=employee_id,
            device_id=device.id,
            recorded_at=now,       # timestamp NTP — nunca datetime.now()
            record_type=record_type,
            facial_confidence=round(confidence, 4),
            ip_address=ip_address,
            audit_photo_path=audit_photo_path,
            is_adjustment=False,
            created_at=now,
        )

        record = await self._repo.create(record)

        log.info(
            "attendance.registered",
            employee_id=str(employee_id),
            record_type=record_type.value,
            device_id=str(device.id),
            facial_confidence=round(confidence, 4),
        )
        return record

    async def create_adjustment(
        self,
        original_record_id: uuid.UUID,
        corrected_time: "datetime",
        reason: str,
        record_type: RecordType,
        approved_by: uuid.UUID,
        device: AuthorizedDevice,
        ip_address: str,
    ) -> AttendanceRecord:
        """
        Cria ajuste de ponto referenciando o registro original.
        Não modifica o registro original — imutabilidade garantida.

        Returns:
            Novo AttendanceRecord com is_adjustment=True.

        Raises:
            AttendanceRecordNotFoundError: Registro original não encontrado.
        """
        from app.domain.attendance.exceptions import AttendanceRecordNotFoundError
        from datetime import datetime

        original = await self._repo.get_by_id(original_record_id)
        if not original:
            raise AttendanceRecordNotFoundError()

        now = get_current_time()
        adjustment = AttendanceRecord(
            employee_id=original.employee_id,
            device_id=device.id,
            recorded_at=corrected_time,
            record_type=record_type,
            facial_confidence=0.0,    # ajuste manual — sem verificação facial
            ip_address=ip_address,
            is_adjustment=True,
            original_record_id=original_record_id,
            adjustment_reason=reason,
            approved_by=approved_by,
            approved_at=now,
            created_at=now,
        )

        adjustment = await self._repo.create(adjustment)
        log.info(
            "attendance.adjustment.created",
            adjustment_id=str(adjustment.id),
            original_id=str(original_record_id),
            approved_by=str(approved_by),
        )
        return adjustment

    @staticmethod
    def _determine_record_type(last_record: AttendanceRecord | None) -> RecordType:
        """Alterna IN/OUT com base no último registro do dia."""
        if last_record is None or last_record.record_type == RecordType.OUT:
            return RecordType.IN
        return RecordType.OUT

import uuid
from datetime import timedelta

import structlog

from app.core.ntp import get_current_time
from app.domain.attendance.exceptions import InvalidRecordSequenceError
from app.domain.attendance.models import AttendanceRecord, RecordType
from app.domain.attendance.repository import AttendanceRepository
from app.domain.devices.models import AuthorizedDevice
from app.domain.facial.service import FacialService
from app.domain.hour_bank.calculator import TOLERANCE_PER_RECORD_MINUTES

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
        employee_id: uuid.UUID | None,
        image_b64: str,
        device: AuthorizedDevice,
        ip_address: str,
        audit_photo_path: str | None = None,
    ) -> AttendanceRecord:
        """
        Registra ponto com verificação facial.

        Fluxo:
        1. Identificar/verificar identidade facial
        2. Determinar tipo (IN/OUT) pela alternância
        3. Persistir registro imutável com timestamp NTP

        Args:
            employee_id: ID do funcionário. Se None, faz identificação 1:N pelo rosto.
            image_b64: Frame do terminal em base64.
            device: Dispositivo autorizado já validado pelo dep. inject.
            ip_address: IP do cliente.
            audit_photo_path: Path da foto de auditoria no Supabase Storage.

        Returns:
            AttendanceRecord criado.

        Raises:
            FacialVerificationError: Rosto não reconhecido.
            FaceNotDetectedError: Sem rosto na imagem.
            EmbeddingNotFoundError: Sem embeddings cadastrados.
        """
        # 1. Identificação ou verificação facial
        if employee_id is None:
            # Modo terminal quiosque: identificação 1:N
            employee_id, confidence = await self._facial.identify(image_b64, device.company_id)
        else:
            # Modo verificação 1:1 (ajuste manual / portal do funcionário)
            confidence = await self._facial.verify_identity(employee_id, image_b64)

        # 2. Determinar tipo IN/OUT pela alternância
        now = get_current_time()
        last_record = await self._repo.get_last_for_employee_today(employee_id, now.date())
        record_type = self._determine_record_type(last_record)

        # 3. Aplicar tolerância por marcação (Art. 74 §1º CLT)
        # Se o funcionário bateu até TOLERANCE_PER_RECORD_MINUTES min após o horário
        # exato de início/fim de jornada, arredondar para o horário programado.
        recorded_at = self._apply_per_record_tolerance(now, last_record, record_type)

        # 4. Criar registro imutável
        record = AttendanceRecord(
            employee_id=employee_id,
            device_id=device.id,
            recorded_at=recorded_at,   # timestamp NTP com tolerância aplicada
            record_type=record_type,
            facial_confidence=round(confidence, 4),
            ip_address=ip_address,
            audit_photo_path=audit_photo_path,
            is_adjustment=False,
            created_at=now,
        )

        record = await self._repo.create(record)

        tolerance_applied = recorded_at != now
        log.info(
            "attendance.registered",
            employee_id=str(employee_id),
            record_type=record_type.value,
            device_id=str(device.id),
            facial_confidence=round(confidence, 4),
            tolerance_applied=tolerance_applied,
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

    @staticmethod
    def _apply_per_record_tolerance(
        now: "datetime",
        last_record: AttendanceRecord | None,
        record_type: RecordType,
    ) -> "datetime":
        """
        Aplica tolerância de 5 min por marcação (Art. 74 §1º CLT).

        Se o funcionário bater ponto até 5 min antes ou depois de uma marcação
        anterior que implique horário exato, arredonda para o minuto exato.
        Na prática: se a marcação ocorrer dentro de 5 min de um horário cheio
        (ex: 08:03 → arredonda para 08:00; 17:57 → arredonda para 18:00).

        A tolerância arredonda para o minuto mais próximo dentro da janela,
        favorecendo o registro fiel quando não há horário de referência explícito.
        Para aplicação completa contra a escala (expected_minutes), o calculator
        de banco de horas já aplica a tolerância diária acumulada de 10 min.
        """
        from datetime import datetime

        # Arredonda para o minuto exato mais próximo dentro da janela de tolerância
        # Compara os segundos (0-59) contra o limiar em segundos
        seconds = now.second + now.microsecond / 1e6
        threshold = TOLERANCE_PER_RECORD_MINUTES  # tolerância em segundos dentro do minuto
        if seconds <= threshold:
            # Bate logo após o horário cheio — arredonda para baixo
            return now.replace(second=0, microsecond=0)
        elif seconds >= 60 - threshold:
            # Bate logo antes do próximo minuto cheio — arredonda para cima
            return (now + timedelta(seconds=60 - seconds)).replace(microsecond=0)

        return now

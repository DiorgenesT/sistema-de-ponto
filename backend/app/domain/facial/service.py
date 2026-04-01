import uuid
from datetime import datetime

import structlog

from app.core.exceptions import EmbeddingNotFoundError
from app.core.ntp import get_current_time
from app.domain.employees.repository import EmployeeRepository
from app.domain.employees.service import EmployeeService
from app.domain.facial.encryption import decrypt_embedding, encrypt_embedding
from app.domain.facial.encoder import extract_embedding_from_b64, MODEL_NAME
from app.domain.facial.models import FacialEmbedding
from app.domain.facial.repository import FacialRepository
from app.domain.facial.verifier import verify

log = structlog.get_logger(__name__)


class FacialService:
    def __init__(
        self,
        facial_repo: FacialRepository,
        employee_service: EmployeeService,
    ) -> None:
        self._facial_repo = facial_repo
        self._employee_service = employee_service

    async def enroll(
        self,
        employee_id: uuid.UUID,
        image_b64: str,
        enrolled_by_id: uuid.UUID,
    ) -> FacialEmbedding:
        """
        Cadastra embedding facial para funcionário.

        Pré-condição: consentimento LGPD deve estar ativo.

        Args:
            employee_id: ID do funcionário.
            image_b64: Imagem de cadastro em base64.
            enrolled_by_id: Admin responsável pelo cadastro.

        Returns:
            FacialEmbedding persistido (sem embedding descriptografado).

        Raises:
            ConsentNotGrantedError: Sem consentimento LGPD ativo.
            FaceNotDetectedError: Nenhum rosto detectado.
        """
        # Verificar consentimento antes de qualquer processamento biométrico
        await self._employee_service.verify_consent_active(employee_id)

        embedding = extract_embedding_from_b64(image_b64)
        ciphertext, iv = encrypt_embedding(embedding)

        # Desativar embedding anterior se existir
        existing = await self._facial_repo.get_active_by_employee(employee_id)
        if existing:
            await self._facial_repo.deactivate(existing)

        record = FacialEmbedding(
            employee_id=employee_id,
            embedding_encrypted=ciphertext,
            iv=iv,
            model_name=MODEL_NAME,
            enrolled_by=enrolled_by_id,
            enrolled_at=get_current_time(),
            is_active=True,
        )
        record = await self._facial_repo.create(record)

        # Não logar nada relacionado ao embedding — LGPD
        log.info("facial.enrolled", employee_id=str(employee_id), enrolled_by=str(enrolled_by_id))
        return record

    async def verify_identity(
        self,
        employee_id: uuid.UUID,
        probe_image_b64: str,
    ) -> float:
        """
        Verifica identidade do funcionário via reconhecimento facial.

        Args:
            employee_id: ID do funcionário a verificar.
            probe_image_b64: Frame capturado pelo terminal em base64.

        Returns:
            Score de confiança (0.0–1.0).

        Raises:
            EmbeddingNotFoundError: Funcionário sem embedding cadastrado.
            FaceNotDetectedError: Nenhum rosto na imagem de prova.
            FacialVerificationError: Rosto não pertence ao funcionário.
        """
        embedding_record = await self._facial_repo.get_active_by_employee(employee_id)
        if not embedding_record:
            raise EmbeddingNotFoundError()

        probe = extract_embedding_from_b64(probe_image_b64)

        # Descriptografar apenas para comparação — descartar imediatamente
        gallery = decrypt_embedding(embedding_record.embedding_encrypted, embedding_record.iv)
        score = verify(probe, gallery)
        del gallery  # descartar explicitamente

        log.info("facial.verified", employee_id=str(employee_id), confidence=round(score, 4))
        return score

    async def delete_biometric_data(self, employee_id: uuid.UUID) -> None:
        """
        Exclui dados biométricos do funcionário (Art. 18 LGPD).

        Args:
            employee_id: ID do funcionário.
        """
        await self._facial_repo.delete_all_for_employee(employee_id)
        log.info("facial.biometric_data_deleted", employee_id=str(employee_id))

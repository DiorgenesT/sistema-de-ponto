"""
Extração de embeddings faciais via DeepFace.
Roda no backend — nunca expor embeddings ao frontend.
"""

import base64
import io
from typing import Any

import numpy as np
import structlog

log = structlog.get_logger(__name__)

# Import lazy — DeepFace carrega TensorFlow que leva ~10s e não é necessário em testes unitários
def _get_deepface():  # type: ignore[no-untyped-def]
    from deepface import DeepFace
    return DeepFace

MODEL_NAME = "ArcFace"
DETECTOR_BACKEND = "retinaface"


def extract_embedding_from_b64(image_b64: str) -> list[float]:
    """
    Extrai embedding facial de imagem base64.

    Args:
        image_b64: Imagem em base64 (JPEG ou PNG).

    Returns:
        Vetor de embedding normalizado.

    Raises:
        FaceNotDetectedError: Nenhum rosto detectado na imagem.
        FacialVerificationError: Erro no processamento.
    """
    from app.core.exceptions import FaceNotDetectedError

    try:
        image_bytes = base64.b64decode(image_b64)
        img_array = _bytes_to_array(image_bytes)

        result = _get_deepface().represent(
            img_path=img_array,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True,
        )

        if not result:
            raise FaceNotDetectedError()

        embedding: list[float] = result[0]["embedding"]
        # Normalizar L2
        arr = np.array(embedding)
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        return arr.tolist()

    except ValueError as exc:
        raise FaceNotDetectedError(str(exc)) from exc
    except Exception as exc:
        # Não logar a imagem — dados biométricos
        log.error("facial.encoder.failed", model=MODEL_NAME, error=type(exc).__name__)
        raise


def _bytes_to_array(image_bytes: bytes) -> Any:
    """Converte bytes de imagem para array numpy via OpenCV."""
    import cv2
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        from app.core.exceptions import FaceNotDetectedError
        raise FaceNotDetectedError("Imagem inválida ou corrompida.")
    return img

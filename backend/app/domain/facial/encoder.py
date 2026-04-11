"""
Extração de embeddings faciais via InsightFace + ONNX Runtime.
Roda no backend — nunca expor embeddings ao frontend.
"""

import base64
from typing import Any

import cv2
import numpy as np
import structlog

log = structlog.get_logger(__name__)

MODEL_NAME = "buffalo_l"

_face_app: Any = None


def _get_face_app() -> Any:
    """Retorna instância singleton do FaceAnalysis (lazy init)."""
    global _face_app
    if _face_app is None:
        from insightface.app import FaceAnalysis  # noqa: PLC0415
        _face_app = FaceAnalysis(
            name=MODEL_NAME,
            providers=["CPUExecutionProvider"],
            allowed_modules=["detection", "recognition"],
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


def extract_embedding_from_b64(image_b64: str) -> list[float]:
    """
    Extrai embedding facial de imagem base64.

    Args:
        image_b64: Imagem em base64 (JPEG ou PNG).

    Returns:
        Vetor de embedding normalizado (L2).

    Raises:
        FaceNotDetectedError: Nenhum rosto detectado na imagem.
    """
    from app.core.exceptions import FaceNotDetectedError  # noqa: PLC0415

    try:
        image_bytes = base64.b64decode(image_b64)
        img = _bytes_to_array(image_bytes)

        app = _get_face_app()
        faces = app.get(img)

        if not faces:
            raise FaceNotDetectedError()

        # Usar o rosto com maior área de bounding box (imagem mais próxima da câmera)
        largest = max(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
        )

        # normed_embedding já vem normalizado L2 pelo InsightFace
        embedding: list[float] = largest.normed_embedding.tolist()
        return embedding

    except FaceNotDetectedError:
        raise
    except Exception as exc:
        log.error("facial.encoder.failed", model=MODEL_NAME, error=type(exc).__name__)
        raise


def _bytes_to_array(image_bytes: bytes) -> Any:
    """Converte bytes de imagem para array numpy via OpenCV."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        from app.core.exceptions import FaceNotDetectedError  # noqa: PLC0415
        raise FaceNotDetectedError("Imagem inválida ou corrompida.")
    return img

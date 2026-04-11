"""
Extração de embeddings faciais via OpenCV FaceDetectorYN + FaceRecognizerSF.

Modelos ONNX leves embutidos na imagem Docker:
  - face_detection_yunet_2023mar.onnx  (~400 KB)  — detecção
  - face_recognition_sface_2021dec.onnx (~38 MB)  — embedding SFace 128-dim

Sem TensorFlow, sem PyTorch, sem compilação.
"""

import base64
import os
from typing import Any

import cv2
import numpy as np
import structlog

log = structlog.get_logger(__name__)

MODEL_NAME = "SFace"

_MODELS_DIR = os.environ.get("MODELS_DIR", "/app/models")
_DETECTOR_PATH = os.path.join(_MODELS_DIR, "face_detection_yunet_2023mar.onnx")
_RECOGNIZER_PATH = os.path.join(_MODELS_DIR, "face_recognition_sface_2021dec.onnx")

_detector: Any = None
_recognizer: Any = None


def _get_detector() -> Any:
    global _detector
    if _detector is None:
        _detector = cv2.FaceDetectorYN.create(_DETECTOR_PATH, "", (320, 320))
    return _detector


def _get_recognizer() -> Any:
    global _recognizer
    if _recognizer is None:
        _recognizer = cv2.FaceRecognizerSF.create(_RECOGNIZER_PATH, "")
    return _recognizer


def extract_embedding_from_b64(image_b64: str) -> list[float]:
    """
    Extrai embedding facial de imagem base64.

    Args:
        image_b64: Imagem em base64 (JPEG ou PNG).

    Returns:
        Vetor de embedding normalizado L2 (128 dimensões).

    Raises:
        FaceNotDetectedError: Nenhum rosto detectado na imagem.
    """
    from app.core.exceptions import FaceNotDetectedError  # noqa: PLC0415

    try:
        image_bytes = base64.b64decode(image_b64)
        img = _bytes_to_array(image_bytes)

        h, w = img.shape[:2]
        detector = _get_detector()
        detector.setInputSize((w, h))
        _, faces = detector.detect(img)

        if faces is None or len(faces) == 0:
            raise FaceNotDetectedError()

        # Rosto com maior score de confiança
        best_face = faces[np.argmax(faces[:, -1])]

        recognizer = _get_recognizer()
        aligned = recognizer.alignCrop(img, best_face)
        embedding: np.ndarray = recognizer.feature(aligned)

        # Normalização L2
        norm = float(np.linalg.norm(embedding))
        if norm > 0:
            embedding = embedding / norm

        return embedding.flatten().tolist()

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

"""
Comparação de embeddings faciais.
"""

import numpy as np

from app.core.config import settings
from app.core.exceptions import FacialVerificationError


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Calcula similaridade cosseno entre dois embeddings.

    Returns:
        float entre 0.0 e 1.0 (1.0 = idênticos).
    """
    va = np.array(a)
    vb = np.array(b)

    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(va, vb) / (norm_a * norm_b))


def verify(
    probe_embedding: list[float],
    gallery_embedding: list[float],
    threshold: float | None = None,
) -> float:
    """
    Verifica se dois embeddings pertencem à mesma pessoa.

    Args:
        probe_embedding: Embedding extraído da imagem atual.
        gallery_embedding: Embedding cadastrado (descriptografado).
        threshold: Limiar mínimo de similaridade (padrão: settings.FACIAL_SIMILARITY_THRESHOLD).

    Returns:
        Score de similaridade (0.0–1.0).

    Raises:
        FacialVerificationError: Similaridade abaixo do threshold.

    Note:
        gallery_embedding deve ser descartado imediatamente após uso.
        NUNCA logar, persistir ou retornar o embedding ao chamador.
    """
    min_threshold = threshold or settings.FACIAL_SIMILARITY_THRESHOLD
    score = cosine_similarity(probe_embedding, gallery_embedding)

    if score < min_threshold:
        raise FacialVerificationError(
            f"Verificação facial falhou. Similaridade: {score:.4f}",
            similarity=score,
        )

    return score

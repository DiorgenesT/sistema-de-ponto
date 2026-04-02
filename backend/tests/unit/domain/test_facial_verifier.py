"""
Testes unitários do verificador facial.
"""

import pytest

from app.core.exceptions import FacialVerificationError
from app.domain.facial.verifier import cosine_similarity, verify


class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = [1.0, 0.0, 0.0]
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_opposite_vectors(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_zero_vector_returns_zero(self):
        assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0

    def test_similar_embeddings(self):
        """Embeddings ligeiramente diferentes devem ter alta similaridade."""
        base = [0.8, 0.6, 0.0]
        similar = [0.79, 0.61, 0.01]
        score = cosine_similarity(base, similar)
        assert score > 0.99


class TestVerify:
    def test_passes_when_above_threshold(self):
        """Embeddings similares devem passar na verificação."""
        v = [1.0, 0.0, 0.0, 0.0]
        score = verify(v, v, threshold=0.75)
        assert score == pytest.approx(1.0)

    def test_raises_when_below_threshold(self):
        """Embeddings divergentes devem levantar FacialVerificationError."""
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        with pytest.raises(FacialVerificationError) as exc_info:
            verify(a, b, threshold=0.75)
        assert exc_info.value.similarity == pytest.approx(0.0, abs=0.01)

    def test_raises_at_exact_threshold_boundary(self):
        """Similaridade exatamente no threshold deve falhar (strict <)."""
        # cosine_similarity([1,0], [1,0]) = 1.0, threshold=1.01 → falha
        v = [1.0, 0.0]
        with pytest.raises(FacialVerificationError):
            verify(v, v, threshold=1.01)

    def test_custom_threshold_overrides_default(self):
        """Threshold customizado deve sobrepor o padrão de settings."""
        a = [1.0, 0.0]
        b = [0.9, 0.436]  # similaridade ~0.90
        # Com threshold 0.5 deve passar
        score = verify(a, b, threshold=0.5)
        assert score > 0.5
        # Com threshold 0.99 deve falhar
        with pytest.raises(FacialVerificationError):
            verify(a, b, threshold=0.99)

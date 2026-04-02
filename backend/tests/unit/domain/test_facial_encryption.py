"""
Testes unitários da criptografia AES-256-GCM de embeddings faciais.
"""

import base64
import os

import pytest

from app.domain.facial.encryption import decrypt_embedding, encrypt_embedding


@pytest.fixture(autouse=True)
def patch_key(monkeypatch):
    """Injeta chave AES-256 de teste via settings."""
    key = base64.b64encode(os.urandom(32)).decode()
    monkeypatch.setattr("app.domain.facial.encryption.settings", type("S", (), {"FACIAL_ENCRYPTION_KEY": key})())


class TestEncryptDecrypt:
    def test_roundtrip(self):
        """Encrypt → Decrypt deve retornar o embedding original."""
        original = [0.123, -0.456, 0.789, 0.0, 1.0]
        ciphertext, iv = encrypt_embedding(original)
        recovered = decrypt_embedding(ciphertext, iv)
        assert recovered == pytest.approx(original)

    def test_different_iv_each_call(self):
        """Cada chamada de encrypt deve gerar IV único (segurança GCM)."""
        emb = [1.0, 2.0, 3.0]
        _, iv1 = encrypt_embedding(emb)
        _, iv2 = encrypt_embedding(emb)
        assert iv1 != iv2

    def test_ciphertext_differs_with_different_iv(self):
        """Mesmo plaintext com IV diferente → ciphertext diferente."""
        emb = [1.0, 2.0]
        ct1, _ = encrypt_embedding(emb)
        ct2, _ = encrypt_embedding(emb)
        assert ct1 != ct2

    def test_tampered_ciphertext_raises(self):
        """Ciphertext modificado deve falhar na decriptação (autenticação GCM)."""
        emb = [1.0, 2.0, 3.0]
        ct, iv = encrypt_embedding(emb)
        # Modificar um byte do ciphertext
        ct_bytes = base64.b64decode(ct)
        tampered = bytearray(ct_bytes)
        tampered[0] ^= 0xFF
        tampered_b64 = base64.b64encode(bytes(tampered)).decode()
        with pytest.raises(Exception):
            decrypt_embedding(tampered_b64, iv)

    def test_wrong_iv_raises(self):
        """IV errado deve falhar na decriptação."""
        emb = [1.0, 2.0]
        ct, _ = encrypt_embedding(emb)
        wrong_iv = os.urandom(12).hex()
        with pytest.raises(Exception):
            decrypt_embedding(ct, wrong_iv)

    def test_large_embedding(self):
        """Embedding de 512 dimensões (InsightFace) deve funcionar."""
        large = [float(i) / 512 for i in range(512)]
        ct, iv = encrypt_embedding(large)
        recovered = decrypt_embedding(ct, iv)
        assert len(recovered) == 512
        assert recovered == pytest.approx(large)

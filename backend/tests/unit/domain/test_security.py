"""
Testes unitários do módulo de segurança: hashing, JWT, tokens.
"""

import time

import jwt
import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_differs_from_plain(self):
        plain = "minha_senha_segura"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_verify_correct_password(self):
        plain = "senha123"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_reject_wrong_password(self):
        hashed = hash_password("correta")
        assert verify_password("errada", hashed) is False

    def test_same_password_produces_different_hashes(self):
        """bcrypt usa salt aleatório — dois hashes da mesma senha diferem."""
        plain = "abc"
        h1 = hash_password(plain)
        h2 = hash_password(plain)
        assert h1 != h2


class TestTokenHashing:
    def test_hash_is_deterministic(self):
        """SHA-256 do mesmo token deve ser sempre igual."""
        token = "meu-token-secreto"
        assert hash_token(token) == hash_token(token)

    def test_different_tokens_different_hashes(self):
        assert hash_token("abc") != hash_token("xyz")

    def test_hash_length_is_64(self):
        """SHA-256 em hex → 64 caracteres."""
        assert len(hash_token(generate_token())) == 64


class TestGenerateToken:
    def test_tokens_are_unique(self):
        tokens = {generate_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_token_is_string(self):
        assert isinstance(generate_token(), str)


class TestJWT:
    def test_access_token_encode_decode(self):
        token = create_access_token("user-123", extra_claims={"role": "ADMIN"})
        payload = decode_access_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "ADMIN"
        assert payload["type"] == "access"

    def test_expired_token_raises(self):
        """Token com expiração no passado deve levantar erro."""
        from datetime import timedelta
        from app.core.config import settings
        from app.core.ntp import get_current_time

        now = get_current_time()
        payload = {
            "sub": "user-1",
            "iat": now,
            "exp": now - timedelta(seconds=1),
            "type": "access",
        }
        expired_token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

        with pytest.raises(jwt.ExpiredSignatureError):
            decode_access_token(expired_token)

    def test_invalid_signature_raises(self):
        token = create_access_token("user-1")
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(tampered)

    def test_refresh_token_returns_raw_and_expiry(self):
        raw, expires_at = create_refresh_token("user-123")
        assert isinstance(raw, str)
        assert len(raw) > 30
        # expires_at deve ser no futuro
        from app.core.ntp import get_current_time
        assert expires_at > get_current_time()

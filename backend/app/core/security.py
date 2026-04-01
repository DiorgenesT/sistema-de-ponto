"""
Segurança: JWT, hashing de senhas/tokens, device token.
"""

import hashlib
import secrets
from datetime import timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.ntp import get_current_time

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---- Senhas ----------------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---- Tokens genéricos (device token, refresh token) -----------------------

def generate_token(nbytes: int = 32) -> str:
    """Gera token URL-safe seguro."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """SHA-256 do token — armazenar somente o hash no banco."""
    return hashlib.sha256(token.encode()).hexdigest()


# ---- JWT -------------------------------------------------------------------

def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    now = get_current_time()
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> tuple[str, Any]:
    """
    Retorna (token_raw, expires_at).
    Armazenar apenas hash_token(token_raw) no banco.
    """
    now = get_current_time()
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token = generate_token(48)
    return token, expire


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decodifica e valida JWT.

    Raises:
        jwt.ExpiredSignatureError: token expirado.
        jwt.InvalidTokenError: token inválido.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

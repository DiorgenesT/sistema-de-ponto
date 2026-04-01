"""
Criptografia AES-256-GCM para embeddings faciais.

REGRA CRÍTICA (CLAUDE.md): embeddings NUNCA saem descriptografados
deste módulo. Dados biométricos não trafegam em logs.
"""

import base64
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _get_key() -> bytes:
    """Decodifica a chave AES-256 da variável de ambiente."""
    return base64.b64decode(settings.FACIAL_ENCRYPTION_KEY)


def encrypt_embedding(embedding: list[float]) -> tuple[str, str]:
    """
    Criptografa embedding com AES-256-GCM.

    Args:
        embedding: Vetor de floats do modelo facial.

    Returns:
        Tuple (ciphertext_b64, iv_hex) — ambos prontos para persistência.
    """
    key = _get_key()
    iv = os.urandom(12)  # 96-bit nonce recomendado para GCM
    aesgcm = AESGCM(key)

    plaintext = json.dumps(embedding).encode()
    ciphertext = aesgcm.encrypt(iv, plaintext, None)

    return base64.b64encode(ciphertext).decode(), iv.hex()


def decrypt_embedding(ciphertext_b64: str, iv_hex: str) -> list[float]:
    """
    Descriptografa embedding.

    Args:
        ciphertext_b64: Ciphertext em base64.
        iv_hex: Nonce em hex.

    Returns:
        Vetor de floats do embedding.

    Note:
        Retorno deve ser usado imediatamente para comparação.
        NUNCA logar, serializar ou persistir o resultado.
    """
    key = _get_key()
    iv = bytes.fromhex(iv_hex)
    aesgcm = AESGCM(key)

    ciphertext = base64.b64decode(ciphertext_b64)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)

    result: list[float] = json.loads(plaintext)
    return result

import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.exceptions import DomainException, domain_exception_handler
from app.core.logging import setup_logging
from app.core.ntp import sync_ntp
from app.infrastructure.redis import close_redis

log = structlog.get_logger(__name__)

# ---- Sentry ----------------------------------------------------------------

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,
    )


# ---- Lifespan --------------------------------------------------------------

def _validate_h5(path: str) -> bool:
    """Retorna True se o arquivo .h5 é válido e legível."""
    import os
    if not os.path.exists(path):
        return False
    try:
        import h5py
        with h5py.File(path, "r"):
            return True
    except Exception:
        return False


def _purge_invalid_weights() -> None:
    """Remove arquivos .h5 corrompidos/incompletos do diretório de pesos."""
    import os
    weights_dir = os.path.expanduser("~/.deepface/weights")
    for fname in ("arcface_weights.h5", "retinaface_resnet50.h5"):
        fpath = os.path.join(weights_dir, fname)
        if os.path.exists(fpath) and not _validate_h5(fpath):
            os.remove(fpath)
            log.warning("deepface.weights.invalid_removed", file=fname)


def _try_represent() -> None:
    """Aciona download e carregamento do ArcFace (detector_backend=skip)."""
    import numpy as np
    from deepface import DeepFace
    dummy = np.zeros((112, 112, 3), dtype=np.uint8)
    DeepFace.represent(
        img_path=dummy,
        model_name="ArcFace",
        detector_backend="skip",
        enforce_detection=False,
    )


def _try_retinaface() -> None:
    """Aciona download e carregamento do RetinaFace — usado na extração real de embeddings."""
    import numpy as np
    from deepface import DeepFace
    dummy = np.zeros((224, 224, 3), dtype=np.uint8)
    DeepFace.extract_faces(
        img_path=dummy,
        detector_backend="retinaface",
        enforce_detection=False,
    )


async def _warmup_deepface() -> None:
    """
    Pré-aquece ArcFace e RetinaFace garantindo que os pesos sejam válidos.

    Loop de retry com até 5 tentativas por modelo:
      1. Remove arquivos .h5 inválidos/corrompidos
      2. Chama DeepFace que aciona o download se necessário
      3. Após falha, remove arquivo corrompido gerado nesta tentativa antes de retry
    """
    import asyncio

    MAX_ATTEMPTS = 5

    async def _warmup_model(name: str, fn: object) -> None:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            await asyncio.to_thread(_purge_invalid_weights)
            try:
                await asyncio.to_thread(fn)  # type: ignore[arg-type]
                log.info("deepface.warmup.model_ok", model=name, attempt=attempt)
                return
            except Exception as exc:
                log.warning(
                    "deepface.warmup.attempt_failed",
                    model=name,
                    attempt=attempt,
                    max_attempts=MAX_ATTEMPTS,
                    error=str(exc),
                )
                await asyncio.to_thread(_purge_invalid_weights)
                if attempt < MAX_ATTEMPTS:
                    await asyncio.sleep(15 * attempt)
        log.error("deepface.warmup.exhausted", model=name, max_attempts=MAX_ATTEMPTS)

    await _warmup_model("ArcFace", _try_represent)
    await _warmup_model("RetinaFace", _try_retinaface)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    log.info("app.starting", environment=settings.ENVIRONMENT)

    # Sincronização NTP (Portaria 671) — falha não impede inicialização pois
    # ambientes cloud (Railway) mantêm clock sincronizado via NTP no OS
    try:
        await sync_ntp()
    except Exception as exc:
        log.warning("ntp.initial_sync_failed", error=str(exc), fallback="system_clock")

    # Warmup em background — não bloqueia o lifespan para o health check responder
    # imediatamente. O primeiro request facial pode chegar antes do warmup terminar,
    # mas o próprio endpoint trata falhas de carregamento do modelo.
    import asyncio
    asyncio.create_task(_warmup_deepface())

    log.info("app.ready")
    yield

    await close_redis()
    log.info("app.shutdown")


# ---- App -------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Sistema de Ponto Eletrônico",
    description="API de controle de ponto com reconhecimento facial — Portaria 671/2021",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
app.add_exception_handler(DomainException, domain_exception_handler)  # type: ignore[arg-type]

# ---- CORS ------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


# ---- Middleware de Request ID ----------------------------------------------

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    request_id = str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---- Health checks ---------------------------------------------------------

@app.get("/health", tags=["health"])
async def health_check() -> dict:
    import asyncio
    from app.core.ntp import is_synced, get_last_sync
    from app.infrastructure.redis import get_redis
    from app.infrastructure.database import engine
    from sqlalchemy import text

    # DB
    db_status = "ok"
    try:
        async def _check_db() -> None:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        await asyncio.wait_for(_check_db(), timeout=5.0)
    except Exception:
        db_status = "error"

    # Redis
    redis_status = "ok"
    try:
        async def _check_redis() -> None:
            r = await get_redis()
            await r.ping()
        await asyncio.wait_for(_check_redis(), timeout=5.0)
    except Exception:
        redis_status = "error"

    return {
        "status": "ok" if db_status == "ok" and redis_status == "ok" else "degraded",
        "db": db_status,
        "redis": redis_status,
        "ntp": "synced" if is_synced() else "not_synced",
        "ntp_last_sync": get_last_sync().isoformat() if get_last_sync() else None,
    }


@app.get("/health/ready", tags=["health"])
async def readiness() -> dict:
    return {"ready": True}


@app.get("/health/live", tags=["health"])
async def liveness() -> dict:
    return {"live": True}


# ---- Rotas -----------------------------------------------------------------

from app.api.v1.router import router as v1_router  # noqa: E402

app.include_router(v1_router, prefix="/api/v1")

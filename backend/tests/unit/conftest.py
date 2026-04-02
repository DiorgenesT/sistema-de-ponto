"""
Conftest para testes unitários.
Configura env vars e inicializa os mappers SQLAlchemy sem carregar o app completo.
"""

import os

import pytest

# Variáveis de ambiente mínimas — antes de qualquer import de app
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-64-chars-long-please-make-it-long")
os.environ.setdefault("FACIAL_ENCRYPTION_KEY", "dGVzdC1rZXktMzItYnl0ZXMtYWVzMjU2a2V5MQ==")

# Importar todos os models para que o mapper SQLAlchemy seja configurado
# antes que os testes tentem usar __new__ nos models mapeados
from app.domain.attendance.models import AttendanceRecord  # noqa: F401, E402
from app.domain.devices.models import AuthorizedDevice  # noqa: F401, E402
from app.domain.employees.models import Employee, EmployeeConsent  # noqa: F401, E402
from app.domain.facial.models import FacialEmbedding  # noqa: F401, E402
from app.domain.hour_bank.models import HourBankBalance, HourBankEntry  # noqa: F401, E402
from app.domain.justifications.models import Justification  # noqa: F401, E402
from app.domain.schedules.models import ScheduleException, WorkSchedule  # noqa: F401, E402

from sqlalchemy.orm import configure_mappers
configure_mappers()

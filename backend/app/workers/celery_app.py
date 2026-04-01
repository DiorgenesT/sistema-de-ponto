from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "sistema_ponto",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks.hour_bank",
        "app.workers.tasks.notifications",
        "app.workers.tasks.reports",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_acks_late=True,           # reprocessar se worker cair
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # um task por vez — evita sobrecarga com deepface
    task_routes={
        "app.workers.tasks.hour_bank.*": {"queue": "hour_bank"},
        "app.workers.tasks.reports.*": {"queue": "reports"},
        "app.workers.tasks.notifications.*": {"queue": "notifications"},
    },
    beat_schedule={
        # Recálculo mensal de banco de horas (todo dia 1 às 2h)
        "monthly-hour-bank-recalc": {
            "task": "app.workers.tasks.hour_bank.monthly_recalculate_all",
            "schedule": "0 2 1 * *",  # cron: 1º de cada mês às 02:00
        },
        # Alerta de vencimento de banco de horas (diário às 8h)
        "daily-hour-bank-expiry-alert": {
            "task": "app.workers.tasks.notifications.alert_expiring_hour_banks",
            "schedule": "0 8 * * *",
        },
        # Sincronização NTP periódica
        "ntp-sync": {
            "task": "app.workers.tasks.hour_bank.ntp_sync",
            "schedule": 300.0,  # a cada 5 min
        },
    },
)

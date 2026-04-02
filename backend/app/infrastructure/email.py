"""
Serviço de envio de email.

Suporta dois backends:
- SendGrid (se SENDGRID_API_KEY configurado) — recomendado para produção
- SMTP genérico (se SMTP_HOST configurado) — para dev/self-hosted

Se nenhum backend estiver configurado, loga o email sem enviar (modo dev).
"""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


async def send_email(
    to: str | list[str],
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> bool:
    """
    Envia email de forma assíncrona.

    Args:
        to: Destinatário(s).
        subject: Assunto.
        body_html: Corpo em HTML.
        body_text: Corpo em texto plano (fallback). Se None, usa body_html sem tags.

    Returns:
        True se enviado com sucesso, False caso contrário.
    """
    recipients = [to] if isinstance(to, str) else to

    if not settings.email_configured:
        log.info(
            "email.skipped_no_config",
            to=recipients,
            subject=subject,
        )
        return False

    if settings.SENDGRID_API_KEY:
        return await _send_via_sendgrid(recipients, subject, body_html, body_text)
    return await _send_via_smtp(recipients, subject, body_html, body_text)


async def _send_via_sendgrid(
    recipients: list[str],
    subject: str,
    body_html: str,
    body_text: str | None,
) -> bool:
    """Envia via SendGrid HTTP API (sem dependência da lib sendgrid)."""
    import httpx

    payload = {
        "personalizations": [{"to": [{"email": r} for r in recipients]}],
        "from": {"email": settings.SMTP_FROM},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": body_text or _strip_html(body_html)},
            {"type": "text/html", "value": body_html},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
            )
        if resp.status_code == 202:
            log.info("email.sent.sendgrid", to=recipients, subject=subject)
            return True
        log.error("email.sendgrid_error", status=resp.status_code, body=resp.text[:200])
        return False
    except Exception as exc:
        log.error("email.sendgrid_exception", error=str(exc))
        return False


async def _send_via_smtp(
    recipients: list[str],
    subject: str,
    body_html: str,
    body_text: str | None,
) -> bool:
    """Envia via SMTP em thread separada (smtplib é síncrono)."""

    def _blocking_send() -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = ", ".join(recipients)

        msg.attach(MIMEText(body_text or _strip_html(body_html), "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        smtp_cls = smtplib.SMTP_SSL if not settings.SMTP_USE_TLS else smtplib.SMTP
        with smtp_cls(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, recipients, msg.as_string())

    try:
        await asyncio.get_event_loop().run_in_executor(None, _blocking_send)
        log.info("email.sent.smtp", to=recipients, subject=subject)
        return True
    except Exception as exc:
        log.error("email.smtp_exception", error=str(exc))
        return False


def _strip_html(html: str) -> str:
    """Remove tags HTML para fallback de texto plano."""
    import re
    return re.sub(r"<[^>]+>", "", html).strip()

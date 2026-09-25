import smtplib
from email.message import EmailMessage
from typing import Protocol
from urllib.parse import quote

from app.config import Settings


class EmailDeliveryError(Exception):
    pass


class PasswordResetEmailSender(Protocol):
    def send_password_reset(self, recipient_email: str, reset_url: str) -> None: ...


class SMTPPasswordResetEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send_password_reset(self, recipient_email: str, reset_url: str) -> None:
        from_email = self._settings.smtp_from_email
        host = self._settings.smtp_host
        if from_email is None or host is None:
            raise EmailDeliveryError("SMTP is not configured.")

        message = EmailMessage()
        message["Subject"] = "Redefinicao de senha - GanhoCerto"
        message["From"] = from_email
        message["To"] = recipient_email
        message.set_content(
            "Recebemos uma solicitacao para redefinir sua senha no GanhoCerto.\n\n"
            f"Acesse este link para continuar: {reset_url}\n\n"
            "Se voce nao solicitou isso, ignore este email."
        )

        try:
            with smtplib.SMTP(host, self._settings.smtp_port, timeout=10) as smtp:
                if self._settings.smtp_use_tls:
                    smtp.starttls()
                if self._settings.smtp_username and self._settings.smtp_password:
                    smtp.login(self._settings.smtp_username, self._settings.smtp_password)
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError("Could not send password reset email.") from exc


class DevelopmentPasswordResetEmailSender:
    def send_password_reset(self, recipient_email: str, reset_url: str) -> None:
        return None


def build_password_reset_url(settings: Settings, raw_token: str) -> str:
    base_url = settings.frontend_base_url.rstrip("/")
    return f"{base_url}/reset-password?token={quote(raw_token)}"


def get_password_reset_email_sender(settings: Settings) -> PasswordResetEmailSender:
    if settings.smtp_host and settings.smtp_from_email:
        return SMTPPasswordResetEmailSender(settings)

    if settings.is_production:
        raise EmailDeliveryError("SMTP is not configured.")

    return DevelopmentPasswordResetEmailSender()

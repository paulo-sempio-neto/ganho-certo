from __future__ import annotations

import hashlib
import hmac
import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.billing import (
    BillingEventVerificationError,
    BillingProviderConfigurationError,
    BillingProviderResponseError,
    CheckoutSession,
    CheckoutSessionRequest,
    ProviderSubscription,
    VerifiedBillingEvent,
    build_billing_external_reference,
)
from app.config import Settings

MERCADO_PAGO_PROVIDER = "mercado_pago"
MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com"

HttpTransport = Callable[[str, str, Mapping[str, str], bytes | None], tuple[int, bytes]]


@dataclass(frozen=True)
class MercadoPagoConfig:
    access_token: str
    webhook_secret: str
    public_key: str | None = None
    api_base_url: str = MERCADO_PAGO_API_BASE_URL


class MercadoPagoProvider:
    provider = MERCADO_PAGO_PROVIDER

    def __init__(
        self,
        config: MercadoPagoConfig,
        *,
        transport: HttpTransport | None = None,
    ) -> None:
        self.config = config
        self._transport = transport or self._default_transport

    @classmethod
    def from_settings(cls, settings: Settings) -> MercadoPagoProvider:
        if settings.billing_provider != MERCADO_PAGO_PROVIDER:
            raise BillingProviderConfigurationError("Mercado Pago billing is not enabled.")
        if not settings.mercadopago_access_token:
            raise BillingProviderConfigurationError("Mercado Pago access token is not configured.")

        webhook_secret = settings.mercadopago_webhook_secret or settings.billing_secret_key
        if not webhook_secret:
            raise BillingProviderConfigurationError(
                "Mercado Pago webhook secret is not configured."
            )

        return cls(
            MercadoPagoConfig(
                access_token=settings.mercadopago_access_token,
                webhook_secret=webhook_secret,
                public_key=settings.mercadopago_public_key,
            )
        )

    def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSession:
        payload = {
            "reason": f"GanhoCerto Plano {request.plan_code.upper()}",
            "external_reference": build_billing_external_reference(
                user_id=request.customer.user_id,
                plan_code=request.plan_code,
            ),
            "payer_email": request.payer_email,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": float(request.amount),
                "currency_id": request.currency_id,
            },
            "back_url": request.success_url,
            "status": "pending",
        }
        data = self._request_json("POST", "/preapproval", payload=payload)
        external_session_id = _string_field(data, "id")
        redirect_url = _string_field(data, "init_point")
        if not external_session_id or not redirect_url:
            raise BillingProviderResponseError("Mercado Pago checkout response is incomplete.")

        return CheckoutSession(
            provider=self.provider,
            external_session_id=external_session_id,
            redirect_url=redirect_url,
        )

    def verify_payment_event(
        self,
        payload: bytes,
        headers: dict[str, str],
        query_params: dict[str, str],
    ) -> VerifiedBillingEvent:
        raw_payload = _decode_json_object(payload)
        resource_id = _resource_id(raw_payload, query_params)
        x_signature = _header(headers, "x-signature")
        x_request_id = _header(headers, "x-request-id")
        if not x_signature or not x_request_id or not resource_id:
            raise BillingEventVerificationError("Mercado Pago webhook signature data is missing.")

        signature_parts = _parse_signature_header(x_signature)
        timestamp = signature_parts.get("ts")
        received_signature = signature_parts.get("v1")
        if not timestamp or not received_signature:
            raise BillingEventVerificationError("Mercado Pago webhook signature is invalid.")

        manifest = f"id:{resource_id.lower()};request-id:{x_request_id};ts:{timestamp};"
        expected_signature = hmac.new(
            self.config.webhook_secret.encode("utf-8"),
            manifest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_signature, received_signature):
            raise BillingEventVerificationError("Mercado Pago webhook signature mismatch.")

        event_type = str(raw_payload.get("action") or raw_payload.get("type") or "unknown")
        external_event_id = str(raw_payload.get("id") or f"{event_type}:{resource_id}:{timestamp}")
        return VerifiedBillingEvent(
            provider=self.provider,
            event_type=event_type,
            external_event_id=external_event_id,
            resource_id=resource_id,
            payload_hash=hashlib.sha256(payload).hexdigest(),
            raw_payload=raw_payload,
        )

    def fetch_subscription(self, external_subscription_id: str) -> ProviderSubscription:
        data = self._request_json("GET", f"/preapproval/{quote(external_subscription_id)}")
        status = _string_field(data, "status")
        if not status:
            raise BillingProviderResponseError("Mercado Pago subscription response has no status.")

        auto_recurring = data.get("auto_recurring")
        if not isinstance(auto_recurring, dict):
            auto_recurring = {}

        return ProviderSubscription(
            provider=self.provider,
            external_subscription_id=_string_field(data, "id") or external_subscription_id,
            external_reference=_string_field(data, "external_reference"),
            status=status,
            current_period_start=_parse_datetime(
                _string_value(auto_recurring.get("start_date"))
                or _string_field(data, "date_created")
            ),
            current_period_end=_parse_datetime(
                _string_field(data, "next_payment_date")
                or _string_value(auto_recurring.get("end_date"))
            ),
        )

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.config.access_token}",
            "Content-Type": "application/json",
        }
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        status_code, response_body = self._transport(
            method,
            f"{self.config.api_base_url}{path}",
            headers,
            body,
        )
        if status_code >= 400:
            raise BillingProviderResponseError("Mercado Pago returned an error response.")

        data = _decode_json_object(response_body)
        return data

    @staticmethod
    def _default_transport(
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: bytes | None,
    ) -> tuple[int, bytes]:
        request = Request(url=url, data=body, headers=dict(headers), method=method)
        try:
            with urlopen(request, timeout=10) as response:
                return response.status, response.read()
        except HTTPError as error:
            return error.code, error.read()
        except URLError as error:
            raise BillingProviderResponseError("Could not reach Mercado Pago.") from error


def _decode_json_object(payload: bytes) -> dict[str, Any]:
    try:
        data = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise BillingProviderResponseError("Provider response is not valid JSON.") from None
    if not isinstance(data, dict):
        raise BillingProviderResponseError("Provider response must be a JSON object.")
    return data


def _header(headers: Mapping[str, str], name: str) -> str | None:
    for key, value in headers.items():
        if key.lower() == name:
            return value
    return None


def _parse_signature_header(value: str) -> dict[str, str]:
    parts: dict[str, str] = {}
    for item in value.split(","):
        key, separator, part_value = item.strip().partition("=")
        if separator:
            parts[key] = part_value
    return parts


def _resource_id(payload: dict[str, Any], query_params: Mapping[str, str]) -> str:
    query_resource_id = query_params.get("data.id")
    if query_resource_id:
        return query_resource_id

    data = payload.get("data")
    if isinstance(data, dict):
        resource_id = data.get("id")
        if resource_id is not None:
            return str(resource_id)

    return ""


def _string_field(data: Mapping[str, Any], key: str) -> str:
    return _string_value(data.get(key)) or ""


def _string_value(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        raise BillingProviderResponseError("Provider subscription date is invalid.") from None

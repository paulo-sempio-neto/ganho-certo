import hashlib
import hmac
import json
from collections.abc import Generator, Mapping
from datetime import UTC
from decimal import Decimal
from typing import cast

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.billing import activate_subscription, build_billing_external_reference
from app.billing_routes import get_billing_provider
from app.config import Settings
from app.database import Base, get_db
from app.entitlements import ensure_default_entitlements
from app.main import create_app
from app.models import BillingEvent, Plan, Subscription, User
from app.providers.mercadopago import MercadoPagoConfig, MercadoPagoProvider
from app.subscriptions import get_effective_plan

WEBHOOK_SECRET = "mercadopago_webhook_secret"


class FakeMercadoPagoTransport:
    def __init__(self) -> None:
        self.checkout_response: dict[str, object] = {
            "id": "preapproval_checkout",
            "init_point": "https://www.mercadopago.com.br/subscriptions/checkout?id=123",
        }
        self.subscription_responses: dict[str, dict[str, object]] = {}
        self.requests: list[tuple[str, str, dict[str, str], dict[str, object] | None]] = []

    def __call__(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: bytes | None,
    ) -> tuple[int, bytes]:
        payload = json.loads(body.decode("utf-8")) if body is not None else None
        self.requests.append((method, url, dict(headers), payload))
        if method == "POST" and url.endswith("/preapproval"):
            return 201, json.dumps(self.checkout_response).encode("utf-8")
        if method == "GET" and "/preapproval/" in url:
            external_id = url.rsplit("/", 1)[-1]
            response = self.subscription_responses.get(external_id)
            if response is None:
                return 404, b'{"message":"not found"}'
            return 200, json.dumps(response).encode("utf-8")

        return 500, b'{"message":"unexpected request"}'


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_and_login(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Assinante", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201
    login_response = client.post("/auth/login", json={"email": email, "password": "senha123"})
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as session:
        yield session

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def mercado_pago_transport() -> FakeMercadoPagoTransport:
    return FakeMercadoPagoTransport()


@pytest.fixture
def client(
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> Generator[TestClient, None, None]:
    application = create_app(
        Settings(
            app_env="local",
            jwt_secret_key="test_secret_key_with_at_least_32_chars",
            billing_provider="mercado_pago",
            mercadopago_access_token="TEST-access-token",
            mercadopago_webhook_secret=WEBHOOK_SECRET,
            billing_pro_monthly_amount=Decimal("29.90"),
            frontend_base_url="http://localhost:5173",
        )
    )
    provider = MercadoPagoProvider(
        MercadoPagoConfig(
            access_token="TEST-access-token",
            webhook_secret=WEBHOOK_SECRET,
        ),
        transport=mercado_pago_transport,
    )

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_billing_provider] = lambda: provider

    with TestClient(application) as test_client:
        yield test_client

    application.dependency_overrides.clear()


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def get_plan(db_session: Session, code: str) -> Plan:
    ensure_default_entitlements(db_session)
    plan = db_session.scalar(select(Plan).where(Plan.code == code))
    assert plan is not None
    return plan


def signed_webhook_headers(resource_id: str) -> dict[str, str]:
    timestamp = "1700000000"
    request_id = "request-123"
    manifest = f"id:{resource_id};request-id:{request_id};ts:{timestamp};"
    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "x-request-id": request_id,
        "x-signature": f"ts={timestamp},v1={signature}",
    }


def webhook_payload(resource_id: str, *, event_id: int = 123) -> dict[str, object]:
    return {
        "id": event_id,
        "type": "subscription_preapproval",
        "action": "subscription.updated",
        "data": {"id": resource_id},
    }


def provider_subscription_payload(
    user: User,
    *,
    external_id: str = "sub_123",
    status: str = "authorized",
    period_end: str = "2026-10-26T00:00:00Z",
) -> dict[str, object]:
    return {
        "id": external_id,
        "status": status,
        "external_reference": build_billing_external_reference(user.id, "pro"),
        "date_created": "2026-09-26T00:00:00Z",
        "next_payment_date": period_end,
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": 29.9,
            "currency_id": "BRL",
        },
    }


def post_signed_webhook(
    client: TestClient,
    resource_id: str,
    *,
    event_id: int = 123,
) -> Response:
    return cast(
        Response,
        client.post(
            f"/billing/webhook?data.id={resource_id}",
            json=webhook_payload(resource_id, event_id=event_id),
            headers=signed_webhook_headers(resource_id),
        ),
    )


def test_checkout_creation_does_not_activate_plan(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    token = register_and_login(client, "checkout@email.com")
    user = get_user(db_session, "checkout@email.com")

    response = client.post(
        "/billing/checkout",
        json={"plan_code": "pro"},
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json() == {
        "provider": "mercado_pago",
        "checkout_id": "preapproval_checkout",
        "checkout_url": "https://www.mercadopago.com.br/subscriptions/checkout?id=123",
    }
    user_subscriptions = db_session.scalars(
        select(Subscription).where(Subscription.user_id == user.id)
    ).all()
    assert user_subscriptions == []
    assert get_effective_plan(user, db_session).code == "free"
    method, url, headers, payload = mercado_pago_transport.requests[0]
    assert method == "POST"
    assert url.endswith("/preapproval")
    assert headers["Authorization"] == "Bearer TEST-access-token"
    assert payload is not None
    assert payload["external_reference"] == build_billing_external_reference(user.id, "pro")
    assert payload["status"] == "pending"


def test_checkout_invalid_provider_response_returns_502(
    client: TestClient,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    token = register_and_login(client, "checkout-invalido@email.com")
    mercado_pago_transport.checkout_response = {"id": "preapproval_without_url"}

    response = client.post(
        "/billing/checkout",
        json={"plan_code": "pro"},
        headers=auth_headers(token),
    )

    assert response.status_code == 502


def test_valid_payment_event_activates_subscription(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    register_and_login(client, "webhook@email.com")
    user = get_user(db_session, "webhook@email.com")
    mercado_pago_transport.subscription_responses["sub_123"] = provider_subscription_payload(user)

    response = post_signed_webhook(client, "sub_123")

    assert response.status_code == 200
    assert response.json() == {"status": "processed"}
    subscription = db_session.scalar(select(Subscription).where(Subscription.user_id == user.id))
    assert subscription is not None
    assert subscription.status == "active"
    assert subscription.provider == "mercado_pago"
    assert subscription.external_subscription_id == "sub_123"
    assert get_effective_plan(user, db_session).code == "pro"
    event = db_session.scalar(select(BillingEvent).where(BillingEvent.user_id == user.id))
    assert event is not None
    assert event.processed_at is not None
    assert event.raw_payload == webhook_payload("sub_123")


def test_duplicate_webhook_is_not_processed_twice(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    register_and_login(client, "duplicado@email.com")
    user = get_user(db_session, "duplicado@email.com")
    mercado_pago_transport.subscription_responses["sub_123"] = provider_subscription_payload(user)

    first_response = post_signed_webhook(client, "sub_123", event_id=456)
    second_response = post_signed_webhook(client, "sub_123", event_id=456)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json() == {"status": "duplicate"}
    events = db_session.scalars(select(BillingEvent).where(BillingEvent.user_id == user.id)).all()
    subscriptions = db_session.scalars(
        select(Subscription).where(Subscription.user_id == user.id)
    ).all()
    assert len(events) == 1
    assert len(subscriptions) == 1


def test_failed_payment_event_does_not_activate_subscription(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    register_and_login(client, "falhou@email.com")
    user = get_user(db_session, "falhou@email.com")
    mercado_pago_transport.subscription_responses["sub_failed"] = provider_subscription_payload(
        user,
        external_id="sub_failed",
        status="pending",
    )

    response = post_signed_webhook(client, "sub_failed", event_id=789)

    assert response.status_code == 200
    assert response.json() == {"status": "processed"}
    user_subscriptions = db_session.scalars(
        select(Subscription).where(Subscription.user_id == user.id)
    ).all()
    assert user_subscriptions == []
    assert get_effective_plan(user, db_session).code == "free"


def test_subscription_update_uses_existing_subscription(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    register_and_login(client, "atualiza@email.com")
    user = get_user(db_session, "atualiza@email.com")
    mercado_pago_transport.subscription_responses["sub_update"] = provider_subscription_payload(
        user,
        external_id="sub_update",
        period_end="2026-11-26T00:00:00Z",
    )

    first_response = post_signed_webhook(client, "sub_update", event_id=101)
    mercado_pago_transport.subscription_responses["sub_update"] = provider_subscription_payload(
        user,
        external_id="sub_update",
        period_end="2026-12-26T00:00:00Z",
    )
    second_response = post_signed_webhook(client, "sub_update", event_id=102)

    subscriptions = db_session.scalars(
        select(Subscription).where(Subscription.user_id == user.id)
    ).all()
    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(subscriptions) == 1
    assert subscriptions[0].current_period_end is not None
    assert subscriptions[0].current_period_end.replace(tzinfo=UTC).isoformat().startswith(
        "2026-12-26T00:00:00"
    )


def test_webhook_cannot_move_existing_subscription_to_another_user(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    register_and_login(client, "dono@email.com")
    register_and_login(client, "intruso@email.com")
    owner = get_user(db_session, "dono@email.com")
    other_user = get_user(db_session, "intruso@email.com")
    pro_plan = get_plan(db_session, "pro")
    activate_subscription(
        user=owner,
        plan=pro_plan,
        provider="mercado_pago",
        external_subscription_id="sub_shared",
        current_period_start=None,
        current_period_end=None,
        db=db_session,
    )
    mercado_pago_transport.subscription_responses["sub_shared"] = provider_subscription_payload(
        other_user,
        external_id="sub_shared",
    )

    response = post_signed_webhook(client, "sub_shared", event_id=999)

    assert response.status_code == 400
    assert get_effective_plan(owner, db_session).code == "pro"
    assert get_effective_plan(other_user, db_session).code == "free"


def test_invalid_webhook_signature_is_rejected_without_event_storage(
    client: TestClient,
    db_session: Session,
    mercado_pago_transport: FakeMercadoPagoTransport,
) -> None:
    register_and_login(client, "assinatura-invalida@email.com")
    user = get_user(db_session, "assinatura-invalida@email.com")
    mercado_pago_transport.subscription_responses["sub_123"] = provider_subscription_payload(user)

    response = client.post(
        "/billing/webhook?data.id=sub_123",
        json=webhook_payload("sub_123", event_id=321),
        headers={"x-request-id": "request-123", "x-signature": "ts=1700000000,v1=bad"},
    )

    assert response.status_code == 401
    user_billing_events = db_session.scalars(
        select(BillingEvent).where(BillingEvent.user_id == user.id)
    ).all()
    assert user_billing_events == []
    assert get_effective_plan(user, db_session).code == "free"

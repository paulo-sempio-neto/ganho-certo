from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.billing import (
    DuplicateBillingEventError,
    InvalidBillingOperationError,
    activate_subscription,
    cancel_subscription,
    mark_billing_event_processed,
    store_billing_event,
    update_subscription_period,
)
from app.database import Base, get_db
from app.entitlements import ensure_default_entitlements, has_feature_access
from app.main import app
from app.models import BillingEvent, Plan, Subscription, User
from app.subscriptions import (
    get_active_subscription,
    get_effective_plan,
    has_active_subscription,
)


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
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def get_plan(db_session: Session, code: str) -> Plan:
    ensure_default_entitlements(db_session)
    plan = db_session.scalar(select(Plan).where(Plan.code == code))
    assert plan is not None
    return plan


def test_billing_event_storage_and_processing(
    client: TestClient,
    db_session: Session,
) -> None:
    register_and_login(client, "evento@email.com")
    user = get_user(db_session, "evento@email.com")

    event = store_billing_event(
        user=user,
        provider="stripe",
        event_type="subscription.updated",
        external_event_id="evt_123",
        payload_hash="hash_123",
        db=db_session,
    )
    processed = mark_billing_event_processed(event, db_session)

    stored_event = db_session.scalar(select(BillingEvent).where(BillingEvent.id == event.id))
    assert stored_event is not None
    assert stored_event.user_id == user.id
    assert stored_event.provider == "stripe"
    assert stored_event.processed_at is not None
    assert processed.processed_at == stored_event.processed_at


def test_duplicate_billing_event_is_rejected(
    client: TestClient,
    db_session: Session,
) -> None:
    register_and_login(client, "duplicado@email.com")
    user = get_user(db_session, "duplicado@email.com")

    store_billing_event(
        user=user,
        provider="mercado_pago",
        event_type="payment.updated",
        external_event_id="evt_duplicate",
        payload_hash="hash_1",
        db=db_session,
    )

    with pytest.raises(DuplicateBillingEventError):
        store_billing_event(
            user=user,
            provider="mercado_pago",
            event_type="payment.updated",
            external_event_id="evt_duplicate",
            payload_hash="hash_2",
            db=db_session,
        )

    stored_event = db_session.scalar(select(BillingEvent).where(BillingEvent.user_id == user.id))
    assert stored_event is not None
    assert stored_event.payload_hash == "hash_1"


def test_subscription_state_transitions_update_effective_plan(
    client: TestClient,
    db_session: Session,
) -> None:
    register_and_login(client, "assinante@email.com")
    user = get_user(db_session, "assinante@email.com")
    pro_plan = get_plan(db_session, "pro")
    now = datetime.now(UTC)

    subscription = activate_subscription(
        user=user,
        plan=pro_plan,
        provider="stripe",
        external_subscription_id="sub_123",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        db=db_session,
    )

    assert subscription.status == "active"
    assert get_effective_plan(user, db_session).code == "pro"
    assert has_active_subscription(user, db_session)
    assert has_feature_access(user, "csv_import", db_session)

    expected_period_end = now + timedelta(days=60)
    updated = update_subscription_period(
        subscription,
        db_session,
        current_period_start=now + timedelta(days=30),
        current_period_end=expected_period_end,
    )
    assert updated.current_period_end is not None
    assert updated.current_period_end.replace(tzinfo=UTC) == expected_period_end

    canceled = cancel_subscription(subscription, db_session)
    assert canceled.status == "canceled"
    assert canceled.canceled_at is not None
    assert get_active_subscription(user, db_session) is None
    assert get_effective_plan(user, db_session).code == "free"
    assert not has_feature_access(user, "csv_import", db_session)


def test_subscription_external_id_cannot_cross_users(
    client: TestClient,
    db_session: Session,
) -> None:
    register_and_login(client, "assinante-a@email.com")
    register_and_login(client, "assinante-b@email.com")
    user_a = get_user(db_session, "assinante-a@email.com")
    user_b = get_user(db_session, "assinante-b@email.com")
    pro_plan = get_plan(db_session, "pro")
    now = datetime.now(UTC)
    activate_subscription(
        user=user_a,
        plan=pro_plan,
        provider="stripe",
        external_subscription_id="sub_shared",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        db=db_session,
    )

    with pytest.raises(InvalidBillingOperationError):
        activate_subscription(
            user=user_b,
            plan=pro_plan,
            provider="stripe",
            external_subscription_id="sub_shared",
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            db=db_session,
        )

    assert get_effective_plan(user_a, db_session).code == "pro"
    assert get_effective_plan(user_b, db_session).code == "free"


def test_invalid_subscription_operations_are_rejected(
    client: TestClient,
    db_session: Session,
) -> None:
    register_and_login(client, "invalido@email.com")
    user = get_user(db_session, "invalido@email.com")
    pro_plan = get_plan(db_session, "pro")
    pro_plan.active = False
    db_session.commit()
    now = datetime.now(UTC)

    with pytest.raises(InvalidBillingOperationError):
        activate_subscription(
            user=user,
            plan=pro_plan,
            provider="stripe",
            external_subscription_id="sub_inactive_plan",
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            db=db_session,
        )

    pro_plan.active = True
    db_session.commit()
    with pytest.raises(InvalidBillingOperationError):
        activate_subscription(
            user=user,
            plan=pro_plan,
            provider="stripe",
            external_subscription_id="sub_bad_period",
            current_period_start=now,
            current_period_end=now,
            db=db_session,
        )

    user_subscriptions = db_session.scalars(
        select(Subscription).where(Subscription.user_id == user.id)
    ).all()
    assert user_subscriptions == []


def test_user_cannot_activate_pro_from_public_api(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "publico@email.com")
    user = get_user(db_session, "publico@email.com")

    response = client.post(
        "/billing/subscriptions/activate",
        headers=auth_headers(token),
        json={"plan": "pro"},
    )

    assert response.status_code == 404
    assert get_effective_plan(user, db_session).code == "free"
    assert not has_active_subscription(user, db_session)

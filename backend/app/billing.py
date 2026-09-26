from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BillingEvent, Plan, Subscription, User

ACTIVE_SUBSCRIPTION_STATUS = "active"
CANCELED_SUBSCRIPTION_STATUS = "canceled"
GANHOCERTO_EXTERNAL_REFERENCE_PREFIX = "gc"


class BillingError(Exception):
    pass


class DuplicateBillingEventError(BillingError):
    pass


class BillingEventVerificationError(BillingError):
    pass


class BillingProviderConfigurationError(BillingError):
    pass


class BillingProviderResponseError(BillingError):
    pass


class InvalidBillingOperationError(BillingError):
    pass


@dataclass(frozen=True)
class BillingCustomer:
    user_id: int
    provider: str
    external_customer_id: str | None = None


@dataclass(frozen=True)
class CheckoutSessionRequest:
    customer: BillingCustomer
    plan_code: str
    success_url: str
    cancel_url: str
    payer_email: str
    amount: Decimal
    currency_id: str


@dataclass(frozen=True)
class CheckoutSession:
    provider: str
    external_session_id: str
    redirect_url: str


@dataclass(frozen=True)
class VerifiedBillingEvent:
    provider: str
    event_type: str
    external_event_id: str
    resource_id: str
    payload_hash: str
    raw_payload: dict[str, Any]


@dataclass(frozen=True)
class ProviderSubscription:
    provider: str
    external_subscription_id: str
    external_reference: str
    status: str
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None


class BillingProvider(Protocol):
    provider: str

    def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSession:
        """Create a provider checkout session without changing local entitlements."""
        raise NotImplementedError

    def verify_payment_event(
        self,
        payload: bytes,
        headers: dict[str, str],
        query_params: dict[str, str],
    ) -> VerifiedBillingEvent:
        """Verify and normalize a provider webhook event."""
        raise NotImplementedError

    def fetch_subscription(self, external_subscription_id: str) -> ProviderSubscription:
        """Fetch the authoritative subscription state from the provider."""
        raise NotImplementedError


def build_billing_external_reference(user_id: int, plan_code: str) -> str:
    return f"{GANHOCERTO_EXTERNAL_REFERENCE_PREFIX}:user:{user_id}:plan:{plan_code}"


def parse_billing_external_reference(external_reference: str) -> tuple[int, str]:
    parts = external_reference.split(":")
    if len(parts) != 5 or parts[:2] != [GANHOCERTO_EXTERNAL_REFERENCE_PREFIX, "user"]:
        raise InvalidBillingOperationError("Billing external reference is invalid.")
    if parts[3] != "plan":
        raise InvalidBillingOperationError("Billing external reference is invalid.")

    try:
        user_id = int(parts[2])
    except ValueError:
        raise InvalidBillingOperationError("Billing external reference user is invalid.") from None

    plan_code = parts[4]
    if not plan_code:
        raise InvalidBillingOperationError("Billing external reference plan is invalid.")

    return user_id, plan_code


def store_billing_event(
    *,
    user: User,
    provider: str,
    event_type: str,
    external_event_id: str,
    payload_hash: str,
    db: Session,
    raw_payload: dict[str, Any] | None = None,
    processed_at: datetime | None = None,
) -> BillingEvent:
    existing_event = db.scalar(
        select(BillingEvent).where(
            BillingEvent.provider == provider,
            BillingEvent.external_event_id == external_event_id,
        )
    )
    if existing_event is not None:
        raise DuplicateBillingEventError("Billing event has already been stored.")

    event = BillingEvent(
        user_id=user.id,
        provider=provider,
        event_type=event_type,
        external_event_id=external_event_id,
        payload_hash=payload_hash,
        raw_payload=raw_payload,
        processed_at=processed_at,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def mark_billing_event_processed(
    event: BillingEvent,
    db: Session,
    *,
    processed_at: datetime | None = None,
) -> BillingEvent:
    event.processed_at = processed_at or datetime.now(UTC)
    db.commit()
    db.refresh(event)
    return event


def activate_subscription(
    *,
    user: User,
    plan: Plan,
    provider: str,
    db: Session,
    external_subscription_id: str | None = None,
    current_period_start: datetime | None = None,
    current_period_end: datetime | None = None,
    started_at: datetime | None = None,
) -> Subscription:
    if not plan.active:
        raise InvalidBillingOperationError("Cannot activate a subscription for an inactive plan.")

    if (
        current_period_start is not None
        and current_period_end is not None
        and current_period_end <= current_period_start
    ):
        raise InvalidBillingOperationError("Subscription period end must be after period start.")

    subscription = _find_provider_subscription(
        provider=provider,
        external_subscription_id=external_subscription_id,
        db=db,
    )
    if subscription is not None and subscription.user_id != user.id:
        raise InvalidBillingOperationError("Subscription belongs to another user.")

    now = datetime.now(UTC)
    if subscription is None:
        subscription = Subscription(
            user_id=user.id,
            plan_id=plan.id,
            status=ACTIVE_SUBSCRIPTION_STATUS,
            provider=provider,
            external_subscription_id=external_subscription_id,
            started_at=started_at or now,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            created_at=now,
            updated_at=now,
        )
        db.add(subscription)
    else:
        subscription.plan_id = plan.id
        subscription.status = ACTIVE_SUBSCRIPTION_STATUS
        subscription.canceled_at = None
        subscription.current_period_start = current_period_start
        subscription.current_period_end = current_period_end
        subscription.updated_at = now

    db.commit()
    db.refresh(subscription)
    return subscription


def cancel_subscription(
    subscription: Subscription,
    db: Session,
    *,
    canceled_at: datetime | None = None,
) -> Subscription:
    now = datetime.now(UTC)
    subscription.status = CANCELED_SUBSCRIPTION_STATUS
    subscription.canceled_at = canceled_at or now
    subscription.updated_at = now
    db.commit()
    db.refresh(subscription)
    return subscription


def update_subscription_period(
    subscription: Subscription,
    db: Session,
    *,
    current_period_start: datetime | None,
    current_period_end: datetime | None,
) -> Subscription:
    if (
        current_period_start is not None
        and current_period_end is not None
        and current_period_end <= current_period_start
    ):
        raise InvalidBillingOperationError("Subscription period end must be after period start.")

    subscription.current_period_start = current_period_start
    subscription.current_period_end = current_period_end
    subscription.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(subscription)
    return subscription


def get_subscription_by_provider_external_id(
    *,
    provider: str,
    external_subscription_id: str,
    db: Session,
) -> Subscription | None:
    return _find_provider_subscription(
        provider=provider,
        external_subscription_id=external_subscription_id,
        db=db,
    )


def _find_provider_subscription(
    *,
    provider: str,
    external_subscription_id: str | None,
    db: Session,
) -> Subscription | None:
    if external_subscription_id is None:
        return None

    return db.scalar(
        select(Subscription).where(
            Subscription.provider == provider,
            Subscription.external_subscription_id == external_subscription_id,
        )
    )

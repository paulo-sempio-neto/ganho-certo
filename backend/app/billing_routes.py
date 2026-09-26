from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.billing import (
    BillingCustomer,
    BillingEventVerificationError,
    BillingProvider,
    BillingProviderConfigurationError,
    BillingProviderResponseError,
    CheckoutSessionRequest,
    DuplicateBillingEventError,
    InvalidBillingOperationError,
    activate_subscription,
    cancel_subscription,
    get_subscription_by_provider_external_id,
    mark_billing_event_processed,
    parse_billing_external_reference,
    store_billing_event,
)
from app.config import Settings
from app.database import get_db
from app.entitlements import PRO_PLAN_CODE, ensure_default_entitlements
from app.models import Plan, User
from app.providers.mercadopago import MercadoPagoProvider
from app.schemas import BillingCheckoutRequest, BillingCheckoutResponse, BillingWebhookResponse

router = APIRouter(prefix="/billing", tags=["billing"])

ACTIVE_PROVIDER_STATUSES = {"active", "authorized"}
CANCELED_PROVIDER_STATUSES = {"cancelled", "canceled", "paused", "expired"}


def get_app_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_billing_provider(
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> BillingProvider:
    try:
        return MercadoPagoProvider.from_settings(settings)
    except BillingProviderConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing provider is not configured.",
        ) from error


@router.post("/checkout", response_model=BillingCheckoutResponse)
def create_billing_checkout(
    checkout_request: BillingCheckoutRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    provider: Annotated[BillingProvider, Depends(get_billing_provider)],
) -> BillingCheckoutResponse:
    if checkout_request.plan_code != PRO_PLAN_CODE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the Pro plan is available for checkout.",
        )
    if settings.billing_pro_monthly_amount is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing amount is not configured.",
        )

    ensure_default_entitlements(db)
    plan = db.scalar(
        select(Plan).where(Plan.code == checkout_request.plan_code, Plan.active.is_(True))
    )
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")

    frontend_base_url = settings.frontend_base_url.rstrip("/")
    try:
        checkout_session = provider.create_checkout_session(
            CheckoutSessionRequest(
                customer=BillingCustomer(
                    user_id=current_user.id,
                    provider=provider.provider,
                ),
                plan_code=plan.code,
                success_url=f"{frontend_base_url}/account/plan?billing=success",
                cancel_url=f"{frontend_base_url}/account/plan?billing=cancel",
                payer_email=current_user.email,
                amount=settings.billing_pro_monthly_amount,
                currency_id=settings.billing_currency_id,
            )
        )
    except BillingProviderResponseError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Billing provider returned an invalid response.",
        ) from error

    return BillingCheckoutResponse(
        provider=checkout_session.provider,
        checkout_id=checkout_session.external_session_id,
        checkout_url=checkout_session.redirect_url,
    )


@router.post("/webhook", response_model=BillingWebhookResponse)
async def receive_billing_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    provider: Annotated[BillingProvider, Depends(get_billing_provider)],
) -> BillingWebhookResponse:
    payload = await request.body()
    try:
        verified_event = provider.verify_payment_event(
            payload,
            dict(request.headers),
            dict(request.query_params),
        )
        provider_subscription = provider.fetch_subscription(verified_event.resource_id)
        user_id, plan_code = parse_billing_external_reference(
            provider_subscription.external_reference
        )
    except BillingEventVerificationError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid billing event signature.",
        ) from error
    except (BillingProviderResponseError, InvalidBillingOperationError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing event.",
        ) from error

    user = db.get(User, user_id)
    ensure_default_entitlements(db)
    plan = db.scalar(select(Plan).where(Plan.code == plan_code, Plan.active.is_(True)))
    if user is None or plan is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing event.",
        )

    try:
        billing_event = store_billing_event(
            user=user,
            provider=verified_event.provider,
            event_type=verified_event.event_type,
            external_event_id=verified_event.external_event_id,
            payload_hash=verified_event.payload_hash,
            raw_payload=verified_event.raw_payload,
            db=db,
        )
    except DuplicateBillingEventError:
        return BillingWebhookResponse(status="duplicate")

    try:
        if provider_subscription.status in ACTIVE_PROVIDER_STATUSES:
            activate_subscription(
                user=user,
                plan=plan,
                provider=provider_subscription.provider,
                external_subscription_id=provider_subscription.external_subscription_id,
                current_period_start=provider_subscription.current_period_start,
                current_period_end=provider_subscription.current_period_end,
                db=db,
            )
        elif provider_subscription.status in CANCELED_PROVIDER_STATUSES:
            subscription = get_subscription_by_provider_external_id(
                provider=provider_subscription.provider,
                external_subscription_id=provider_subscription.external_subscription_id,
                db=db,
            )
            if subscription is not None:
                cancel_subscription(subscription, db)
    except InvalidBillingOperationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing event.",
        ) from error

    mark_billing_event_processed(billing_event, db)
    return BillingWebhookResponse(status="processed")

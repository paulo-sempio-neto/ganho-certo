from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import BetaFeedback, ProductEvent, User

ACCOUNT_CREATED = "account_created"
FIRST_VEHICLE_CREATED = "first_vehicle_created"
FIRST_FINANCIAL_ENTRY = "first_financial_entry"
DASHBOARD_VIEWED = "dashboard_viewed"
CHECKOUT_STARTED = "checkout_started"
SUBSCRIPTION_ACTIVATED = "subscription_activated"
FEEDBACK_SENT = "feedback_sent"
ONCE_PER_USER = "once"


def record_product_event(
    *,
    db: Session,
    user: User,
    event_type: str,
    dedupe_key: str = "",
    occurred_at: datetime | None = None,
) -> ProductEvent:
    if dedupe_key:
        existing_event = db.scalar(
            select(ProductEvent).where(
                ProductEvent.user_id == user.id,
                ProductEvent.event_type == event_type,
                ProductEvent.dedupe_key == dedupe_key,
            )
        )
        if existing_event is not None:
            return existing_event

    event = ProductEvent(
        user_id=user.id,
        event_type=event_type,
        dedupe_key=dedupe_key,
        occurred_at=occurred_at or datetime.now(UTC),
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_event = db.scalar(
            select(ProductEvent).where(
                ProductEvent.user_id == user.id,
                ProductEvent.event_type == event_type,
                ProductEvent.dedupe_key == dedupe_key,
            )
        )
        if existing_event is not None:
            return existing_event
        raise

    db.refresh(event)
    return event


def record_once_per_user_event(
    *,
    db: Session,
    user: User,
    event_type: str,
) -> ProductEvent:
    return record_product_event(
        db=db,
        user=user,
        event_type=event_type,
        dedupe_key=ONCE_PER_USER,
    )


def record_daily_product_event(
    *,
    db: Session,
    user: User,
    event_type: str,
    occurred_at: datetime | None = None,
) -> ProductEvent:
    event_time = occurred_at or datetime.now(UTC)
    return record_product_event(
        db=db,
        user=user,
        event_type=event_type,
        dedupe_key=event_time.date().isoformat(),
        occurred_at=event_time,
    )


def count_distinct_event_users(
    db: Session,
    event_type: str,
    *,
    since: datetime | None = None,
) -> int:
    query = select(ProductEvent.user_id).where(ProductEvent.event_type == event_type).distinct()
    if since is not None:
        query = query.where(ProductEvent.occurred_at >= since)

    return len(db.scalars(query).all())


def get_beta_learning_counts(db: Session) -> dict[str, int]:
    active_since = datetime.now(UTC) - timedelta(days=7)
    first_vehicle_user_ids = set(
        db.scalars(
            select(ProductEvent.user_id)
            .where(ProductEvent.event_type == FIRST_VEHICLE_CREATED)
            .distinct()
        ).all()
    )
    first_financial_user_ids = set(
        db.scalars(
            select(ProductEvent.user_id)
            .where(ProductEvent.event_type == FIRST_FINANCIAL_ENTRY)
            .distinct()
        ).all()
    )

    return {
        "total_users": len(db.scalars(select(User.id)).all()),
        "active_users_7d": len(
            db.scalars(
                select(ProductEvent.user_id)
                .where(ProductEvent.occurred_at >= active_since)
                .distinct()
            ).all()
        ),
        "users_with_first_vehicle": len(first_vehicle_user_ids),
        "users_with_first_financial_entry": len(first_financial_user_ids),
        "users_completed_first_setup": len(first_vehicle_user_ids & first_financial_user_ids),
        "dashboard_viewed_users": count_distinct_event_users(db, DASHBOARD_VIEWED),
        "checkout_started_users": count_distinct_event_users(db, CHECKOUT_STARTED),
        "subscription_activated_users": count_distinct_event_users(db, SUBSCRIPTION_ACTIVATED),
        "feedback_count": len(db.scalars(select(BetaFeedback.id)).all()),
    }

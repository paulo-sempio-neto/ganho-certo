from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Plan, PlanFeature, Subscription, User

ACTIVE_SUBSCRIPTION_STATUSES = ("active", "trialing")


def get_active_subscription(user: User, db: Session) -> Subscription | None:
    now = datetime.now(UTC)
    return db.scalar(
        select(Subscription)
        .where(
            Subscription.user_id == user.id,
            Subscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
            or_(
                Subscription.current_period_end.is_(None),
                Subscription.current_period_end > now,
            ),
        )
        .options(
            selectinload(Subscription.plan)
            .selectinload(Plan.plan_features)
            .selectinload(PlanFeature.feature)
        )
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
    )


def has_active_subscription(user: User, db: Session) -> bool:
    return get_active_subscription(user, db) is not None


def get_effective_plan(user: User, db: Session) -> Plan:
    from app.entitlements import FREE_PLAN_CODE, ensure_default_entitlements

    ensure_default_entitlements(db)
    subscription = get_active_subscription(user, db)
    if subscription is not None and subscription.plan.active:
        return subscription.plan

    plan = db.scalar(
        select(Plan)
        .where(Plan.id == user.current_plan_id, Plan.active.is_(True))
        .options(selectinload(Plan.plan_features).selectinload(PlanFeature.feature))
    )
    if plan is not None:
        return plan

    default_plan = db.scalar(
        select(Plan)
        .where(Plan.code == FREE_PLAN_CODE, Plan.active.is_(True))
        .options(selectinload(Plan.plan_features).selectinload(PlanFeature.feature))
    )
    if default_plan is None:
        raise RuntimeError("Default plan is not configured.")

    user.current_plan_id = default_plan.id
    db.commit()
    db.refresh(user)
    return default_plan

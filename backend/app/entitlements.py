from dataclasses import dataclass

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Feature, Plan, PlanFeature, User

FREE_PLAN_CODE = "free"
PRO_PLAN_CODE = "pro"
VEHICLE_LIMIT_FEATURE = "vehicle_limit"
ADVANCED_HISTORY_FEATURE = "advanced_history"
CSV_IMPORT_FEATURE = "csv_import"
PLAN_LIMIT_REACHED_CODE = "plan_limit_reached"

DEFAULT_PLANS: tuple[dict[str, str], ...] = (
    {"code": FREE_PLAN_CODE, "name": "Free"},
    {"code": PRO_PLAN_CODE, "name": "Pro"},
)

DEFAULT_FEATURES: tuple[dict[str, str], ...] = (
    {"code": "vehicle_limit", "name": "Limite de veiculos"},
    {"code": "advanced_history", "name": "Historico avancado"},
    {"code": "csv_import", "name": "Importacao CSV"},
    {"code": "financial_insights", "name": "Insights financeiros"},
)

DEFAULT_PLAN_FEATURES: dict[str, dict[str, int | bool | None]] = {
    FREE_PLAN_CODE: {
        "vehicle_limit": 1,
        "advanced_history": False,
        "csv_import": False,
        "financial_insights": True,
    },
    PRO_PLAN_CODE: {
        "vehicle_limit": None,
        "advanced_history": True,
        "csv_import": True,
        "financial_insights": True,
    },
}


@dataclass(frozen=True)
class UsageLimitResult:
    allowed: bool
    limit: int | None
    current_usage: int


class PlanLimitReachedError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status.HTTP_403_FORBIDDEN
        self.code = PLAN_LIMIT_REACHED_CODE


def raise_plan_limit_reached(detail: str) -> None:
    raise PlanLimitReachedError(detail=detail)


def ensure_default_entitlements(db: Session) -> None:
    plans_by_code = {plan.code: plan for plan in db.scalars(select(Plan)).all()}
    for plan_data in DEFAULT_PLANS:
        if plan_data["code"] not in plans_by_code:
            plan = Plan(code=plan_data["code"], name=plan_data["name"], active=True)
            db.add(plan)
            plans_by_code[plan.code] = plan

    features_by_code = {feature.code: feature for feature in db.scalars(select(Feature)).all()}
    for feature_data in DEFAULT_FEATURES:
        if feature_data["code"] not in features_by_code:
            feature = Feature(
                code=feature_data["code"],
                name=feature_data["name"],
                active=True,
            )
            db.add(feature)
            features_by_code[feature.code] = feature

    db.flush()

    existing_plan_features = {
        (plan_feature.plan_id, plan_feature.feature_id)
        for plan_feature in db.scalars(select(PlanFeature)).all()
    }
    for plan_code, features in DEFAULT_PLAN_FEATURES.items():
        plan = plans_by_code[plan_code]
        for feature_code, value in features.items():
            feature = features_by_code[feature_code]
            if (plan.id, feature.id) in existing_plan_features:
                continue

            is_limit = isinstance(value, int) and not isinstance(value, bool)
            db.add(
                PlanFeature(
                    plan_id=plan.id,
                    feature_id=feature.id,
                    enabled=bool(value) if not is_limit else True,
                    limit_value=value if is_limit else None,
                )
            )

    free_plan = plans_by_code[FREE_PLAN_CODE]
    db.query(User).filter(User.current_plan_id.is_(None)).update(
        {User.current_plan_id: free_plan.id},
        synchronize_session=False,
    )
    db.commit()


def get_default_plan(db: Session) -> Plan:
    ensure_default_entitlements(db)
    plan = db.scalar(select(Plan).where(Plan.code == FREE_PLAN_CODE, Plan.active.is_(True)))
    if plan is None:
        raise RuntimeError("Default plan is not configured.")

    return plan


def get_user_plan(user: User, db: Session) -> Plan:
    ensure_default_entitlements(db)
    plan = db.scalar(
        select(Plan)
        .where(Plan.id == user.current_plan_id, Plan.active.is_(True))
        .options(selectinload(Plan.plan_features).selectinload(PlanFeature.feature))
    )
    if plan is not None:
        return plan

    plan = get_default_plan(db)
    user.current_plan_id = plan.id
    db.commit()
    db.refresh(user)
    return plan


def get_plan_feature(plan: Plan, feature_code: str) -> PlanFeature | None:
    for plan_feature in plan.plan_features:
        if plan_feature.feature.code == feature_code and plan_feature.feature.active:
            return plan_feature

    return None


def has_feature_access(user: User, feature_code: str, db: Session) -> bool:
    plan = get_user_plan(user, db)
    plan_feature = get_plan_feature(plan, feature_code)
    return bool(plan_feature and plan_feature.enabled)


def get_feature_limit(user: User, feature_code: str, db: Session) -> int | None:
    plan = get_user_plan(user, db)
    plan_feature = get_plan_feature(plan, feature_code)
    if plan_feature is None or not plan_feature.enabled:
        return None

    return plan_feature.limit_value


def check_usage_limit(
    user: User,
    feature_code: str,
    current_usage: int,
    db: Session,
) -> UsageLimitResult:
    limit = get_feature_limit(user, feature_code, db)
    return UsageLimitResult(
        allowed=limit is None or current_usage < limit,
        limit=limit,
        current_usage=current_usage,
    )


def get_user_feature_summary(user: User, db: Session) -> tuple[dict[str, bool], dict[str, int]]:
    plan = get_user_plan(user, db)
    features: dict[str, bool] = {}
    limits: dict[str, int] = {}

    for plan_feature in plan.plan_features:
        if not plan_feature.feature.active:
            continue

        if plan_feature.limit_value is None:
            features[plan_feature.feature.code] = plan_feature.enabled
        else:
            limits[plan_feature.feature.code] = plan_feature.limit_value

    return features, limits


def count_user_vehicles(user: User, db: Session) -> int:
    from app.models import Vehicle

    return int(
        db.scalar(select(func.count()).select_from(Vehicle).where(Vehicle.user_id == user.id)) or 0
    )

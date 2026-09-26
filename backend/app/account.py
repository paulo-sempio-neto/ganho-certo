from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.entitlements import get_user_feature_summary, get_user_plan
from app.models import User
from app.schemas import AccountPlanPublic, AccountPlanResponse

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/plan", response_model=AccountPlanResponse)
def read_account_plan(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AccountPlanResponse:
    plan = get_user_plan(current_user, db)
    features, limits = get_user_feature_summary(current_user, db)
    return AccountPlanResponse(
        current_plan=AccountPlanPublic(id=plan.id, name=plan.name, code=plan.code),
        features=features,
        limits=limits,
    )

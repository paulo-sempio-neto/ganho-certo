import hmac
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.product_events import get_beta_learning_counts
from app.schemas import BetaLearningSummary

router = APIRouter(prefix="/internal/beta", tags=["internal-beta"])


def get_app_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def require_beta_admin(
    request: Request,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> None:
    expected_token = settings.beta_admin_token
    if not expected_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    received_token = request.headers.get("X-Beta-Admin-Token", "")
    if not hmac.compare_digest(received_token, expected_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")


@router.get(
    "/summary",
    response_model=BetaLearningSummary,
    dependencies=[Depends(require_beta_admin)],
)
def read_beta_learning_summary(db: Annotated[Session, Depends(get_db)]) -> BetaLearningSummary:
    return BetaLearningSummary(**get_beta_learning_counts(db))

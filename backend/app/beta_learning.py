import hmac
from datetime import UTC, datetime
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.models import BetaFeedback
from app.product_events import get_beta_learning_counts
from app.schemas import (
    BetaFeedbackAdminPublic,
    BetaFeedbackAdminSummary,
    BetaFeedbackUpdate,
    BetaLearningSummary,
)

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


def count_feedback_by_field(db: Session, field: str) -> dict[str, int]:
    column = getattr(BetaFeedback, field)
    rows = db.execute(
        select(column, func.count(BetaFeedback.id)).group_by(column).order_by(column)
    ).all()
    return {str(value): int(count) for value, count in rows}


@router.get(
    "/feedback",
    response_model=BetaFeedbackAdminSummary,
    dependencies=[Depends(require_beta_admin)],
)
def read_beta_feedback_summary(db: Annotated[Session, Depends(get_db)]) -> BetaFeedbackAdminSummary:
    recent_feedback = list(
        db.scalars(
            select(BetaFeedback)
            .order_by(desc(BetaFeedback.created_at), desc(BetaFeedback.id))
            .limit(20)
        ).all()
    )
    return BetaFeedbackAdminSummary(
        total_feedback=len(db.scalars(select(BetaFeedback.id)).all()),
        open_feedback=len(
            db.scalars(
                select(BetaFeedback.id).where(BetaFeedback.status.in_(("open", "reviewing")))
            ).all()
        ),
        by_category=count_feedback_by_field(db, "category"),
        by_status=count_feedback_by_field(db, "status"),
        by_priority=count_feedback_by_field(db, "priority"),
        recent_feedback=[BetaFeedbackAdminPublic.model_validate(item) for item in recent_feedback],
    )


@router.patch(
    "/feedback/{feedback_id}",
    response_model=BetaFeedbackAdminPublic,
    dependencies=[Depends(require_beta_admin)],
)
def update_beta_feedback(
    feedback_id: int,
    payload: BetaFeedbackUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> BetaFeedbackAdminPublic:
    feedback = db.get(BetaFeedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found.")

    if payload.category is not None:
        feedback.category = payload.category
    if payload.priority is not None:
        feedback.priority = payload.priority
    if payload.status is not None:
        feedback.status = payload.status
        feedback.resolved_at = datetime.now(UTC) if payload.status == "resolved" else None

    db.commit()
    db.refresh(feedback)
    return BetaFeedbackAdminPublic.model_validate(feedback)

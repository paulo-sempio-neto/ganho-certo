from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BetaFeedback, User
from app.product_events import FEEDBACK_SENT, record_product_event
from app.schemas import BetaFeedbackCreate, BetaFeedbackPublic

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=BetaFeedbackPublic, status_code=status.HTTP_201_CREATED)
def create_beta_feedback(
    payload: BetaFeedbackCreate,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BetaFeedback:
    feedback = BetaFeedback(
        user_id=current_user.id,
        category=payload.category,
        message=payload.message,
        path=payload.path,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    record_product_event(
        db=db,
        user=current_user,
        event_type=FEEDBACK_SENT,
        dedupe_key=str(feedback.id),
    )
    return feedback

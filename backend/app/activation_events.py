from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, WorkSession
from app.product_events import FIRST_RESULT_VIEWED, record_once_per_user_event

router = APIRouter(prefix="/product-events", tags=["product-events"])


@router.post("/first-result-viewed", status_code=status.HTTP_204_NO_CONTENT)
async def record_first_result_viewed(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    if await request.body():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Event payload not allowed."
        )

    work_session_id = db.scalar(
        select(WorkSession.id).where(WorkSession.user_id == current_user.id).limit(1)
    )
    if work_session_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No workday recorded.")

    record_once_per_user_event(db=db, user=current_user, event_type=FIRST_RESULT_VIEWED)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

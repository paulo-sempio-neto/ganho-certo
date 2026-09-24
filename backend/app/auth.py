from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.rate_limit import (
    auth_rate_limiter,
    enforce_auth_rate_limit,
    login_identity_rate_limit_key,
    login_ip_rate_limit_key,
    register_rate_limit_key,
)
from app.schemas import TokenResponse, UserLogin, UserPublic, UserRegister
from app.security import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def invalid_credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_request_settings(request: Request) -> Settings:
    settings = getattr(request.app.state, "settings", None)
    if isinstance(settings, Settings):
        return settings

    return get_settings()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register_user(
    request: Request,
    payload: UserRegister,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    settings = get_request_settings(request)
    enforce_auth_rate_limit(
        register_rate_limit_key(request),
        limit=settings.auth_register_rate_limit,
        window_seconds=settings.auth_register_rate_window_seconds,
        settings=settings,
    )

    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    user = User(
        name=payload.name,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        ) from exc

    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login_user(
    request: Request,
    payload: UserLogin,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    settings = get_request_settings(request)
    identity_key = login_identity_rate_limit_key(request, str(payload.email))
    enforce_auth_rate_limit(
        login_ip_rate_limit_key(request),
        limit=settings.auth_login_ip_rate_limit,
        window_seconds=settings.auth_login_rate_window_seconds,
        settings=settings,
    )
    enforce_auth_rate_limit(
        identity_key,
        limit=settings.auth_login_rate_limit,
        window_seconds=settings.auth_login_rate_window_seconds,
        settings=settings,
    )

    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials_exception()

    auth_rate_limiter.clear(identity_key)
    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not isinstance(subject, str):
            raise invalid_credentials_exception()
        user_id = int(subject)
    except (ValueError, jwt.InvalidTokenError) as exc:
        raise invalid_credentials_exception() from exc

    user = db.get(User, user_id)
    if user is None:
        raise invalid_credentials_exception()

    return user


@router.get("/me", response_model=UserPublic)
def read_current_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user

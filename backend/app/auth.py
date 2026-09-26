from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.email import EmailDeliveryError, build_password_reset_url, get_password_reset_email_sender
from app.models import PasswordResetToken, User
from app.observability import log_exception
from app.rate_limit import (
    auth_rate_limiter,
    enforce_auth_rate_limit,
    login_identity_rate_limit_key,
    login_ip_rate_limit_key,
    password_reset_rate_limit_key,
    register_rate_limit_key,
)
from app.schemas import (
    MessageResponse,
    PasswordChangeRequest,
    PasswordForgotRequest,
    PasswordResetRequest,
    TokenResponse,
    UserLogin,
    UserPublic,
    UserRegister,
)
from app.security import (
    create_access_token,
    decode_access_token,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)

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
    token = create_access_token(subject=str(user.id), auth_version=user.auth_version)
    return TokenResponse(access_token=token)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        token_auth_version = payload.get("auth_version", 0)
        if not isinstance(subject, str):
            raise invalid_credentials_exception()
        user_id = int(subject)
        token_auth_version = int(token_auth_version)
    except (ValueError, jwt.InvalidTokenError) as exc:
        raise invalid_credentials_exception() from exc

    user = db.get(User, user_id)
    if user is None:
        raise invalid_credentials_exception()

    if user.auth_version != token_auth_version:
        raise invalid_credentials_exception()

    return user


@router.get("/me", response_model=UserPublic)
def read_current_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


def password_reset_public_response() -> MessageResponse:
    return MessageResponse(
        message="Se o email estiver cadastrado, enviaremos instrucoes para redefinir a senha.",
    )


def is_password_reset_token_expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    return expires_at <= now


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: PasswordChangeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual invalida.",
        )

    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ser diferente da senha atual.",
        )

    db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(
            password_hash=hash_password(payload.new_password),
            auth_version=User.auth_version + 1,
        )
    )
    db.commit()
    return MessageResponse(message="Senha alterada com sucesso.")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    request: Request,
    payload: PasswordForgotRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    settings = get_request_settings(request)
    enforce_auth_rate_limit(
        password_reset_rate_limit_key(request),
        limit=settings.auth_register_rate_limit,
        window_seconds=settings.auth_register_rate_window_seconds,
        settings=settings,
    )

    try:
        sender = get_password_reset_email_sender(settings)
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recuperacao de senha indisponivel no momento.",
        ) from exc

    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        return password_reset_public_response()

    now = datetime.now(UTC)
    raw_token = generate_secure_token()
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=now + timedelta(minutes=settings.password_reset_token_expire_minutes),
    )
    db.add(reset_token)

    try:
        sender.send_password_reset(
            recipient_email=user.email,
            reset_url=build_password_reset_url(settings, raw_token),
        )
        db.commit()
    except EmailDeliveryError as error:
        db.rollback()
        log_exception(request, error, event="password_reset_delivery_failed")

    return password_reset_public_response()


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    now = datetime.now(UTC)
    reset_token = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(payload.token))
    )
    if (
        reset_token is None
        or reset_token.used_at is not None
        or is_password_reset_token_expired(reset_token.expires_at, now)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de redefinicao invalido ou expirado.",
        )

    user = db.get(User, reset_token.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de redefinicao invalido ou expirado.",
        )

    reset_token.used_at = now
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            password_hash=hash_password(payload.new_password),
            auth_version=User.auth_version + 1,
        )
    )
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != reset_token.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    db.commit()
    return MessageResponse(message="Senha redefinida com sucesso.")

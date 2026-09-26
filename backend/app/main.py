from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.account import router as account_router
from app.auth import router as auth_router
from app.config import Settings, get_settings
from app.database import get_db
from app.entitlements import PlanLimitReachedError
from app.expense_imports import router as expense_imports_router
from app.expenses import router as expenses_router
from app.financial_goals import router as financial_goals_router
from app.financial_history import router as financial_history_router
from app.financial_insights import router as financial_insights_router
from app.financial_summary import router as financial_summary_router
from app.import_profiles import router as import_profiles_router
from app.maintenance import router as maintenance_router
from app.observability import (
    configure_logging,
    log_exception,
    request_logging_middleware,
    safe_errors_middleware,
)
from app.recurring_expenses import router as recurring_expenses_router
from app.request_limits import RequestSizeLimitMiddleware
from app.vehicle_cost_profiles import router as vehicle_cost_profiles_router
from app.vehicles import router as vehicles_router
from app.work_patterns import router as work_patterns_router
from app.work_session_imports import router as work_session_imports_router
from app.work_sessions import router as work_sessions_router


def docs_enabled(settings: Settings) -> bool:
    return settings.app_env.lower() not in {"production", "prod"}


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    configure_logging()
    enable_docs = docs_enabled(app_settings)
    application = FastAPI(
        title=app_settings.app_name,
        docs_url="/docs" if enable_docs else None,
        redoc_url="/redoc" if enable_docs else None,
        openapi_url="/openapi.json" if enable_docs else None,
    )
    application.state.settings = app_settings
    application.middleware("http")(safe_errors_middleware)
    application.add_middleware(
        RequestSizeLimitMiddleware, max_bytes=app_settings.max_request_body_bytes,
    )
    application.add_middleware(
        TrustedHostMiddleware, allowed_hosts=app_settings.trusted_hosts, www_redirect=False,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    application.middleware("http")(request_logging_middleware)

    @application.exception_handler(PlanLimitReachedError)
    def plan_limit_reached_handler(
        _request: Request,
        exc: PlanLimitReachedError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "detail": exc.detail},
        )

    application.include_router(auth_router)
    application.include_router(account_router)
    application.include_router(vehicles_router)
    application.include_router(vehicle_cost_profiles_router)
    application.include_router(work_sessions_router)
    application.include_router(work_session_imports_router)
    application.include_router(expense_imports_router)
    application.include_router(import_profiles_router)
    application.include_router(expenses_router)
    application.include_router(recurring_expenses_router)
    application.include_router(maintenance_router)
    application.include_router(financial_goals_router)
    application.include_router(financial_history_router)
    application.include_router(financial_insights_router)
    application.include_router(financial_summary_router)
    application.include_router(work_patterns_router)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/ready")
    def ready(request: Request, db: Annotated[Session, Depends(get_db)]) -> JSONResponse:
        try:
            db.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            log_exception(request, error)
            return JSONResponse({"status": "unavailable"}, status_code=503)
        return JSONResponse({"status": "ready"})

    return application


app = create_app()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.config import Settings, get_settings
from app.expense_imports import router as expense_imports_router
from app.expenses import router as expenses_router
from app.financial_goals import router as financial_goals_router
from app.financial_insights import router as financial_insights_router
from app.financial_summary import router as financial_summary_router
from app.import_profiles import router as import_profiles_router
from app.maintenance import router as maintenance_router
from app.recurring_expenses import router as recurring_expenses_router
from app.vehicle_cost_profiles import router as vehicle_cost_profiles_router
from app.vehicles import router as vehicles_router
from app.work_session_imports import router as work_session_imports_router
from app.work_sessions import router as work_sessions_router


def docs_enabled(settings: Settings) -> bool:
    return settings.app_env.lower() not in {"production", "prod"}


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    enable_docs = docs_enabled(app_settings)
    application = FastAPI(
        title=app_settings.app_name,
        docs_url="/docs" if enable_docs else None,
        redoc_url="/redoc" if enable_docs else None,
        openapi_url="/openapi.json" if enable_docs else None,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(auth_router)
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
    application.include_router(financial_insights_router)
    application.include_router(financial_summary_router)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()

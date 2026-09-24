from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.config import get_settings
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

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(vehicle_cost_profiles_router)
app.include_router(work_sessions_router)
app.include_router(work_session_imports_router)
app.include_router(expense_imports_router)
app.include_router(import_profiles_router)
app.include_router(expenses_router)
app.include_router(recurring_expenses_router)
app.include_router(maintenance_router)
app.include_router(financial_goals_router)
app.include_router(financial_insights_router)
app.include_router(financial_summary_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

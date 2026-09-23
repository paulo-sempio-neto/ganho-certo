from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.config import get_settings
from app.expenses import router as expenses_router
from app.vehicles import router as vehicles_router
from app.work_sessions import router as work_sessions_router

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.backend_cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(work_sessions_router)
app.include_router(expenses_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

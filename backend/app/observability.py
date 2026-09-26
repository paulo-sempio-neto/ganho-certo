import json
import logging
import re
import traceback
from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import RequestResponseEndpoint

logger = logging.getLogger("app.api")
REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        fields = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        fields.update(getattr(record, "fields", {}))
        return json.dumps(fields, ensure_ascii=True)


def configure_logging() -> None:
    # Own handler: independent of Uvicorn/root logging configuration, idempotent.
    if not any(isinstance(handler.formatter, JsonLogFormatter) for handler in logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(JsonLogFormatter())
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def log_exception(
    request: Request, error: Exception, *, event: str = "unexpected_exception",
) -> None:
    # Exception strings, source lines and locals can contain SQL, credentials or tokens.
    # Keep the traceback locations and types, never the exception messages.
    frames = traceback.extract_tb(error.__traceback__)
    logger.error(
        "%s request_id=%s", event, request.state.request_id,
        extra={"fields": {
            "request_id": request.state.request_id,
            "exception_type": type(error).__name__,
            "stack_trace": [
                {"file": frame.filename, "line": frame.lineno, "function": frame.name}
                for frame in frames
            ],
        }},
    )


def unexpected_error_response(request: Request, error: Exception) -> JSONResponse:
    log_exception(request, error)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Erro interno inesperado. Informe o codigo da requisicao ao suporte.",
            "request_id": request.state.request_id,
        },
    )


async def safe_errors_middleware(
    request: Request, call_next: RequestResponseEndpoint,
) -> Response:
    # Inside CORS so even unexpected errors retain the configured CORS policy.
    try:
        return await call_next(request)
    except Exception as error:
        return unexpected_error_response(request, error)


async def request_logging_middleware(
    request: Request, call_next: RequestResponseEndpoint,
) -> Response:
    incoming_id = request.headers.get("X-Request-ID", "")
    request_id = incoming_id if REQUEST_ID_PATTERN.fullmatch(incoming_id) else str(uuid4())
    request.state.request_id = request_id
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        response = unexpected_error_response(request, error)

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # Route templates exclude user values; unmatched paths may themselves contain secrets.
    route = request.scope.get("route")
    logger.info("api_request", extra={"fields": {
        "request_id": request_id,
        "method": request.method,
        "path": getattr(route, "path", "/<unmatched>"),
        "status_code": response.status_code,
        "duration_ms": round((perf_counter() - started_at) * 1000, 2),
    }})
    return response

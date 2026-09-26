from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# These four raw CSV routes already enforce their own streaming 1 MiB limit.
CSV_PATHS = {
    "/imports/work-sessions", "/imports/work-sessions/preview",
    "/imports/expenses", "/imports/expenses/preview",
}


class RequestSizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"] in CSV_PATHS:
            await self.app(scope, receive, send)
            return

        # Count actual bytes, including chunked requests and dishonest Content-Length.
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                response = JSONResponse({"detail": "Request body too large."}, status_code=413)
                await response(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        sent = False

        async def replay() -> Message:
            nonlocal sent
            if sent:
                return await receive()
            sent = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, send)

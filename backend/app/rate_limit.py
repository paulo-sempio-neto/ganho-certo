from dataclasses import dataclass
from time import monotonic
from typing import Protocol

from fastapi import HTTPException, Request, status

from app.config import Settings


class Clock(Protocol):
    def __call__(self) -> float: ...


@dataclass
class RateLimitBucket:
    count: int
    reset_at: float


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


class InMemoryRateLimiter:
    """Small process-local limiter for the closed-beta deployment model."""

    def __init__(self, clock: Clock = monotonic) -> None:
        self._clock = clock
        self._buckets: dict[str, RateLimitBucket] = {}

    def reset(self) -> None:
        self._buckets.clear()

    def set_clock(self, clock: Clock) -> None:
        self._clock = clock

    def hit(
        self,
        key: str,
        *,
        limit: int,
        window_seconds: int,
        max_entries: int,
    ) -> RateLimitResult:
        if limit <= 0:
            return RateLimitResult(allowed=True, retry_after_seconds=0)

        now = self._clock()
        self._cleanup(now=now, max_entries=max_entries)

        bucket = self._buckets.get(key)
        if bucket is None or bucket.reset_at <= now:
            self._buckets[key] = RateLimitBucket(count=1, reset_at=now + window_seconds)
            return RateLimitResult(allowed=True, retry_after_seconds=0)

        if bucket.count >= limit:
            retry_after = max(1, int(bucket.reset_at - now))
            return RateLimitResult(allowed=False, retry_after_seconds=retry_after)

        bucket.count += 1
        return RateLimitResult(allowed=True, retry_after_seconds=0)

    def clear(self, key: str) -> None:
        self._buckets.pop(key, None)

    def _cleanup(self, *, now: float, max_entries: int) -> None:
        expired_keys = [key for key, bucket in self._buckets.items() if bucket.reset_at <= now]
        for key in expired_keys:
            self._buckets.pop(key, None)

        if len(self._buckets) <= max_entries:
            return

        keys_by_oldest_reset = sorted(self._buckets, key=lambda key: self._buckets[key].reset_at)
        keys_to_remove = keys_by_oldest_reset[: len(self._buckets) - max_entries]
        for key in keys_to_remove:
            self._buckets.pop(key, None)


auth_rate_limiter = InMemoryRateLimiter()


def get_client_ip(request: Request) -> str:
    if request.client is None:
        return "unknown"

    return request.client.host


def login_ip_rate_limit_key(request: Request) -> str:
    return f"auth:login:ip:{get_client_ip(request)}"


def login_identity_rate_limit_key(request: Request, normalized_email: str) -> str:
    return f"{login_ip_rate_limit_key(request)}:email:{normalized_email}"


def register_rate_limit_key(request: Request) -> str:
    return f"auth:register:ip:{get_client_ip(request)}"


def password_reset_rate_limit_key(request: Request) -> str:
    return f"auth:password-reset:ip:{get_client_ip(request)}"


def reject_rate_limited(retry_after_seconds: int) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Muitas tentativas. Aguarde alguns instantes e tente novamente.",
        headers={"Retry-After": str(retry_after_seconds)},
    )


def enforce_auth_rate_limit(
    key: str,
    *,
    limit: int,
    window_seconds: int,
    settings: Settings,
) -> None:
    result = auth_rate_limiter.hit(
        key,
        limit=limit,
        window_seconds=window_seconds,
        max_entries=settings.auth_rate_limit_max_entries,
    )
    if not result.allowed:
        reject_rate_limited(result.retry_after_seconds)


def reset_auth_rate_limit_state() -> None:
    auth_rate_limiter.reset()
    auth_rate_limiter.set_clock(monotonic)

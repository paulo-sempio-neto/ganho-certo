import os

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_with_at_least_32_chars")
os.environ.setdefault("AUTH_LOGIN_RATE_LIMIT", "10000")
os.environ.setdefault("AUTH_LOGIN_IP_RATE_LIMIT", "10000")
os.environ.setdefault("AUTH_REGISTER_RATE_LIMIT", "10000")


@pytest.fixture(autouse=True)
def reset_auth_rate_limit() -> None:
    from app.rate_limit import reset_auth_rate_limit_state

    reset_auth_rate_limit_state()

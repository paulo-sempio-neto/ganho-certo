from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.entitlements import (
    check_usage_limit,
    get_feature_limit,
    has_feature_access,
)
from app.main import app
from app.models import Feature, Plan, Subscription, User
from app.subscriptions import (
    get_active_subscription,
    get_effective_plan,
    has_active_subscription,
)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_and_login(client: TestClient, email: str = "paulo@email.com") -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201
    login_response = client.post("/auth/login", json={"email": email, "password": "senha123"})
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as session:
        yield session

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_account_plan_defaults_to_free(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client)
    user = db_session.scalar(select(User).where(User.email == "paulo@email.com"))

    response = client.get("/account/plan", headers=auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert body["current_plan"]["name"] == "Free"
    assert body["current_plan"]["code"] == "free"
    assert body["features"] == {
        "advanced_history": False,
        "csv_import": False,
        "financial_insights": True,
    }
    assert body["limits"] == {"vehicle_limit": 1}
    assert body["subscription"] is None
    assert user is not None
    assert user.current_plan_id == body["current_plan"]["id"]


def test_feature_access_and_limits_use_plan_features(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client)
    user = db_session.scalar(select(User).where(User.email == "paulo@email.com"))
    assert user is not None

    assert has_feature_access(user, "financial_insights", db_session)
    assert not has_feature_access(user, "csv_import", db_session)
    assert get_feature_limit(user, "vehicle_limit", db_session) == 1
    assert check_usage_limit(user, "vehicle_limit", 0, db_session).allowed
    assert not check_usage_limit(user, "vehicle_limit", 1, db_session).allowed

    pro_plan = db_session.scalar(select(Plan).where(Plan.code == "pro"))
    assert pro_plan is not None
    user.current_plan_id = pro_plan.id
    db_session.commit()

    response = client.get("/account/plan", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["current_plan"]["code"] == "pro"
    assert response.json()["features"]["csv_import"] is True
    assert "vehicle_limit" not in response.json()["limits"]
    assert response.json()["subscription"] is None


def test_active_subscription_becomes_effective_plan(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, email="assinante@email.com")
    user = db_session.scalar(select(User).where(User.email == "assinante@email.com"))
    pro_plan = db_session.scalar(select(Plan).where(Plan.code == "pro"))
    assert user is not None
    assert pro_plan is not None
    now = datetime.now(UTC)
    subscription = Subscription(
        user_id=user.id,
        plan_id=pro_plan.id,
        status="active",
        provider="internal",
        external_subscription_id=None,
        started_at=now,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        created_at=now,
        updated_at=now,
    )
    db_session.add(subscription)
    db_session.commit()

    effective_plan = get_effective_plan(user, db_session)
    response = client.get("/account/plan", headers=auth_headers(token))

    assert effective_plan.code == "pro"
    assert has_active_subscription(user, db_session)
    assert has_feature_access(user, "csv_import", db_session)
    assert response.status_code == 200
    assert response.json()["current_plan"]["code"] == "pro"
    assert response.json()["subscription"]["status"] == "active"
    assert response.json()["subscription"]["provider"] == "internal"
    assert response.json()["subscription"]["period_end"] is not None


def test_canceled_subscription_does_not_override_current_plan(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, email="cancelado@email.com")
    user = db_session.scalar(select(User).where(User.email == "cancelado@email.com"))
    pro_plan = db_session.scalar(select(Plan).where(Plan.code == "pro"))
    assert user is not None
    assert pro_plan is not None
    now = datetime.now(UTC)
    db_session.add(
        Subscription(
            user_id=user.id,
            plan_id=pro_plan.id,
            status="canceled",
            provider="internal",
            external_subscription_id=None,
            started_at=now - timedelta(days=30),
            current_period_start=now - timedelta(days=30),
            current_period_end=now + timedelta(days=1),
            canceled_at=now,
            created_at=now,
            updated_at=now,
        )
    )
    db_session.commit()

    response = client.get("/account/plan", headers=auth_headers(token))

    assert get_active_subscription(user, db_session) is None
    assert get_effective_plan(user, db_session).code == "free"
    assert not has_active_subscription(user, db_session)
    assert not has_feature_access(user, "csv_import", db_session)
    assert response.status_code == 200
    assert response.json()["current_plan"]["code"] == "free"
    assert response.json()["subscription"] is None


def test_subscription_effective_plan_is_isolated_between_users(
    client: TestClient,
    db_session: Session,
) -> None:
    user_a_token = register_and_login(client, email="assinante-a@email.com")
    user_b_token = register_and_login(client, email="assinante-b@email.com")
    user_a = db_session.scalar(select(User).where(User.email == "assinante-a@email.com"))
    user_b = db_session.scalar(select(User).where(User.email == "assinante-b@email.com"))
    pro_plan = db_session.scalar(select(Plan).where(Plan.code == "pro"))
    assert user_a is not None
    assert user_b is not None
    assert pro_plan is not None
    now = datetime.now(UTC)
    db_session.add(
        Subscription(
            user_id=user_a.id,
            plan_id=pro_plan.id,
            status="trialing",
            provider="internal",
            external_subscription_id=None,
            started_at=now,
            current_period_start=now,
            current_period_end=None,
            created_at=now,
            updated_at=now,
        )
    )
    db_session.commit()

    user_a_response = client.get("/account/plan", headers=auth_headers(user_a_token))
    user_b_response = client.get("/account/plan", headers=auth_headers(user_b_token))

    assert user_a_response.status_code == 200
    assert user_b_response.status_code == 200
    assert user_a_response.json()["current_plan"]["code"] == "pro"
    assert user_a_response.json()["subscription"]["status"] == "trialing"
    assert user_b_response.json()["current_plan"]["code"] == "free"
    assert user_b_response.json()["subscription"] is None
    assert get_effective_plan(user_a, db_session).code == "pro"
    assert get_effective_plan(user_b, db_session).code == "free"


def test_account_plan_is_isolated_between_users(
    client: TestClient,
    db_session: Session,
) -> None:
    paulo_token = register_and_login(client, email="paulo@email.com")
    ana_token = register_and_login(client, email="ana@email.com")
    ana = db_session.scalar(select(User).where(User.email == "ana@email.com"))
    pro_plan = db_session.scalar(select(Plan).where(Plan.code == "pro"))
    assert ana is not None
    assert pro_plan is not None
    ana.current_plan_id = pro_plan.id
    db_session.commit()

    paulo_response = client.get("/account/plan", headers=auth_headers(paulo_token))
    ana_response = client.get("/account/plan", headers=auth_headers(ana_token))

    assert paulo_response.status_code == 200
    assert ana_response.status_code == 200
    assert {"current_plan", "features", "limits", "subscription"} <= set(paulo_response.json())
    assert paulo_response.json()["current_plan"]["code"] == "free"
    assert ana_response.json()["current_plan"]["code"] == "pro"


def test_entitlement_migration_backfills_existing_users() -> None:
    engine = create_engine("sqlite://", poolclass=StaticPool)
    metadata = MetaData()
    users = Table(
        "users",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String(120), nullable=False),
        Column("email", String(255), nullable=False),
        Column("password_hash", String(255), nullable=False),
        Column("auth_version", Integer, nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=False),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            users.insert().values(
                name="Usuario legado",
                email="legado@email.com",
                password_hash="hash",
                auth_version=0,
                created_at=datetime(2026, 9, 26, tzinfo=UTC),
            )
        )
        context = MigrationContext.configure(connection)
        migration_path = (
            Path(__file__).resolve().parents[1]
            / "alembic"
            / "versions"
            / "20260926_0015_create_entitlement_tables.py"
        )
        spec = spec_from_file_location("entitlement_migration", migration_path)
        assert spec is not None
        assert spec.loader is not None
        migration = module_from_spec(spec)
        spec.loader.exec_module(migration)

        with Operations.context(context):
            migration.upgrade()

        plan_code = connection.execute(
            select(Plan.code).select_from(Plan).join(User, User.current_plan_id == Plan.id)
        ).scalar_one()
        feature_codes = set(connection.execute(select(Feature.code)).scalars().all())

    assert plan_code == "free"
    assert {
        "vehicle_limit",
        "advanced_history",
        "csv_import",
        "financial_insights",
    } <= feature_codes

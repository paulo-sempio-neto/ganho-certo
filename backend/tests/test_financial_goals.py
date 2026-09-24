from collections.abc import Generator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import financial_goals as financial_goals_module
from app.database import Base, get_db
from app.main import app
from app.models import FinancialGoal


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


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_and_login(client: TestClient, email: str) -> str:
    register_response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": email, "password": "senha123"},
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": "senha123"},
    )
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def create_vehicle(client: TestClient, token: str, name: str = "Carro") -> int:
    response = client.post(
        "/vehicles",
        json={
            "name": name,
            "brand": "Toyota",
            "model": "Corolla",
            "year": 2022,
            "fuel_type": "flex",
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def create_work_session(
    client: TestClient,
    token: str,
    vehicle_id: int,
    work_date: date,
    gross_revenue: str,
    worked_minutes: int = 60,
) -> None:
    response = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": work_date.isoformat(),
            "gross_revenue": gross_revenue,
            "distance_km": "10.00",
            "worked_minutes": worked_minutes,
            "trip_count": 1,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def create_expense(
    client: TestClient,
    token: str,
    expense_date: date,
    amount: str,
    vehicle_id: int | None = None,
) -> None:
    response = client.post(
        "/expenses",
        json={
            "vehicle_id": vehicle_id,
            "expense_date": expense_date.isoformat(),
            "category": "fuel",
            "amount": amount,
            "description": None,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def create_recurring_expense(
    client: TestClient,
    token: str,
    amount: str,
    start_date: date,
) -> None:
    response = client.post(
        "/recurring-expenses",
        json={
            "vehicle_id": None,
            "category": "parking",
            "amount": amount,
            "frequency": "monthly",
            "start_date": start_date.isoformat(),
            "end_date": None,
            "description": None,
            "active": True,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def goal_payload(
    vehicle_id: int | None = None,
    goal_type: str = "net",
    target_amount: str = "1000.00",
    start_date: date | None = None,
    end_date: date | None = None,
    active: bool = True,
) -> dict[str, object]:
    today = date.today()
    return {
        "vehicle_id": vehicle_id,
        "goal_type": goal_type,
        "target_amount": target_amount,
        "start_date": (start_date or today).isoformat(),
        "end_date": (end_date or today + timedelta(days=9)).isoformat(),
        "active": active,
    }


def create_goal(
    client: TestClient,
    token: str,
    vehicle_id: int | None = None,
    goal_type: str = "net",
    target_amount: str = "1000.00",
    start_date: date | None = None,
    end_date: date | None = None,
    active: bool = True,
) -> int:
    response = client.post(
        "/financial-goals",
        json=goal_payload(
            vehicle_id=vehicle_id,
            goal_type=goal_type,
            target_amount=target_amount,
            start_date=start_date,
            end_date=end_date,
            active=active,
        ),
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_create_goal(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.post(
        "/financial-goals",
        json=goal_payload(vehicle_id=vehicle_id, target_amount="1234.56"),
        headers=auth_headers(token),
    )
    goal = db_session.scalar(select(FinancialGoal))

    assert response.status_code == 201
    assert response.json()["target_amount"] == "1234.56"
    assert response.json()["goal_type"] == "net"
    assert response.json()["vehicle_id"] == vehicle_id
    assert "user_id" not in response.json()
    assert goal is not None
    assert goal.target_amount_cents == 123456


def test_list_edit_and_delete_goal(client: TestClient) -> None:
    token = register_and_login(client, "crud@email.com")
    goal_id = create_goal(client, token)
    update_payload = goal_payload(goal_type="projected", target_amount="500.00", active=False)

    list_response = client.get("/financial-goals", headers=auth_headers(token))
    get_response = client.get(f"/financial-goals/{goal_id}", headers=auth_headers(token))
    update_response = client.put(
        f"/financial-goals/{goal_id}",
        json=update_payload,
        headers=auth_headers(token),
    )
    delete_response = client.delete(f"/financial-goals/{goal_id}", headers=auth_headers(token))
    get_deleted_response = client.get(f"/financial-goals/{goal_id}", headers=auth_headers(token))

    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert get_response.status_code == 200
    assert update_response.status_code == 200
    assert update_response.json()["goal_type"] == "projected"
    assert update_response.json()["target_amount"] == "500.00"
    assert update_response.json()["active"] is False
    assert delete_response.status_code == 204
    assert get_deleted_response.status_code == 404


def test_goal_isolation_between_users(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    goal_id = create_goal(client, user_b_token)

    get_response = client.get(f"/financial-goals/{goal_id}", headers=auth_headers(user_a_token))
    update_response = client.put(
        f"/financial-goals/{goal_id}",
        json=goal_payload(),
        headers=auth_headers(user_a_token),
    )
    delete_response = client.delete(
        f"/financial-goals/{goal_id}",
        headers=auth_headers(user_a_token),
    )

    assert get_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404


def test_reject_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "vehicle-a@email.com")
    user_b_token = register_and_login(client, "vehicle-b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.post(
        "/financial-goals",
        json=goal_payload(vehicle_id=user_b_vehicle),
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_reject_invalid_target_and_dates(client: TestClient) -> None:
    token = register_and_login(client, "invalid@email.com")
    today = date.today()

    invalid_target_response = client.post(
        "/financial-goals",
        json=goal_payload(target_amount="0"),
        headers=auth_headers(token),
    )
    invalid_date_response = client.post(
        "/financial-goals",
        json=goal_payload(start_date=today, end_date=today - timedelta(days=1)),
        headers=auth_headers(token),
    )

    assert invalid_target_response.status_code == 422
    assert invalid_date_response.status_code == 422


def test_reject_duplicate_active_goal_for_same_combination(client: TestClient) -> None:
    token = register_and_login(client, "duplicate@email.com")
    create_goal(client, token)

    duplicate_response = client.post(
        "/financial-goals",
        json=goal_payload(target_amount="2000.00"),
        headers=auth_headers(token),
    )
    inactive_response = client.post(
        "/financial-goals",
        json=goal_payload(target_amount="2000.00", active=False),
        headers=auth_headers(token),
    )

    assert duplicate_response.status_code == 409
    assert inactive_response.status_code == 201


def test_database_rejects_duplicate_active_goal_without_vehicle(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = register_and_login(client, "duplicate-db-no-vehicle@email.com")
    create_goal(client, token)
    monkeypatch.setattr(
        financial_goals_module,
        "ensure_single_active_goal",
        lambda *args, **kwargs: None,
    )

    response = client.post(
        "/financial-goals",
        json=goal_payload(target_amount="2000.00"),
        headers=auth_headers(token),
    )
    goals = db_session.scalars(select(FinancialGoal)).all()

    assert response.status_code == 409
    assert (
        response.json()["detail"]
        == "An active goal already exists for this vehicle and goal type."
    )
    assert len(goals) == 1


def test_database_rejects_duplicate_active_goal_with_vehicle(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = register_and_login(client, "duplicate-db-vehicle@email.com")
    vehicle_id = create_vehicle(client, token)
    create_goal(client, token, vehicle_id=vehicle_id)
    monkeypatch.setattr(
        financial_goals_module,
        "ensure_single_active_goal",
        lambda *args, **kwargs: None,
    )

    response = client.post(
        "/financial-goals",
        json=goal_payload(vehicle_id=vehicle_id, target_amount="2000.00"),
        headers=auth_headers(token),
    )
    goals = db_session.scalars(select(FinancialGoal)).all()

    assert response.status_code == 409
    assert (
        response.json()["detail"]
        == "An active goal already exists for this vehicle and goal type."
    )
    assert len(goals) == 1


def test_progress_net_goal_partially_reached_with_required_pace_and_hours(
    client: TestClient,
) -> None:
    token = register_and_login(client, "progress-net@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    start_date = today - timedelta(days=4)
    end_date = today + timedelta(days=5)
    for day_offset in range(5):
        create_work_session(
            client,
            token,
            vehicle_id,
            start_date + timedelta(days=day_offset),
            "120.00",
        )
    create_expense(client, token, today, "100.00", vehicle_id)
    goal_id = create_goal(
        client,
        token,
        vehicle_id=vehicle_id,
        target_amount="1000.00",
        start_date=start_date,
        end_date=end_date,
    )

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["target_amount"] == "1000.00"
    assert response.json()["current_amount"] == "500.00"
    assert response.json()["remaining_amount"] == "500.00"
    assert response.json()["progress_percentage"] == "50.00"
    assert response.json()["days_total"] == 10
    assert response.json()["days_elapsed"] == 5
    assert response.json()["days_remaining"] == 5
    assert response.json()["required_daily_amount"] == "100.00"
    assert response.json()["projected_completion_amount"] == "1000.00"
    assert response.json()["average_net_per_hour"] == "100.00"
    assert response.json()["average_projected_per_hour"] is None
    assert response.json()["estimated_hours_remaining"] == "5.00"
    assert response.json()["on_track"] is True


def test_progress_projected_goal_uses_projected_economic_result(client: TestClient) -> None:
    token = register_and_login(client, "progress-projected@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    start_date = today
    end_date = today + timedelta(days=9)
    create_work_session(client, token, vehicle_id, today, "1000.00", worked_minutes=600)
    create_recurring_expense(client, token, "100.00", today)
    goal_id = create_goal(
        client,
        token,
        goal_type="projected",
        target_amount="1000.00",
        start_date=start_date,
        end_date=end_date,
    )

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["current_amount"] == "900.00"
    assert response.json()["remaining_amount"] == "100.00"
    assert response.json()["average_net_per_hour"] is None
    assert response.json()["average_projected_per_hour"] == "90.00"
    assert response.json()["estimated_hours_remaining"] == "1.11"


def test_progress_goal_reached_returns_zero_remaining(client: TestClient) -> None:
    token = register_and_login(client, "reached@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    create_work_session(client, token, vehicle_id, today, "200.00")
    goal_id = create_goal(client, token, target_amount="100.00", start_date=today)

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["remaining_amount"] == "0.00"
    assert response.json()["required_daily_amount"] == "0.00"
    assert response.json()["estimated_hours_remaining"] == "0.00"
    assert response.json()["on_track"] is True


def test_progress_goal_without_data_returns_null_hour_estimate(client: TestClient) -> None:
    token = register_and_login(client, "no-data@email.com")
    today = date.today()
    goal_id = create_goal(
        client,
        token,
        target_amount="100.00",
        start_date=today - timedelta(days=1),
        end_date=today + timedelta(days=8),
    )

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["current_amount"] == "0.00"
    assert response.json()["remaining_amount"] == "100.00"
    assert response.json()["estimated_hours_remaining"] is None
    assert response.json()["on_track"] is False


def test_progress_average_less_than_or_equal_zero_returns_null_hours(client: TestClient) -> None:
    token = register_and_login(client, "negative-average@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    create_work_session(client, token, vehicle_id, today, "10.00")
    create_expense(client, token, today, "20.00", vehicle_id)
    goal_id = create_goal(client, token, target_amount="100.00", start_date=today)

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["current_amount"] == "-10.00"
    assert response.json()["average_net_per_hour"] is None
    assert response.json()["estimated_hours_remaining"] is None


def test_progress_end_of_period_uses_safe_required_amount(client: TestClient) -> None:
    token = register_and_login(client, "end-period@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    create_work_session(client, token, vehicle_id, today, "50.00")
    goal_id = create_goal(
        client,
        token,
        target_amount="100.00",
        start_date=today - timedelta(days=1),
        end_date=today,
    )

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["days_remaining"] == 0
    assert response.json()["required_daily_amount"] == "50.00"
    assert response.json()["on_track"] is False


def test_progress_on_track_false_when_financial_progress_lags_time(client: TestClient) -> None:
    token = register_and_login(client, "off-track@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    start_date = today - timedelta(days=4)
    end_date = today + timedelta(days=5)
    create_work_session(client, token, vehicle_id, today, "100.00")
    goal_id = create_goal(
        client,
        token,
        target_amount="1000.00",
        start_date=start_date,
        end_date=end_date,
    )

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["progress_percentage"] == "10.00"
    assert response.json()["on_track"] is False


def test_progress_money_precision_without_float_error(client: TestClient) -> None:
    token = register_and_login(client, "precision@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    create_work_session(client, token, vehicle_id, today, "0.10")
    create_work_session(client, token, vehicle_id, today, "0.20")
    goal_id = create_goal(client, token, target_amount="1.00", start_date=today)

    response = client.get(f"/financial-goals/{goal_id}/progress", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["current_amount"] == "0.30"
    assert response.json()["remaining_amount"] == "0.70"
    assert response.json()["progress_percentage"] == "30.00"

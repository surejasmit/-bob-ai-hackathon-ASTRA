import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import port_repo
from app.congestion.calculator import calculate_port_congestion
from app.optimization.optimizer import PortOptimizer

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_congestion_calculator():
    congestion = calculate_port_congestion(
        vessels=list(port_repo.vessels.values()),
        berths=list(port_repo.berths.values()),
        cranes=list(port_repo.cranes.values()),
        yards=list(port_repo.yards.values()),
        disruptions=list(port_repo.disruptions.values())
    )
    assert 0 <= congestion.score <= 100
    assert congestion.level in ["Low", "Moderate", "High", "Critical"]
    assert len(congestion.factors) >= 5


def test_optimization_solver():
    optimizer = PortOptimizer(
        vessels=list(port_repo.vessels.values()),
        berths=list(port_repo.berths.values()),
        cranes=list(port_repo.cranes.values()),
        disruptions=list(port_repo.disruptions.values()),
        horizon_hours=72
    )
    res = optimizer.solve()
    assert res["status"] in ["OPTIMAL", "FEASIBLE"]
    assert len(res["schedules"]) > 0
    # Every scheduled item has valid berth and times
    for item in res["schedules"]:
        assert item.berth_id is not None
        assert item.planned_end > item.planned_start


from app.core.auth import create_access_token


def test_missing_auth_returns_401():
    # Calling protected endpoint without Authorization header must return 401
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 401
    assert "Missing Authorization header" in res.json()["detail"]


def test_invalid_jwt_returns_401():
    # Calling protected endpoint with invalid JWT must return 401
    res = client.get("/api/dashboard/summary", headers={"Authorization": "Bearer invalid.token.signature"})
    assert res.status_code == 401


def test_dashboard_summary_endpoint():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})
    res = client.get("/api/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "congestion" in data
    assert "metrics" in data
    assert data["total_berths"] == 5
    assert data["total_cranes"] == 10


def test_rbac_restrictions():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})
    ops_token = create_access_token({"sub": "22222222-2222-2222-2222-222222222222", "email": "ops@naviops.port", "role": "operations"})
    viewer_token = create_access_token({"sub": "33333333-3333-3333-3333-333333333333", "email": "executive@naviops.port", "role": "viewer"})

    # 1. Viewer cannot delete a vessel (403 Forbidden)
    res_delete = client.delete(
        "/api/vessels/f0000001-0000-0000-0000-000000000001",
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert res_delete.status_code == 403

    # 2. Operations staff can create a disruption (201 Created)
    res_disruption = client.post("/api/disruptions", json={
        "disruption_type": "Equipment Failure",
        "title": "Crane CR-07 Electrical Interlock Test",
        "affected_resource_type": "crane",
        "affected_resource_id": "c0000007-0000-0000-0000-000000000007",
        "severity": "Low"
    }, headers={"Authorization": f"Bearer {ops_token}"})
    assert res_disruption.status_code == 201

    # 3. Operations staff cannot apply schedule (Admin only -> 403 Forbidden)
    res_apply = client.post("/api/optimization/apply", json={"run_id": "fake"}, headers={"Authorization": f"Bearer {ops_token}"})
    assert res_apply.status_code == 403

    # 4. Admin can delete a vessel
    created_v = client.post("/api/vessels", json={
        "vessel_code": "V-DEL-01",
        "vessel_name": "Test Delete Vessel",
        "shipping_line": "Maersk",
        "cargo_type": "Container",
        "cargo_volume": 1000,
        "vessel_length": 200.0,
        "eta": "2026-09-15T00:00:00Z",
        "etd": "2026-09-16T00:00:00Z",
        "priority": 2
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert created_v.status_code == 201
    v_id = created_v.json()["id"]

    res_admin_delete = client.delete(
        f"/api/vessels/{v_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin_delete.status_code == 204


from app.core.auth import hash_password, verify_password


def test_password_hashing_and_verification():
    pwd = "SecurePortPassword2026!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert "$" in hashed
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password("", hashed) is False


def test_signup_and_login_flow():
    # 1. Public signup must be disabled (403 Forbidden)
    signup_res = client.post("/api/auth/signup", json={
        "email": "engineer.test@naviops.port",
        "password": "EnginePassword123!",
        "full_name": "Chief Engineer John",
        "department": "Quayside Engineering"
    })
    assert signup_res.status_code == 403

    # 2. Admin creates personnel account
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})
    create_res = client.post("/api/auth/users", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "email": "engineer.test@naviops.port",
        "password": "EnginePassword123!",
        "full_name": "Chief Engineer John",
        "department": "Quayside Engineering",
        "role": "operations"
    })
    # If already created in prior run, it's 400 or 201
    assert create_res.status_code in (201, 400)

    # 3. Login with correct password
    login_res = client.post("/api/auth/login", json={
        "email": "engineer.test@naviops.port",
        "password": "EnginePassword123!"
    })
    assert login_res.status_code == 200
    assert "token" in login_res.json()
    assert login_res.json()["user"]["role"] == "operations"

    # 4. Login with incorrect password
    bad_login = client.post("/api/auth/login", json={
        "email": "engineer.test@naviops.port",
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401


def test_disruption_side_effects_and_persistence():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})

    # Report failure on CR-08
    res = client.post("/api/disruptions", json={
        "disruption_type": "Equipment Failure",
        "title": "CR-08 Gearbox Jam Test",
        "affected_resource_type": "crane",
        "affected_resource_id": "c0000008-0000-0000-0000-000000000008",
        "severity": "High"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    disruption_id = res.json()["id"]

    # Verify crane status was updated to Failed
    assert port_repo.cranes["c0000008-0000-0000-0000-000000000008"]["status"] == "Failed"

    # Resolve disruption
    res_update = client.put(f"/api/disruptions/{disruption_id}", json={
        "status": "Resolved"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_update.status_code == 200

    # Verify crane status is restored to Available
    assert port_repo.cranes["c0000008-0000-0000-0000-000000000008"]["status"] == "Available"


def test_apply_schedule_with_dict_and_model():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})

    # Run optimization
    res_run = client.post("/api/optimization/run", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_run.status_code == 201
    run_id = res_run.json()["id"]

    # Apply schedule
    res_apply = client.post("/api/optimization/apply", json={"run_id": run_id}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_apply.status_code == 200
    assert res_apply.json()["status"] == "success"

    # Verify optimization run record was marked applied
    assert port_repo.optimization_runs[run_id]["applied"] is True

    # Test re-applying with dict items (simulating rows loaded from PostgreSQL)
    v_id = next(iter(port_repo.vessels.keys()))
    b_id = next(iter(port_repo.berths.keys()))
    run_dict = dict(port_repo.optimization_runs[run_id])
    run_dict["schedules"] = [
        {
            "id": "test-sched-1",
            "optimization_run_id": run_id,
            "vessel_id": v_id,
            "berth_id": b_id,
            "waiting_time": 1.5,
            "duration_hours": 6.0,
            "vessel_name": "Maersk Mc-Kinney Moller",
            "vessel_code": "IMO-9632064",
            "berth_code": "B-04",
            "berth_name": "Central Terminal Berth 4",
            "planned_start": "2026-09-15T00:00:00Z",
            "planned_end": "2026-09-15T06:00:00Z",
            "assigned_cranes": ["CR-07", "CR-08"],
            "assignment_reason": "Test dict schedule apply",
            "status": "Proposed"
        }
    ]
    port_repo.optimization_runs["dict-run-test"] = run_dict
    res_dict_apply = client.post("/api/optimization/apply", json={"run_id": "dict-run-test"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_dict_apply.status_code == 200
    assert port_repo.vessels[v_id]["assigned_berth_id"] == b_id


def test_optimizer_timezone_and_empty_berths():
    from datetime import datetime
    # Naive datetimes without tzinfo
    vessels = [
        {
            "id": "v-naive-1",
            "vessel_code": "IMO-NAIVE",
            "vessel_name": "Naive Vessel",
            "shipping_line": "TestLine",
            "cargo_volume": 800,
            "vessel_length": 200.0,
            "eta": datetime(2026, 9, 15, 10, 0),
            "etd": datetime(2026, 9, 16, 10, 0),
            "priority": 2,
            "status": "Scheduled"
        }
    ]
    optimizer = PortOptimizer(
        vessels=vessels,
        berths=[],  # Empty berths edge case
        cranes=[],
        disruptions=[],
        horizon_hours=72
    )
    result = optimizer.solve()
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]
    assert "metrics" in result
    assert result["metrics"]["berth_occupancy_ratio"] >= 0


def test_prevent_demoting_only_admin():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})

    # Ensure only 1 admin
    for uid, u in list(port_repo.users.items()):
        if u.get("role") == "admin" and uid != "11111111-1111-1111-1111-111111111111":
            u["role"] = "operations"
            port_repo.users[uid] = u

    # Demoting the sole admin must fail
    res = client.put(
        "/api/auth/users/11111111-1111-1111-1111-111111111111/role",
        json={"role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 400
    assert "Cannot demote the only remaining administrator" in res.json()["detail"]


def test_admin_create_user():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})
    viewer_token = create_access_token({"sub": "33333333-3333-3333-3333-333333333333", "email": "executive@naviops.port", "role": "viewer"})

    # Non-admin forbidden
    res_forbidden = client.post(
        "/api/auth/users",
        json={
            "email": "unauth@naviops.port",
            "password": "password123",
            "full_name": "Unauthorized User",
            "role": "operations"
        },
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert res_forbidden.status_code == 403

    # Admin successfully creates user
    import uuid
    test_email = f"officer.{uuid.uuid4().hex[:8]}@naviops.port"
    res = client.post(
        "/api/auth/users",
        json={
            "email": test_email,
            "password": "securepassword123",
            "full_name": "Chief Officer Alex",
            "department": "Berth Management",
            "role": "operations"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == test_email
    assert data["role"] == "operations"
    assert data["full_name"] == "Chief Officer Alex"
    assert data["department"] == "Berth Management"
    assert "id" in data

    # Verify duplicate email rejected
    res_dup = client.post(
        "/api/auth/users",
        json={
            "email": test_email,
            "password": "securepassword123",
            "full_name": "Duplicate User",
            "role": "viewer"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_dup.status_code == 400
    assert "already registered" in res_dup.json()["detail"]


def test_what_if_simulation_endpoint():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})
    res = client.post(
        "/api/optimization/simulate",
        json={
            "scenario_name": "Test Crane Breakdown",
            "unavailable_crane_ids": ["c0000001-0000-0000-0000-000000000001"],
            "unavailable_berth_ids": []
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["scenario_name"] == "Test Crane Breakdown"
    assert "baseline_metrics" in data
    assert "simulated_metrics" in data
    assert "deltas" in data
    assert "simulated_schedules" in data
    assert "demurrage_delta_usd" in data["deltas"]
    assert "co2_delta_mt" in data["deltas"]


def test_disruption_sentinel_endpoint():
    admin_token = create_access_token({"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@naviops.port", "role": "admin"})
    res = client.get(
        "/api/disruptions/sentinel",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "has_threat" in data
    assert "active_alerts" in data
    assert "total_risk_exposure_usd" in data
    assert "recommended_action" in data


def test_port_twin_endpoint():
    # Test GET /api/port-twin returning database-backed operational dataset
    res = client.get("/api/port-twin")
    assert res.status_code == 200
    data = res.json()
    assert "vessels" in data
    assert "berths" in data
    assert "cranes" in data
    assert "yards" in data
    assert "disruptions" in data
    assert "server_time" in data

    # Verify berths have enriched vessel and assigned crane data
    assert len(data["berths"]) >= 5
    for b in data["berths"]:
        assert "berth_code" in b
        assert "status" in b

    # Verify cranes have status and berth associations
    assert len(data["cranes"]) >= 10
    for c in data["cranes"]:
        assert "crane_code" in c
        assert "status" in c
        assert c["status"] in ["Available", "Busy", "Maintenance", "Failed"]

    # Verify vessels have operational status and length
    assert len(data["vessels"]) >= 10
    for v in data["vessels"]:
        assert "vessel_code" in v
        assert "vessel_name" in v
        assert "status" in v

    # Verify yards have utilization percentage
    assert len(data["yards"]) >= 5
    for y in data["yards"]:
        assert "yard_code" in y
        assert "utilization_percentage" in y




import os
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import port_repo
from app.customer.database import customer_repo

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_clean_repos():
    # Make sure default port and customer data are available
    port_repo.refresh_users_from_db()
    customer_repo.seed_defaults_if_empty()


def test_customer_signup_and_login():
    """Test registering a new company organization and signing in."""
    unique_suffix = datetime.now().strftime("%f")
    signup_payload = {
        "organization_name": f"Nordic Bulk Carriers {unique_suffix}",
        "company_email": f"ops_{unique_suffix}@nordicbulk.com",
        "company_phone": "+47 22 12 34 56",
        "country": "Norway",
        "address": "Haakon VIIs gate 1",
        "city": "Oslo",
        "postal_code": "0161",
        "admin_full_name": "Erik Lindqvist",
        "admin_email": f"erik_{unique_suffix}@nordicbulk.com",
        "password": "SecurePassword123!",
        "admin_phone": "+47 99 88 77 66",
        "admin_job_title": "Fleet Director"
    }

    res = client.post("/api/customer/auth/signup", json=signup_payload)
    assert res.status_code == 201
    data = res.json()
    assert "token" in data
    assert data["user"]["email"] == signup_payload["admin_email"]
    assert data["user"]["role"] == "CUSTOMER_ADMIN"
    assert data["organization"]["name"] == signup_payload["organization_name"]

    # Test login with new credentials
    login_res = client.post("/api/customer/auth/login", json={
        "email": signup_payload["admin_email"],
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["token"] is not None

    # Test get me
    me_res = client.get("/api/customer/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == signup_payload["admin_email"]


def test_domain_isolation_and_rbac():
    """Verify customer tokens cannot access Port APIs and port tokens cannot access Customer APIs."""
    # 1. Customer Token
    cust_login = client.post("/api/customer/auth/login", json={
        "email": "john@abcshipping.com",
        "password": "admin123"
    })
    assert cust_login.status_code == 200
    cust_token = cust_login.json()["token"]

    # Customer token accessing Port Operations endpoint -> 401 or 403
    port_api_res = client.get("/api/vessels", headers={"Authorization": f"Bearer {cust_token}"})
    assert port_api_res.status_code in [401, 403]

    port_opt_res = client.post("/api/optimization/run", headers={"Authorization": f"Bearer {cust_token}"})
    assert port_opt_res.status_code in [401, 403]

    # 2. Port Worker Token
    port_login = client.post("/api/auth/login", json={
        "email": "ops@naviops.port",
        "password": "admin123"
    })
    assert port_login.status_code == 200
    port_token = port_login.json()["token"]

    # Port token accessing Customer endpoint -> 401 (domain mismatch)
    cust_api_res = client.get("/api/customer/vessels", headers={"Authorization": f"Bearer {port_token}"})
    assert cust_api_res.status_code == 401


def test_customer_vessel_management_and_isolation():
    """Test customer vessel registration, uniqueness, and organization scoping."""
    # Login as ABC Shipping
    cust_login = client.post("/api/customer/auth/login", json={
        "email": "john@abcshipping.com",
        "password": "admin123"
    })
    token = cust_login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List vessels
    vessels_res = client.get("/api/customer/vessels", headers=headers)
    assert vessels_res.status_code == 200
    vessels = vessels_res.json()
    assert len(vessels) >= 2
    assert any(v["vessel_name"] == "MV Neptune" for v in vessels)

    # Register new vessel
    test_imo = f"IMO-{uuid.uuid4().hex[:7].upper()}"
    new_vessel_payload = {
        "vessel_name": "MV Pacific Pioneer",
        "imo_number": test_imo,
        "vessel_type": "Container",
        "length_loa": 294.0,
        "beam": 32.2,
        "draft": 12.0,
        "gross_tonnage": 54000,
        "deadweight_tonnage": 68000,
        "flag": "Singapore",
        "operator_name": "ABC Shipping Line",
        "cargo_type": "Container",
        "cargo_capacity": 4800,
        "hazardous_cargo": False,
        "special_handling_requirements": "Standard"
    }
    create_res = client.post("/api/customer/vessels", json=new_vessel_payload, headers=headers)
    assert create_res.status_code == 201
    v_data = create_res.json()
    assert v_data["imo_number"] == test_imo

    # Duplicate IMO within same organization should fail
    dup_res = client.post("/api/customer/vessels", json=new_vessel_payload, headers=headers)
    assert dup_res.status_code == 400


def test_arrival_request_lifecycle_and_feasibility():
    """Test submitting an arrival request, verifying feasibility checks and optimization bridge execution."""
    cust_login = client.post("/api/customer/auth/login", json={
        "email": "john@abcshipping.com",
        "password": "admin123"
    })
    token = cust_login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    vessels = client.get("/api/customer/vessels", headers=headers).json()
    neptune = next(v for v in vessels if v["vessel_name"] == "MV Neptune")

    now = datetime.now(timezone.utc)
    req_eta = now + timedelta(hours=24)
    req_etd = now + timedelta(hours=48)

    request_payload = {
        "vessel_id": neptune["id"],
        "requested_eta": req_eta.isoformat(),
        "expected_departure": req_etd.isoformat(),
        "expected_port_stay_hours": 24.0,
        "origin": "Rotterdam",
        "destination": "Singapore",
        "cargo_type": "Container",
        "cargo_quantity": 1800,
        "hazardous_cargo": False,
        "required_cranes": 2,
        "tug_required": True,
        "pilot_required": True,
        "bunkering_required": False,
        "customer_notes": "Priority container turnaround."
    }

    res = client.post("/api/customer/arrival-requests", json=request_payload, headers=headers)
    assert res.status_code == 201
    req_data = res.json()

    assert req_data["request_code"].startswith("VAR-")
    assert req_data["status"] == "PENDING_MANAGER_REVIEW"
    assert req_data["feasibility_status"] in ["PASS", "WARN"]
    assert len(req_data["feasibility_details"]) >= 5
    assert req_data["optimization_status"] in ["ACCEPTABLE", "ALTERNATIVE_RECOMMENDED"]
    assert req_data["optimization_recommendation"] is not None

    # Verify audit trail
    trail_res = client.get(f"/api/customer/arrival-requests/{req_data['id']}/audit-trail", headers=headers)
    assert trail_res.status_code == 200
    trail = trail_res.json()
    actions = [t["action"] for t in trail]
    assert "SUBMITTED" in actions
    assert "FEASIBILITY_COMPLETED" in actions
    assert "OPTIMIZATION_COMPLETED" in actions

    assert req_data["id"] is not None


def test_operation_manager_review_workflow():
    """
    Test Operation Manager operations:
    1. View incoming requests
    2. Run what-if sandbox simulation
    3. Propose alternative
    4. Customer accepts alternative
    5. Operation Manager approves and commits to live schedule
    6. Concurrency / Stale optimization protection
    """
    # 1. Customer submits a request
    cust_login = client.post("/api/customer/auth/login", json={
        "email": "john@abcshipping.com",
        "password": "admin123"
    })
    cust_token = cust_login.json()["token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    vessels = client.get("/api/customer/vessels", headers=cust_headers).json()
    vessel = vessels[0]

    now = datetime.now(timezone.utc)
    req_eta = now + timedelta(hours=30)
    req_etd = now + timedelta(hours=50)

    sub_res = client.post("/api/customer/arrival-requests", json={
        "vessel_id": vessel["id"],
        "requested_eta": req_eta.isoformat(),
        "expected_departure": req_etd.isoformat(),
        "expected_port_stay_hours": 20.0,
        "origin": "Shanghai",
        "destination": "Hamburg",
        "cargo_type": "Container",
        "cargo_quantity": 1200,
        "required_cranes": 2,
    }, headers=cust_headers)
    assert sub_res.status_code == 201
    request_id = sub_res.json()["id"]

    # 2. Port Operations login
    ops_login = client.post("/api/auth/login", json={
        "email": "ops@naviops.port",
        "password": "admin123"
    })
    assert ops_login.status_code == 200
    ops_token = ops_login.json()["token"]
    ops_headers = {"Authorization": f"Bearer {ops_token}"}

    # List incoming requests
    incoming_res = client.get("/api/operations/arrival-requests", headers=ops_headers)
    assert incoming_res.status_code == 200
    incoming = incoming_res.json()
    assert any(r["id"] == request_id for r in incoming)

    # What-If Simulation
    sim_res = client.post(f"/api/operations/arrival-requests/{request_id}/simulate", headers=ops_headers)
    assert sim_res.status_code == 200
    assert "recommendation" in sim_res.json()

    # 3. Propose Alternative
    alt_eta = now + timedelta(hours=34)
    alt_etd = now + timedelta(hours=54)
    prop_res = client.post(f"/api/operations/arrival-requests/{request_id}/propose-alternative", json={
        "proposed_eta": alt_eta.isoformat(),
        "proposed_departure": alt_etd.isoformat(),
        "operational_reason": "Berth occupied by CMA CGM Palais Royal. Alternative slot avoids quayside waiting."
    }, headers=ops_headers)
    assert prop_res.status_code == 200
    assert prop_res.json()["status"] == "ALTERNATIVE_PROPOSED"

    # 4. Customer accepts alternative
    acc_res = client.post(f"/api/customer/arrival-requests/{request_id}/accept-alternative", json={
        "notes": "Agreed, we will adjust cruising speed."
    }, headers=cust_headers)
    assert acc_res.status_code == 200

    # 5. Stale Optimization Protection test:
    # Pass an outdated schedule_version -> expect 409 Conflict
    stale_version = port_repo.schedule_version - 1
    conflict_res = client.post(f"/api/operations/arrival-requests/{request_id}/approve", json={
        "schedule_version": stale_version
    }, headers=ops_headers)
    assert conflict_res.status_code == 409

    # 6. Approve with current schedule version
    current_version = port_repo.schedule_version
    app_res = client.post(f"/api/operations/arrival-requests/{request_id}/approve", json={
        "schedule_version": current_version
    }, headers=ops_headers)
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "APPROVED"
    assert app_res.json()["assigned_berth_code"] is not None

    # Verify live vessel was committed into Port Repository!
    live_vessels = list(port_repo.vessels.values())
    assert any(lv.get("vessel_name") == vessel["vessel_name"] for lv in live_vessels)


def test_operation_manager_rejection():
    """Test Operation Manager rejecting a request with structured reason."""
    cust_login = client.post("/api/customer/auth/login", json={
        "email": "john@abcshipping.com",
        "password": "admin123"
    })
    cust_headers = {"Authorization": f"Bearer {cust_login.json()['token']}"}

    vessels = client.get("/api/customer/vessels", headers=cust_headers).json()
    now = datetime.now(timezone.utc)

    sub_res = client.post("/api/customer/arrival-requests", json={
        "vessel_id": vessels[0]["id"],
        "requested_eta": (now + timedelta(hours=10)).isoformat(),
        "expected_departure": (now + timedelta(hours=25)).isoformat(),
        "origin": "Busan",
        "destination": "London",
        "cargo_type": "Container",
        "cargo_quantity": 500,
    }, headers=cust_headers)
    req_id = sub_res.json()["id"]

    ops_login = client.post("/api/auth/login", json={
        "email": "ops@naviops.port",
        "password": "admin123"
    })
    ops_headers = {"Authorization": f"Bearer {ops_login.json()['token']}"}

    rej_res = client.post(f"/api/operations/arrival-requests/{req_id}/reject", json={
        "reason": "Port Capacity Exceeded",
        "comment": "Severe anchorage congestion and high wind advisory prevent additional vessel entry."
    }, headers=ops_headers)
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"
    assert rej_res.json()["rejection_reason"] == "Port Capacity Exceeded"

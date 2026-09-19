import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import port_repo
from app.core.auth import create_access_token, hash_password


client = TestClient(app)


def _get_admin_token() -> str:
    admin_id = "11111111-1111-1111-1111-111111111111"
    return create_access_token({
        "sub": admin_id,
        "email": "admin@naviops.port",
        "role": "admin",
        "name": "Capt. Michael Vance",
        "department": "Port Authority Executive"
    })


def _get_viewer_token() -> str:
    viewer_id = "33333333-3333-3333-3333-333333333333"
    return create_access_token({
        "sub": viewer_id,
        "email": "executive@naviops.port",
        "role": "viewer",
        "name": "David Chen",
        "department": "Maritime Logistics & Analytics"
    })


def _get_ops_token() -> str:
    ops_id = "22222222-2222-2222-2222-222222222222"
    return create_access_token({
        "sub": ops_id,
        "email": "ops@naviops.port",
        "role": "operations",
        "name": "Elena Rostova",
        "department": "Quayside Operations Control"
    })


class TestDataSafetyAndCRUDIsolation:

    def test_single_user_delete_isolation(self):
        """TEST 1: Create 3 users (A, B, C); delete only A; verify B and C remain completely unchanged."""
        admin_token = _get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Create 3 test users
        tag = uuid.uuid4().hex[:6]
        user_a_payload = {
            "email": f"user_a_{tag}@test.port",
            "full_name": f"User A {tag}",
            "role": "operations",
            "department": "Berth Planning",
            "password": "Password123!"
        }
        user_b_payload = {
            "email": f"user_b_{tag}@test.port",
            "full_name": f"User B {tag}",
            "role": "viewer",
            "department": "Logistics",
            "password": "Password123!"
        }
        user_c_payload = {
            "email": f"user_c_{tag}@test.port",
            "full_name": f"User C {tag}",
            "role": "operations",
            "department": "Quayside",
            "password": "Password123!"
        }

        res_a = client.post("/api/auth/users", json=user_a_payload, headers=headers)
        res_b = client.post("/api/auth/users", json=user_b_payload, headers=headers)
        res_c = client.post("/api/auth/users", json=user_c_payload, headers=headers)

        assert res_a.status_code == 201
        assert res_b.status_code == 201
        assert res_c.status_code == 201

        user_a_id = res_a.json()["id"]
        user_b_id = res_b.json()["id"]
        user_c_id = res_c.json()["id"]

        # 2. Delete ONLY user A
        del_res = client.delete(f"/api/auth/users/{user_a_id}", headers=headers)
        assert del_res.status_code == 200

        # 3. Verify user A is gone from database & memory
        assert user_a_id not in port_repo.users

        # 4. Verify user B and user C are still present and have identical properties
        assert user_b_id in port_repo.users
        assert port_repo.users[user_b_id]["email"] == user_b_payload["email"]
        assert port_repo.users[user_b_id]["full_name"] == user_b_payload["full_name"]
        assert port_repo.users[user_b_id]["role"] == user_b_payload["role"]

        assert user_c_id in port_repo.users
        assert port_repo.users[user_c_id]["email"] == user_c_payload["email"]
        assert port_repo.users[user_c_id]["full_name"] == user_c_payload["full_name"]
        assert port_repo.users[user_c_id]["role"] == user_c_payload["role"]

        # Clean up remaining test users
        client.delete(f"/api/auth/users/{user_b_id}", headers=headers)
        client.delete(f"/api/auth/users/{user_c_id}", headers=headers)

    def test_single_record_update_isolation(self):
        """TEST 2: Update Record A; verify Record B and Record C remain completely unchanged."""
        admin_token = _get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        tag = uuid.uuid4().hex[:6]
        user_a_payload = {
            "email": f"update_a_{tag}@test.port",
            "full_name": f"User A {tag}",
            "role": "viewer",
            "department": "Berth Planning",
            "password": "Password123!"
        }
        user_b_payload = {
            "email": f"update_b_{tag}@test.port",
            "full_name": f"User B {tag}",
            "role": "operations",
            "department": "Logistics",
            "password": "Password123!"
        }

        res_a = client.post("/api/auth/users", json=user_a_payload, headers=headers)
        res_b = client.post("/api/auth/users", json=user_b_payload, headers=headers)
        user_a_id = res_a.json()["id"]
        user_b_id = res_b.json()["id"]

        # Update ONLY User A's role to 'operations'
        update_res = client.put(f"/api/auth/users/{user_a_id}/role", json={"role": "operations"}, headers=headers)
        assert update_res.status_code == 200
        assert update_res.json()["role"] == "operations"

        # Verify User A was updated
        assert port_repo.users[user_a_id]["role"] == "operations"

        # Verify User B was NOT modified in any way
        assert port_repo.users[user_b_id]["email"] == user_b_payload["email"]
        assert port_repo.users[user_b_id]["full_name"] == user_b_payload["full_name"]
        assert port_repo.users[user_b_id]["role"] == "operations"  # unchanged
        assert port_repo.users[user_b_id]["department"] == "Logistics"  # unchanged

        # Clean up
        client.delete(f"/api/auth/users/{user_a_id}", headers=headers)
        client.delete(f"/api/auth/users/{user_b_id}", headers=headers)

    def test_failed_deletion_nonexistent_record(self):
        """TEST 3: Attempt to delete a nonexistent record; verify 404 and no records affected."""
        admin_token = _get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        count_before = len(port_repo.users)
        fake_id = str(uuid.uuid4())

        del_res = client.delete(f"/api/auth/users/{fake_id}", headers=headers)
        assert del_res.status_code == 404
        assert "not found" in del_res.json()["detail"].lower()

        count_after = len(port_repo.users)
        assert count_after == count_before

    def test_unauthorized_deletion_rejected(self):
        """TEST 4: Try deleting as a user without admin permission; verify 403 rejection."""
        viewer_token = _get_viewer_token()
        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

        admin_token = _get_admin_token()
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create a test vessel
        tag = uuid.uuid4().hex[:6]
        vessel_payload = {
            "vessel_code": f"IMO-{tag}",
            "vessel_name": f"Test Vessel {tag}",
            "shipping_line": "Maersk",
            "cargo_type": "Container",
            "cargo_volume": 1500,
            "vessel_length": 300,
            "eta": "2026-09-20T10:00:00Z",
            "etd": "2026-09-21T10:00:00Z",
            "priority": 2,
            "status": "Scheduled"
        }
        res_v = client.post("/api/vessels", json=vessel_payload, headers=admin_headers)
        assert res_v.status_code == 201
        vessel_id = res_v.json()["id"]

        # Viewer attempts deletion -> 403 Forbidden
        del_res = client.delete(f"/api/vessels/{vessel_id}", headers=viewer_headers)
        assert del_res.status_code == 403

        # Verify vessel is still intact in repository
        assert vessel_id in port_repo.vessels

        # Operations attempts deletion -> 403 Forbidden (Admin only)
        ops_token = _get_ops_token()
        ops_headers = {"Authorization": f"Bearer {ops_token}"}
        del_res_ops = client.delete(f"/api/vessels/{vessel_id}", headers=ops_headers)
        assert del_res_ops.status_code == 403
        assert vessel_id in port_repo.vessels

        # Admin deletes successfully
        admin_del = client.delete(f"/api/vessels/{vessel_id}", headers=admin_headers)
        assert admin_del.status_code == 204
        assert vessel_id not in port_repo.vessels

    def test_relational_safety_on_vessel_delete(self):
        """TEST 5: Delete a vessel assigned to a berth; verify berth is safely freed, not deleted."""
        admin_token = _get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Identify an existing berth
        berth = next(iter(port_repo.berths.values()))
        berth_id = berth["id"]

        # Create vessel and assign to berth
        tag = uuid.uuid4().hex[:6]
        vessel_payload = {
            "vessel_code": f"IMO-{tag}",
            "vessel_name": f"Relational Test Vessel {tag}",
            "shipping_line": "MSC",
            "cargo_type": "Container",
            "cargo_volume": 2000,
            "vessel_length": 350,
            "eta": "2026-09-20T10:00:00Z",
            "etd": "2026-09-21T10:00:00Z",
            "priority": 1,
            "status": "Berthing",
            "assigned_berth_id": berth_id
        }
        res = client.post("/api/vessels", json=vessel_payload, headers=headers)
        assert res.status_code == 201
        vessel_id = res.json()["id"]

        # Simulate berth occupied by this vessel
        port_repo.berths[berth_id]["current_vessel_id"] = vessel_id
        port_repo.berths[berth_id]["status"] = "Occupied"

        # Delete the vessel
        del_res = client.delete(f"/api/vessels/{vessel_id}", headers=headers)
        assert del_res.status_code == 204

        # Verify vessel was deleted
        assert vessel_id not in port_repo.vessels

        # Verify berth still exists and was safely freed (not deleted!)
        assert berth_id in port_repo.berths
        assert port_repo.berths[berth_id]["current_vessel_id"] is None
        assert port_repo.berths[berth_id]["status"] == "Available"

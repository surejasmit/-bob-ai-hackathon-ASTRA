import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import port_repo, PortRepository
from app.core.auth import create_access_token


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


class TestDisruptionsDataFlow:

    def test_1_startup_does_not_insert_disruptions(self):
        """TEST 1 & 2: Verify application startup and restart does NOT create or insert disruptions."""
        # Check current count in repo
        initial_count = len(port_repo.disruptions)

        # Simulate fresh application startup / restart by instantiating new PortRepository
        fresh_repo = PortRepository()
        restarted_count = len(fresh_repo.disruptions)

        # Counts must match exactly — zero automatic inserts on startup
        assert restarted_count == initial_count

    def test_2_get_disruptions_is_strictly_read_only(self):
        """TEST 3 & 5: Calling GET /api/disruptions multiple times never creates or modifies records."""
        admin_token = _get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Initial fetch
        res1 = client.get("/api/disruptions", headers=headers)
        assert res1.status_code == 200
        count_1 = len(res1.json())

        # Repeated GET requests simulating frontend user navigation and multiple page refreshes
        for _ in range(5):
            res_refresh = client.get("/api/disruptions", headers=headers)
            assert res_refresh.status_code == 200
            assert len(res_refresh.json()) == count_1

    def test_3_explicit_creation_creates_exactly_one_record(self):
        """TEST 4: Calling POST /api/disruptions creates exactly 1 record and GET returns it."""
        admin_token = _get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Get baseline count
        res_before = client.get("/api/disruptions", headers=headers)
        count_before = len(res_before.json())

        # Explicit creation via POST /api/disruptions
        tag = uuid.uuid4().hex[:6]
        payload = {
            "disruption_type": "Equipment Failure",
            "title": f"Explicit Test Incident {tag}",
            "description": "Validation test for explicit disruption creation",
            "affected_resource_type": "port",
            "severity": "Medium",
            "status": "Active"
        }
        create_res = client.post("/api/disruptions", json=payload, headers=headers)
        assert create_res.status_code == 201
        created_data = create_res.json()
        new_id = created_data["id"]

        # Verify GET returns exactly N + 1 records containing the new item
        res_after = client.get("/api/disruptions", headers=headers)
        assert len(res_after.json()) == count_before + 1
        matching = [d for d in res_after.json() if d["id"] == new_id]
        assert len(matching) == 1
        assert matching[0]["title"] == payload["title"]

        # Clean up the explicitly created test disruption
        del_res = client.delete(f"/api/disruptions/{new_id}", headers=headers)
        assert del_res.status_code == 204

        # Verify count returns to baseline
        res_final = client.get("/api/disruptions", headers=headers)
        assert len(res_final.json()) == count_before

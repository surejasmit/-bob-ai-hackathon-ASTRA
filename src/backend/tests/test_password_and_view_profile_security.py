import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import port_repo, _load_users_sqlite
from app.core.auth import create_access_token, verify_password

client = TestClient(app)


def admin_headers():
    token = create_access_token({
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "admin@naviops.port",
        "role": "admin",
        "name": "Capt. Michael Vance",
        "department": "Port Authority Executive"
    })
    return {"Authorization": f"Bearer {token}"}


def test_user_creation_with_custom_password_and_secure_hashing():
    """Test 1: Admin creates user with password 'Test@12345', password is encrypted and not exposed."""
    unique_id = uuid.uuid4().hex[:8]
    user_email = f"officer.{unique_id}@naviops.port"
    raw_password = "Test@12345"

    # 1. Admin creates user
    res = client.post("/api/auth/users", headers=admin_headers(), json={
        "full_name": "Test Officer A",
        "email": user_email,
        "password": raw_password,
        "role": "operations",
        "department": "Quayside Operations"
    })
    assert res.status_code == 201
    user_data = res.json()

    # Verify no plain password or hash is exposed in API response
    assert "password" not in user_data
    assert "password_hash" not in user_data
    assert user_data["email"] == user_email
    assert user_data["role"] == "operations"
    user_id = user_data["id"]

    # 2. Verify backend stored password hash is cryptographic PBKDF2 (not plain text)
    stored_user = port_repo.users.get(user_id)
    assert stored_user is not None
    assert stored_user["password_hash"] != raw_password
    assert "$" in stored_user["password_hash"]
    assert verify_password(raw_password, stored_user["password_hash"]) is True

    # 3. Verify SQLite persistence stored the hash securely
    sqlite_users = _load_users_sqlite()
    sqlite_match = next((u for u in sqlite_users if u["id"] == user_id), None)
    assert sqlite_match is not None
    assert sqlite_match["password_hash"] != raw_password
    assert "$" in sqlite_match["password_hash"]

    # 4. Verify login succeeds with the exact password
    login_success = client.post("/api/auth/login", json={
        "email": user_email,
        "password": raw_password
    })
    assert login_success.status_code == 200
    assert "token" in login_success.json()
    assert login_success.json()["user"]["email"] == user_email

    # 5. Verify login fails with incorrect password or default 'admin123'
    login_wrong = client.post("/api/auth/login", json={
        "email": user_email,
        "password": "admin123"
    })
    assert login_wrong.status_code == 401


def test_multiple_users_with_different_passwords():
    """Test 2: Create another user with a different password and verify both work independently."""
    unique_id_b = uuid.uuid4().hex[:8]
    user_email_b = f"officer.{unique_id_b}@naviops.port"
    raw_password_b = "Different@98765"

    res = client.post("/api/auth/users", headers=admin_headers(), json={
        "full_name": "Test Officer B",
        "email": user_email_b,
        "password": raw_password_b,
        "role": "viewer",
        "department": "Logistics Analytics"
    })
    assert res.status_code == 201

    # Verify user B can log in with raw_password_b
    login_b = client.post("/api/auth/login", json={
        "email": user_email_b,
        "password": raw_password_b
    })
    assert login_b.status_code == 200
    assert login_b.json()["user"]["role"] == "viewer"

    # Verify user B cannot log in with user A's password
    login_b_wrong = client.post("/api/auth/login", json={
        "email": user_email_b,
        "password": "Test@12345"
    })
    assert login_b_wrong.status_code == 401


def test_admin_password_reset_and_login_transition():
    """Test 3: Admin resets a user's password; new password works, old password immediately invalidated."""
    unique_id = uuid.uuid4().hex[:8]
    user_email = f"reset.target.{unique_id}@naviops.port"
    initial_pwd = "Initial@12345"
    updated_pwd = "NewSecret@5544"

    create_res = client.post("/api/auth/users", headers=admin_headers(), json={
        "full_name": "Reset Candidate",
        "email": user_email,
        "password": initial_pwd,
        "role": "operations"
    })
    assert create_res.status_code == 201
    user_id = create_res.json()["id"]

    # Reset password
    reset_res = client.put(f"/api/auth/users/{user_id}/password", headers=admin_headers(), json={
        "password": updated_pwd
    })
    assert reset_res.status_code == 200
    reset_data = reset_res.json()
    assert "password" not in reset_data
    assert "password_hash" not in reset_data

    # Old password fails
    login_old = client.post("/api/auth/login", json={
        "email": user_email,
        "password": initial_pwd
    })
    assert login_old.status_code == 401

    # New password succeeds
    login_new = client.post("/api/auth/login", json={
        "email": user_email,
        "password": updated_pwd
    })
    assert login_new.status_code == 200
    assert login_new.json()["user"]["email"] == user_email

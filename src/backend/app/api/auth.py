import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import port_repo
from app.models.schemas import (
    LoginRequest,
    SignupRequest,
    UserRoleUpdate,
    AdminCreateUserRequest,
    AdminUpdatePasswordRequest,
    AuthResponse,
    UserResponse,
)
from app.core.auth import get_current_user, require_role, create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication & RBAC"])


@router.post("/signup", status_code=status.HTTP_403_FORBIDDEN)
def signup():
    """
    Public registration is strictly disabled.
    All user accounts must be provisioned by an authorized administrator from Admin -> Users.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Public registration is disabled. All user accounts must be provisioned by a Port Administrator."
    )


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """
    Authenticate user and return signed JWT token.
    Pre-configured accounts:
    - Port Manager: admin@naviops.port / admin123
    - Operations Staff: ops@naviops.port / admin123
    - Executive Viewer: executive@naviops.port / admin123
    """
    port_repo.refresh_users_from_db()
    email_clean = req.email.strip().lower()
    user_match = None

    for u in port_repo.users.values():
        if u.get("email", "").lower() == email_clean:
            user_match = u
            break

    # Helpful alias: automatically map @naviops.com to @naviops.port demo accounts
    if not user_match and email_clean.endswith("@naviops.com"):
        port_alias = email_clean[:-4] + ".port"
        for u in port_repo.users.values():
            if u.get("email", "").lower() == port_alias:
                user_match = u
                break

    if not user_match:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Constant-time password verification — only PBKDF2-hashed passwords accepted
    password_hash = user_match.get("password_hash")
    if not password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Cryptographic password verification (PBKDF2-HMAC-SHA256)
    password_valid = verify_password(req.password, password_hash)

    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Generate signed JWT
    token = create_access_token({
        "sub": user_match["id"],
        "email": user_match["email"],
        "role": user_match["role"],
        "name": user_match["full_name"],
        "department": user_match.get("department", "Port Operations")
    })

    return AuthResponse(
        token=token,
        user=UserResponse(**user_match)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Retrieve current authenticated user context and role"""
    return current_user


@router.get("/users", response_model=List[UserResponse])
def list_users(current_user: UserResponse = Depends(require_role(["admin"]))):
    """
    List all registered users (Port Manager / Admin only).
    Enables managing roles and auditing system access.
    Always synchronizes with persistent database store.
    """
    port_repo.refresh_users_from_db()
    users = list(port_repo.users.values())
    users.sort(key=lambda u: str(u.get("created_at", "")), reverse=True)
    return [UserResponse(**u) for u in users]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    req: AdminCreateUserRequest,
    current_user: UserResponse = Depends(require_role(["admin"]))
):
    """
    Create a new user directly from Admin Users directory.
    Enables Port Managers to register staff with specific roles without signing them in.
    """
    email_clean = req.email.strip().lower()
    allowed_roles = ["admin", "operations", "viewer"]
    chosen_role = req.role.strip().lower()

    if chosen_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Must be one of: {', '.join(allowed_roles)}"
        )

    if not req.password or len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    # Check for existing email (case-insensitive)
    for u in port_repo.users.values():
        if u.get("email", "").lower() == email_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An account with email '{email_clean}' is already registered."
            )

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    user_data = {
        "id": new_id,
        "email": email_clean,
        "full_name": req.full_name.strip(),
        "role": chosen_role,
        "department": req.department.strip() if req.department else "Port Operations",
        "password_hash": hash_password(req.password),
        "created_at": now
    }

    port_repo.users[new_id] = user_data
    return UserResponse(**user_data)


@router.put("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    current_user: UserResponse = Depends(require_role(["admin"]))
):
    """
    Update a user's access role (Port Manager / Admin only).
    Allowed roles: 'admin', 'operations', 'viewer'.
    Enables promoting newly registered viewers into operations staff or admins.
    """
    allowed_roles = ["admin", "operations", "viewer"]
    new_role = payload.role.strip().lower()

    if new_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(allowed_roles)}"
        )

    if user_id not in port_repo.users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user = port_repo.users[user_id]

    # Guard: prevent demoting the last active administrator
    if user.get("role") == "admin" and new_role != "admin":
        admin_count = sum(1 for u in port_repo.users.values() if u.get("role") == "admin")
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the only remaining administrator account."
            )

    user["role"] = new_role
    port_repo.users[user_id] = user  # Triggers live sync to Supabase

    return UserResponse(**user)


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(require_role(["admin"]))
):
    """
    Delete a user account (Port Manager / Admin only).
    Safeguards:
    - Admin cannot delete their own active account.
    - Cannot delete the last remaining administrator account.
    """
    if user_id not in port_repo.users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Guard 1: Prevent admin from deleting their own active account
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own active administrator account."
        )

    target_user = port_repo.users[user_id]

    # Guard 2: Prevent deleting the only remaining administrator account
    if target_user.get("role") == "admin":
        admin_count = sum(1 for u in port_repo.users.values() if u.get("role") == "admin")
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only remaining administrator account."
            )

    del port_repo.users[user_id]
    return {"message": "User deleted successfully", "id": user_id}


@router.put("/users/{user_id}/password", response_model=UserResponse)
def admin_update_user_password(
    user_id: str,
    payload: AdminUpdatePasswordRequest,
    current_user: UserResponse = Depends(require_role(["admin"]))
):
    """
    Update / reset a user's password directly (Port Manager / Admin only).
    Enables administrators to assign or update credentials for operations and viewer accounts.
    """
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    if user_id not in port_repo.users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user = port_repo.users[user_id]
    user["password_hash"] = hash_password(payload.password)
    port_repo.users[user_id] = user
    return UserResponse(**user)


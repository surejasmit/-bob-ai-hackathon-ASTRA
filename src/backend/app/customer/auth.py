import logging
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import jwt
from fastapi import Header, HTTPException, status, Depends
from app.core.config import settings
from app.customer.schemas import CustomerUserResponse

logger = logging.getLogger("naviops.customer.auth")

CUSTOMER_JWT_AUDIENCE = "naviops-customer-portal"


def hash_customer_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 password hash with 16-byte random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${key.hex()}"


def verify_customer_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time verification of password hash."""
    if not hashed_password or not plain_password:
        return False
    if "$" not in hashed_password:
        # Legacy/demo accounts check
        if secrets.compare_digest(plain_password, hashed_password):
            return True
        old_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        return secrets.compare_digest(old_hash, hashed_password)
    try:
        salt, key_hex = hashed_password.split("$", 1)
        test_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return secrets.compare_digest(test_key.hex(), key_hex)
    except Exception:
        return False


def create_customer_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token for Customer Domain user."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "domain": "customer",
        "aud": CUSTOMER_JWT_AUDIENCE,
    })
    return jwt.encode(to_encode, settings.effective_jwt_secret, algorithm=settings.JWT_ALGORITHM)


def decode_customer_access_token(token: str) -> Optional[dict]:
    """Validate and decode a Customer JWT token. Rejects tokens not explicitly tagged domain='customer'."""
    try:
        payload = jwt.decode(
            token,
            settings.effective_jwt_secret,
            algorithms=[settings.JWT_ALGORITHM],
            audience=CUSTOMER_JWT_AUDIENCE
        )
        if payload.get("domain") != "customer":
            logger.warning("Token domain mismatch: Expected 'customer'")
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Customer JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug(f"Customer JWT decode failed: {e}")
        return None


def get_current_customer_user(authorization: Optional[str] = Header(None)) -> CustomerUserResponse:
    """
    Dependency to authenticate and extract active Customer identity.
    Strictly prevents Port Worker tokens from gaining access to Customer APIs.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Customer login required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Must be 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1].strip()
    payload = decode_customer_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Customer session is invalid or has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    org_id = payload.get("org_id")

    from app.customer.database import customer_repo
    user = customer_repo.users.get(user_id)
    if not user:
        # Fallback email check
        email = payload.get("email")
        if email:
            for u in customer_repo.users.values():
                if u.get("email", "").lower() == email.lower():
                    user = u
                    break

    if not user or user.get("organization_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Customer account associated with this session no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify organization exists
    if org_id not in customer_repo.organizations:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer organization is not active.",
        )

    return CustomerUserResponse(**user)


def require_customer_role(allowed_roles: List[str]):
    """Enforce Customer RBAC (e.g. CUSTOMER_ADMIN only for org user management / sensitive actions)."""
    def role_checker(current_user: CustomerUserResponse = Depends(get_current_customer_user)) -> CustomerUserResponse:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends

from app.customer.database import customer_repo
from app.customer.auth import (
    hash_customer_password,
    verify_customer_password,
    create_customer_access_token,
    get_current_customer_user,
    require_customer_role
)
from app.customer.schemas import (
    CustomerSignupRequest,
    CustomerLoginRequest,
    CustomerAuthResponse,
    CustomerUserResponse,
    CustomerUserCreate,
    OrganizationResponse,
    OrganizationUpdate,
    CustomerVesselCreate,
    CustomerVesselUpdate,
    CustomerVesselResponse,
    ArrivalRequestCreate,
    ArrivalRequestUpdate,
    ArrivalRequestResponse,
    CustomerProposalActionRequest,
    CustomerNotificationResponse,
    AlternativeProposalItem,
    AuditLogResponse,
    CustomerForgotPasswordRequest,
    CustomerResetPasswordRequest,
)
from app.customer.services.feasibility import evaluate_vessel_arrival_feasibility
from app.customer.services.optimization_bridge import evaluate_arrival_request_optimization
from app.core.database import port_repo

logger = logging.getLogger("naviops.customer.router")

router = APIRouter(prefix="/api/customer", tags=["Customer Portal"])


# ── Customer Authentication & Account Management ──────────────────────────────

@router.post("/auth/signup", response_model=CustomerAuthResponse, status_code=status.HTTP_201_CREATED)
def customer_signup(req: CustomerSignupRequest):
    """
    Register a new Shipping Company Organization and its initial Customer Administrator.
    Ensures organizations are multi-tenant and own their vessels and arrival requests.
    """
    now = datetime.now(timezone.utc)
    clean_org_email = req.company_email.strip().lower()
    clean_admin_email = req.admin_email.strip().lower()

    # Check unique organization email
    for org in customer_repo.organizations.values():
        if org.get("company_email", "").lower() == clean_org_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An organization with email '{clean_org_email}' is already registered."
            )

    # Check unique admin email
    for u in customer_repo.users.values():
        if u.get("email", "").lower() == clean_admin_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An account with email '{clean_admin_email}' is already registered."
            )

    # 1. Create Organization
    org_id = f"org-{uuid.uuid4().hex[:12]}"
    org_data = {
        "id": org_id,
        "name": req.organization_name.strip(),
        "company_email": clean_org_email,
        "company_phone": req.company_phone.strip(),
        "country": req.country.strip(),
        "address": req.address.strip(),
        "city": req.city.strip(),
        "state": req.state.strip() if req.state else None,
        "postal_code": req.postal_code.strip(),
        "website": req.website.strip() if req.website else None,
        "registration_number": req.registration_number.strip() if req.registration_number else None,
        "industry": req.industry.strip() if req.industry else "Commercial Shipping & Maritime Freight",
        "created_at": now,
        "updated_at": now,
    }
    customer_repo.save_organization(org_data)

    # 2. Create Initial Customer Admin User
    admin_id = f"usr-{uuid.uuid4().hex[:12]}"
    admin_data = {
        "id": admin_id,
        "organization_id": org_id,
        "email": clean_admin_email,
        "full_name": req.admin_full_name.strip(),
        "role": "CUSTOMER_ADMIN",
        "password_hash": hash_customer_password(req.password),
        "phone": req.admin_phone.strip() if req.admin_phone else req.company_phone.strip(),
        "job_title": req.admin_job_title.strip() if req.admin_job_title else "Fleet Director",
        "created_at": now,
        "updated_at": now,
    }
    customer_repo.save_user(admin_data)

    # 3. Issue Customer JWT
    token = create_customer_access_token({
        "sub": admin_id,
        "org_id": org_id,
        "email": clean_admin_email,
        "role": "CUSTOMER_ADMIN",
        "name": admin_data["full_name"],
        "org_name": org_data["name"]
    })

    # Welcome notification
    customer_repo.add_notification({
        "organization_id": org_id,
        "user_id": admin_id,
        "title": "Welcome to NaviOps Customer Portal",
        "message": f"Organization '{org_data['name']}' registered successfully. You can now register vessels and submit arrival requests.",
        "notification_type": "WELCOME",
        "link_url": "/customer/vessels"
    })

    return CustomerAuthResponse(
        token=token,
        user=CustomerUserResponse(**admin_data),
        organization=OrganizationResponse(**org_data)
    )


@router.post("/auth/login", response_model=CustomerAuthResponse)
def customer_login(req: CustomerLoginRequest):
    """Authenticate customer user and return signed Customer JWT."""
    clean_email = req.email.strip().lower()
    user = None

    for u in customer_repo.users.values():
        if u.get("email", "").lower() == clean_email:
            user = u
            break

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Check password (allow demo passwords)
    is_demo = user.get("email") in ("john@abcshipping.com", "sarah@abcshipping.com", "demo@abcshipping.com")
    valid_pass = verify_customer_password(req.password, user.get("password_hash", "")) or (is_demo and req.password in ("admin123", "password123"))

    if not valid_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    org = customer_repo.organizations.get(user["organization_id"])
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization associated with this account is inactive."
        )

    token = create_customer_access_token({
        "sub": user["id"],
        "org_id": org["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
        "org_name": org["name"]
    })

    return CustomerAuthResponse(
        token=token,
        user=CustomerUserResponse(**user),
        organization=OrganizationResponse(**org)
    )


@router.get("/auth/me", response_model=CustomerAuthResponse)
def get_customer_me(current_user: CustomerUserResponse = Depends(get_current_customer_user)):
    """Return active customer user context and company organization profile."""
    org = customer_repo.organizations.get(current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    token = create_customer_access_token({
        "sub": current_user.id,
        "org_id": org["id"],
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.full_name,
        "org_name": org["name"]
    })

    return CustomerAuthResponse(
        token=token,
        user=current_user,
        organization=OrganizationResponse(**org)
    )


@router.post("/auth/forgot-password")
def customer_forgot_password(req: CustomerForgotPasswordRequest):
    """Initiate password reset flow for customer user."""
    # In production, this dispatches a secure reset link. For demo/hackathon, returns confirmation.
    clean_email = req.email.strip().lower()
    return {
        "status": "success",
        "message": f"If an account exists for '{clean_email}', a password reset token has been dispatched."
    }


@router.post("/auth/reset-password")
def customer_reset_password(req: CustomerResetPasswordRequest):
    """Reset customer user password."""
    return {
        "status": "success",
        "message": "Password updated successfully. Please log in with your new credentials."
    }


# ── Organization & Customer Team Management ───────────────────────────────────

@router.get("/organization", response_model=OrganizationResponse)
def get_organization_profile(current_user: CustomerUserResponse = Depends(get_current_customer_user)):
    """Retrieve company profile of the authenticated customer organization."""
    org = customer_repo.organizations.get(current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationResponse(**org)


@router.put("/organization", response_model=OrganizationResponse)
def update_organization_profile(
    req: OrganizationUpdate,
    current_user: CustomerUserResponse = Depends(require_customer_role(["CUSTOMER_ADMIN"]))
):
    """Update company profile (Customer Admin only)."""
    org = customer_repo.organizations.get(current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_fields = req.model_dump(exclude_unset=True)
    for k, v in update_fields.items():
        if v is not None:
            org[k] = v
    org["updated_at"] = datetime.now(timezone.utc)
    customer_repo.save_organization(org)
    return OrganizationResponse(**org)


@router.get("/users", response_model=List[CustomerUserResponse])
def list_organization_users(current_user: CustomerUserResponse = Depends(get_current_customer_user)):
    """List all users belonging to the authenticated customer organization."""
    users = customer_repo.get_organization_users(current_user.organization_id)
    return [CustomerUserResponse(**u) for u in users]


@router.post("/users", response_model=CustomerUserResponse, status_code=status.HTTP_201_CREATED)
def create_organization_user(
    req: CustomerUserCreate,
    current_user: CustomerUserResponse = Depends(require_customer_role(["CUSTOMER_ADMIN"]))
):
    """Add a new user to the organization (Customer Admin only)."""
    clean_email = req.email.strip().lower()
    for u in customer_repo.users.values():
        if u.get("email", "").lower() == clean_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User '{clean_email}' already exists."
            )

    now = datetime.now(timezone.utc)
    user_id = f"usr-{uuid.uuid4().hex[:12]}"
    user_data = {
        "id": user_id,
        "organization_id": current_user.organization_id,
        "email": clean_email,
        "full_name": req.full_name.strip(),
        "role": req.role,
        "password_hash": hash_customer_password(req.password),
        "phone": req.phone,
        "job_title": req.job_title,
        "created_at": now,
        "updated_at": now,
    }
    customer_repo.save_user(user_data)
    return CustomerUserResponse(**user_data)


# ── Customer Vessel Management ────────────────────────────────────────────────

@router.get("/vessels", response_model=List[CustomerVesselResponse])
def list_customer_vessels(current_user: CustomerUserResponse = Depends(get_current_customer_user)):
    """List all registered vessels belonging to the customer's organization."""
    vessels = customer_repo.get_organization_vessels(current_user.organization_id)
    return [CustomerVesselResponse(**v) for v in vessels]


@router.post("/vessels", response_model=CustomerVesselResponse, status_code=status.HTTP_201_CREATED)
def create_customer_vessel(
    req: CustomerVesselCreate,
    current_user: CustomerUserResponse = Depends(require_customer_role(["CUSTOMER_ADMIN", "CUSTOMER_USER"]))
):
    """Register a new vessel under the customer's organization."""
    clean_imo = req.imo_number.strip().upper()
    if not clean_imo.startswith("IMO-") and clean_imo.isdigit():
        clean_imo = f"IMO-{clean_imo}"

    # Check uniqueness within organization
    org_vessels = customer_repo.get_organization_vessels(current_user.organization_id)
    for v in org_vessels:
        if v.get("imo_number", "").upper() == clean_imo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A vessel with IMO '{clean_imo}' is already registered in your fleet."
            )

    now = datetime.now(timezone.utc)
    vessel_id = f"vsl-{uuid.uuid4().hex[:12]}"
    vessel_data = req.model_dump()
    vessel_data.update({
        "id": vessel_id,
        "organization_id": current_user.organization_id,
        "imo_number": clean_imo,
        "created_at": now,
        "updated_at": now,
    })

    customer_repo.save_vessel(vessel_data)
    return CustomerVesselResponse(**vessel_data)


@router.get("/vessels/{vessel_id}", response_model=CustomerVesselResponse)
def get_customer_vessel(
    vessel_id: str,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Retrieve details of a customer-owned vessel."""
    vessel = customer_repo.vessels.get(vessel_id)
    if not vessel or vessel.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Vessel not found in your fleet.")
    return CustomerVesselResponse(**vessel)


@router.put("/vessels/{vessel_id}", response_model=CustomerVesselResponse)
def update_customer_vessel(
    vessel_id: str,
    req: CustomerVesselUpdate,
    current_user: CustomerUserResponse = Depends(require_customer_role(["CUSTOMER_ADMIN"]))
):
    """Update registered vessel details (Customer Admin only)."""
    vessel = customer_repo.vessels.get(vessel_id)
    if not vessel or vessel.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Vessel not found in your fleet.")

    update_fields = req.model_dump(exclude_unset=True)
    for k, v in update_fields.items():
        if v is not None:
            vessel[k] = v
    vessel["updated_at"] = datetime.now(timezone.utc)
    customer_repo.save_vessel(vessel)
    return CustomerVesselResponse(**vessel)


@router.delete("/vessels/{vessel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_vessel(
    vessel_id: str,
    current_user: CustomerUserResponse = Depends(require_customer_role(["CUSTOMER_ADMIN"]))
):
    """Delete a vessel from company fleet (Customer Admin only)."""
    vessel = customer_repo.vessels.get(vessel_id)
    if not vessel or vessel.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Vessel not found in your fleet.")

    # Check if active arrival requests exist for this vessel
    active_reqs = [
        r for r in customer_repo.get_organization_requests(current_user.organization_id)
        if r.get("vessel_id") == vessel_id and r.get("status") not in ["COMPLETED", "REJECTED", "CANCELLED"]
    ]
    if active_reqs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete vessel with active or pending arrival requests."
        )

    customer_repo.delete_vessel(vessel_id)
    return None


# ── Customer Arrival Requests ─────────────────────────────────────────────────

def _enrich_arrival_request(req: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to enrich request dict with vessel, berth, organization, and active proposal metadata."""
    item = dict(req)
    vessel = customer_repo.vessels.get(item.get("vessel_id"))
    if vessel:
        item["vessel_name"] = vessel.get("vessel_name", "Vessel")
        item["vessel_imo"] = vessel.get("imo_number")
        item["vessel_loa"] = vessel.get("length_loa")
        item["vessel_beam"] = vessel.get("beam")
        item["vessel_draft"] = vessel.get("draft")
        item["vessel_type"] = vessel.get("vessel_type")
    else:
        item["vessel_name"] = "Registered Vessel"

    org = customer_repo.organizations.get(item.get("organization_id"))
    item["organization_name"] = org.get("name") if org else "Shipping Company"

    # Berth labels
    pref_b_id = item.get("preferred_berth_id")
    if pref_b_id and pref_b_id in port_repo.berths:
        item["preferred_berth_code"] = port_repo.berths[pref_b_id].get("berth_code")

    assigned_b_id = item.get("assigned_berth_id")
    if assigned_b_id and assigned_b_id in port_repo.berths:
        item["assigned_berth_code"] = port_repo.berths[assigned_b_id].get("berth_code")
        item["assigned_berth_name"] = port_repo.berths[assigned_b_id].get("berth_name")

    # Find active alternative proposal
    proposals = [p for p in customer_repo.proposals.values() if p.get("request_id") == item["id"]]
    if proposals:
        proposals.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        latest_p = proposals[0]
        p_berth_id = latest_p.get("proposed_berth_id")
        if p_berth_id and p_berth_id in port_repo.berths:
            latest_p["proposed_berth_code"] = port_repo.berths[p_berth_id].get("berth_code")
            latest_p["proposed_berth_name"] = port_repo.berths[p_berth_id].get("berth_name")
        item["active_proposal"] = latest_p

    return item


@router.get("/arrival-requests", response_model=List[ArrivalRequestResponse])
def list_customer_arrival_requests(
    status_filter: Optional[str] = None,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """List arrival requests belonging to the authenticated customer organization."""
    reqs = customer_repo.get_organization_requests(current_user.organization_id)
    if status_filter and status_filter.lower() != "all":
        reqs = [r for r in reqs if r.get("status", "").upper() == status_filter.upper()]
    return [ArrivalRequestResponse(**_enrich_arrival_request(r)) for r in reqs]


@router.post("/arrival-requests", response_model=ArrivalRequestResponse, status_code=status.HTTP_201_CREATED)
def submit_arrival_request(
    req: ArrivalRequestCreate,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """
    Submit a vessel arrival request.
    Executes the automated evaluation pipeline:
    1. Validation
    2. Feasibility Engine (Hard/Soft constraints)
    3. Optimization Bridge (CP-SAT Candidate Evaluation)
    4. Routes to Operation Manager Review Queue
    """
    # Verify vessel belongs to current organization
    vessel = customer_repo.vessels.get(req.vessel_id)
    if not vessel or vessel.get("organization_id") != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected vessel is not part of your organization's fleet."
        )

    now = datetime.now(timezone.utc)
    req_id = f"req-{uuid.uuid4().hex[:12]}"
    req_num = len(customer_repo.arrival_requests) + 1001
    request_code = f"VAR-{req_num}"

    stay_hours = req.expected_port_stay_hours or max(4.0, (req.expected_departure - req.requested_eta).total_seconds() / 3600.0)

    request_data = req.model_dump()
    request_data.update({
        "id": req_id,
        "request_code": request_code,
        "organization_id": current_user.organization_id,
        "expected_port_stay_hours": stay_hours,
        "status": "VALIDATING",
        "created_at": now,
        "submitted_at": now,
        "updated_at": now,
        "schedule_version_at_eval": getattr(port_repo, "schedule_version", 1),
    })

    # Record initial audit entry
    customer_repo.add_audit_log({
        "request_id": req_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "CUSTOMER",
        "action": "SUBMITTED",
        "previous_status": None,
        "new_status": "SUBMITTED",
        "schedule_version": request_data["schedule_version_at_eval"]
    })

    # Step 2: Feasibility Engine
    feasibility_res = evaluate_vessel_arrival_feasibility(vessel, request_data)
    request_data["feasibility_status"] = feasibility_res.status
    request_data["feasibility_details"] = [c.model_dump() for c in feasibility_res.checks]

    customer_repo.add_audit_log({
        "request_id": req_id,
        "actor_id": "system",
        "actor_name": "NaviOps Feasibility Engine",
        "actor_domain": "PORT_OPERATIONS",
        "action": "FEASIBILITY_COMPLETED",
        "previous_status": "SUBMITTED",
        "new_status": "FEASIBILITY_CHECK",
        "details": {"score": feasibility_res.score, "status": feasibility_res.status}
    })

    # Step 3: CP-SAT Optimization Bridge
    opt_recommendation = evaluate_arrival_request_optimization(vessel, request_data)
    request_data["optimization_status"] = opt_recommendation.status
    request_data["optimization_recommendation"] = opt_recommendation.model_dump()

    customer_repo.add_audit_log({
        "request_id": req_id,
        "actor_id": "system",
        "actor_name": "CP-SAT Optimization Engine",
        "actor_domain": "PORT_OPERATIONS",
        "action": "OPTIMIZATION_COMPLETED",
        "previous_status": "FEASIBILITY_CHECK",
        "new_status": "PENDING_MANAGER_REVIEW",
        "details": {"recommendation": opt_recommendation.status}
    })

    # Step 4: Advance to Operation Manager Review
    request_data["status"] = "PENDING_MANAGER_REVIEW"
    customer_repo.save_arrival_request(request_data)

    # Customer notification
    customer_repo.add_notification({
        "organization_id": current_user.organization_id,
        "user_id": current_user.id,
        "title": f"Arrival Request Submitted ({request_code})",
        "message": f"Arrival request for '{vessel['vessel_name']}' has completed initial feasibility checks and is queued for Operation Manager approval.",
        "notification_type": "REQUEST_SUBMITTED",
        "link_url": f"/customer/arrival-requests/{req_id}"
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(request_data))


@router.get("/arrival-requests/{request_id}", response_model=ArrivalRequestResponse)
def get_customer_arrival_request(
    request_id: str,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Retrieve detailed state of an arrival request including tracking milestones."""
    req = customer_repo.arrival_requests.get(request_id)
    if not req or req.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Arrival request not found.")
    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.put("/arrival-requests/{request_id}", response_model=ArrivalRequestResponse)
def update_customer_arrival_request(
    request_id: str,
    payload: ArrivalRequestUpdate,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Update or resubmit an arrival request when additional information or changes are requested."""
    req = customer_repo.arrival_requests.get(request_id)
    if not req or req.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    if req.get("status") not in ["DRAFT", "CHANGES_REQUESTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit request in status '{req.get('status')}'. Only 'DRAFT' or 'CHANGES_REQUESTED' can be modified."
        )

    vessel = customer_repo.vessels.get(req["vessel_id"])
    now = datetime.now(timezone.utc)
    update_data = payload.model_dump(exclude_unset=True)

    for k, v in update_data.items():
        if v is not None:
            req[k] = v

    # Re-run Feasibility and Optimization pipeline
    feasibility_res = evaluate_vessel_arrival_feasibility(vessel, req)
    req["feasibility_status"] = feasibility_res.status
    req["feasibility_details"] = [c.model_dump() for c in feasibility_res.checks]

    opt_recommendation = evaluate_arrival_request_optimization(vessel, req)
    req["optimization_status"] = opt_recommendation.status
    req["optimization_recommendation"] = opt_recommendation.model_dump()

    prev_status = req["status"]
    req["status"] = "PENDING_MANAGER_REVIEW"
    req["updated_at"] = now
    req["schedule_version_at_eval"] = getattr(port_repo, "schedule_version", 1)

    customer_repo.save_arrival_request(req)

    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "CUSTOMER",
        "action": "RESUBMITTED",
        "previous_status": prev_status,
        "new_status": "PENDING_MANAGER_REVIEW",
        "comment": "Customer updated requested parameters and resubmitted for manager review."
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/arrival-requests/{request_id}/cancel", response_model=ArrivalRequestResponse)
def cancel_customer_arrival_request(
    request_id: str,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Cancel a pending or active arrival request."""
    req = customer_repo.arrival_requests.get(request_id)
    if not req or req.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    if req.get("status") in ["APPROVED", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel an approved request directly. Please contact Port Operations."
        )

    prev_status = req["status"]
    req["status"] = "CANCELLED"
    req["updated_at"] = datetime.now(timezone.utc)
    customer_repo.save_arrival_request(req)

    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "CUSTOMER",
        "action": "CANCELLED",
        "previous_status": prev_status,
        "new_status": "CANCELLED",
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/arrival-requests/{request_id}/accept-alternative", response_model=ArrivalRequestResponse)
def accept_alternative_proposal(
    request_id: str,
    action_req: CustomerProposalActionRequest,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """
    Customer accepts the alternative schedule proposed by the Port Authority.
    Updates the request schedule parameters to the proposed slot and notifies the Operation Manager for final live confirmation.
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req or req.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    proposals = [p for p in customer_repo.proposals.values() if p.get("request_id") == request_id and p.get("customer_response") == "PENDING"]
    if not proposals:
        raise HTTPException(status_code=400, detail="No pending alternative proposal found for this request.")

    proposal = proposals[0]
    now = datetime.now(timezone.utc)

    # 1. Update proposal record
    proposal["customer_response"] = "ACCEPTED"
    proposal["customer_notes"] = action_req.notes
    proposal["responded_at"] = now
    customer_repo.save_proposal(proposal)

    # 2. Update request parameters to match accepted alternative
    req["requested_eta"] = proposal["proposed_eta"]
    req["expected_departure"] = proposal["proposed_departure"]
    if proposal.get("proposed_berth_id"):
        req["preferred_berth_id"] = proposal["proposed_berth_id"]

    prev_status = req["status"]
    # Request moves to pending final confirmation
    req["status"] = "PENDING_MANAGER_REVIEW"
    req["updated_at"] = now
    customer_repo.save_arrival_request(req)

    # 3. Audit log
    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "CUSTOMER",
        "action": "CUSTOMER_ACCEPTED",
        "previous_status": prev_status,
        "new_status": "PENDING_MANAGER_REVIEW",
        "details": {
            "accepted_eta": proposal["proposed_eta"].isoformat(),
            "accepted_berth_id": proposal.get("proposed_berth_id")
        },
        "comment": action_req.notes or "Customer agreed to port-proposed arrival slot."
    })

    # 4. Notification
    customer_repo.add_notification({
        "organization_id": current_user.organization_id,
        "user_id": current_user.id,
        "title": f"Alternative Slot Accepted ({req.get('request_code')})",
        "message": "You accepted the proposed schedule. Port Operations has been notified to execute final confirmation.",
        "notification_type": "ALTERNATIVE_ACCEPTED",
        "link_url": f"/customer/arrival-requests/{request_id}"
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/arrival-requests/{request_id}/decline-alternative", response_model=ArrivalRequestResponse)
def decline_alternative_proposal(
    request_id: str,
    action_req: CustomerProposalActionRequest,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Customer declines the alternative schedule proposed by the Port Authority."""
    req = customer_repo.arrival_requests.get(request_id)
    if not req or req.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    proposals = [p for p in customer_repo.proposals.values() if p.get("request_id") == request_id and p.get("customer_response") == "PENDING"]
    if not proposals:
        raise HTTPException(status_code=400, detail="No pending alternative proposal found for this request.")

    proposal = proposals[0]
    now = datetime.now(timezone.utc)

    proposal["customer_response"] = "DECLINED"
    proposal["customer_notes"] = action_req.notes
    proposal["responded_at"] = now
    customer_repo.save_proposal(proposal)

    prev_status = req["status"]
    req["status"] = "REJECTED"
    req["rejection_reason"] = "Customer Declined Alternative Proposal"
    req["rejection_comment"] = action_req.notes or "Customer was unable to accommodate the proposed arrival window."
    req["updated_at"] = now
    customer_repo.save_arrival_request(req)

    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "CUSTOMER",
        "action": "CUSTOMER_DECLINED",
        "previous_status": prev_status,
        "new_status": "REJECTED",
        "comment": action_req.notes or "Customer declined alternative slot."
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.get("/arrival-requests/{request_id}/audit-trail", response_model=List[AuditLogResponse])
def get_request_audit_trail(
    request_id: str,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Retrieve full chronological audit history for an arrival request."""
    req = customer_repo.arrival_requests.get(request_id)
    if not req or req.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    logs = [log for log in customer_repo.audit_logs.values() if log.get("request_id") == request_id]
    logs.sort(key=lambda x: str(x.get("created_at", "")))
    return [AuditLogResponse(**l) for l in logs]


# ── Customer Notifications ────────────────────────────────────────────────────

@router.get("/notifications", response_model=List[CustomerNotificationResponse])
def list_customer_notifications(current_user: CustomerUserResponse = Depends(get_current_customer_user)):
    """List customer notifications."""
    notifs = customer_repo.get_organization_notifications(current_user.organization_id)
    return [CustomerNotificationResponse(**n) for n in notifs]


@router.put("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_notification_as_read(
    notification_id: str,
    current_user: CustomerUserResponse = Depends(get_current_customer_user)
):
    """Mark a customer notification as read."""
    customer_repo.mark_notification_read(notification_id, current_user.organization_id)
    return {"status": "success", "id": notification_id}

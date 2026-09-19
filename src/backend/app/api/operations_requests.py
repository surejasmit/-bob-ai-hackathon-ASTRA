import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends

from app.core.database import port_repo
from app.core.auth import get_current_user, require_role
from app.models.schemas import UserResponse
from app.customer.database import customer_repo
from app.customer.schemas import (
    ArrivalRequestResponse,
    ApproveRequestPayload,
    ProposeAlternativeRequest,
    RequestChangesPayload,
    RejectRequestPayload,
    AuditLogResponse,
)
from app.customer.services.feasibility import evaluate_vessel_arrival_feasibility
from app.customer.services.optimization_bridge import evaluate_arrival_request_optimization
from app.customer.router import _enrich_arrival_request

logger = logging.getLogger("naviops.operations.arrival_requests")

router = APIRouter(prefix="/api/operations/arrival-requests", tags=["Operations — Arrival Requests Review"])


@router.get("", response_model=List[ArrivalRequestResponse])
def list_incoming_vessel_requests(
    status_filter: Optional[str] = None,
    current_user: UserResponse = Depends(require_role(["admin", "operations", "viewer"]))
):
    """
    List all incoming customer vessel arrival requests for the Operation Manager dashboard.
    Enriched with customer company, vessel specifications, feasibility status, and optimization recommendations.
    """
    reqs = list(customer_repo.arrival_requests.values())
    if status_filter and status_filter.lower() != "all":
        reqs = [r for r in reqs if r.get("status", "").upper() == status_filter.upper()]

    reqs.sort(key=lambda x: str(x.get("submitted_at", x.get("created_at", ""))), reverse=True)
    return [ArrivalRequestResponse(**_enrich_arrival_request(r)) for r in reqs]


@router.get("/{request_id}", response_model=ArrivalRequestResponse)
def get_incoming_vessel_request_detail(
    request_id: str,
    current_user: UserResponse = Depends(require_role(["admin", "operations", "viewer"]))
):
    """
    Detailed Operation Manager inspection view of a customer arrival request.
    Includes full feasibility checklist, CP-SAT schedule impact, and active proposals.
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Arrival request not found.")
    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/{request_id}/simulate")
def simulate_request_approval(
    request_id: str,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """
    What-If Sandbox Simulation for Operation Manager.
    Simulates operational impact of approving this request without modifying live port state.
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    vessel = customer_repo.vessels.get(req["vessel_id"])
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found.")

    # Run CP-SAT evaluation
    opt_rec = evaluate_arrival_request_optimization(vessel, req)
    return {
        "request_id": request_id,
        "recommendation": opt_rec.model_dump(),
        "simulated_at": datetime.now(timezone.utc).isoformat(),
        "live_schedule_version": getattr(port_repo, "schedule_version", 1)
    }


@router.post("/{request_id}/approve", response_model=ArrivalRequestResponse)
def approve_vessel_arrival_request(
    request_id: str,
    payload: ApproveRequestPayload,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """
    Operation Manager final decision: APPROVE vessel arrival request.
    1. Validates current schedule_version (Stale Optimization Protection)
    2. Re-validates hard physical & quayside constraints
    3. Commits vessel & berth allocation into live Port Vessels & Schedules
    4. Bumps schedule_version
    5. Records audit event & notifies customer
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    if req.get("status") in ["APPROVED", "COMPLETED"]:
        raise HTTPException(status_code=400, detail="Request has already been approved.")

    now = datetime.now(timezone.utc)
    current_version = getattr(port_repo, "schedule_version", 1)

    # 1. Stale Optimization Protection
    if payload.schedule_version is not None and payload.schedule_version != current_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Optimization Outdated: Schedule version changed from v{payload.schedule_version} to v{current_version}. Please refresh optimization results before approving."
        )

    vessel = customer_repo.vessels.get(req["vessel_id"])
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found.")

    # 2. Final Hard Constraint Revalidation
    feasibility = evaluate_vessel_arrival_feasibility(vessel, req)
    if feasibility.status == "FAIL":
        fail_reasons = [c.details for c in feasibility.checks if not c.passed]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request failing hard constraints: {'; '.join(fail_reasons)}"
        )

    # 3. Determine Final Berth & Schedule Window
    assigned_berth_id = payload.berth_id or req.get("assigned_berth_id") or req.get("preferred_berth_id")
    if not assigned_berth_id or assigned_berth_id not in port_repo.berths:
        # Find first compatible operable berth
        v_loa = float(vessel.get("length_loa", 300.0))
        compat = [b for b in port_repo.berths.values() if float(b.get("max_vessel_length", 0)) >= v_loa and b.get("status") != "Unavailable"]
        if compat:
            assigned_berth_id = compat[0]["id"]
        else:
            assigned_berth_id = list(port_repo.berths.keys())[0]

    assigned_start = payload.assigned_start or req.get("requested_eta")
    if isinstance(assigned_start, str):
        assigned_start = datetime.fromisoformat(assigned_start.replace("Z", "+00:00"))

    assigned_end = payload.assigned_end or req.get("expected_departure")
    if isinstance(assigned_end, str):
        assigned_end = datetime.fromisoformat(assigned_end.replace("Z", "+00:00"))

    # 4. Commit into Live Port Operations (port_repo.vessels)
    live_vessel_code = vessel.get("imo_number") or req.get("request_code")
    existing_vsl = next((v for v in port_repo.vessels.values() if v.get("vessel_code") == live_vessel_code), None)

    if existing_vsl:
        live_vessel_id = existing_vsl["id"]
        live_vessel_record = dict(existing_vsl)
        live_vessel_record.update({
            "vessel_name": vessel.get("vessel_name", "Vessel"),
            "shipping_line": vessel.get("operator_name") or "Customer Line",
            "cargo_type": req.get("cargo_type", "Container"),
            "cargo_volume": int(req.get("cargo_quantity", 1000)),
            "vessel_length": float(vessel.get("length_loa", 300.0)),
            "eta": assigned_start,
            "etd": assigned_end,
            "status": "Scheduled",
            "assigned_berth_id": assigned_berth_id,
            "updated_at": now
        })
    else:
        live_vessel_id = str(uuid.uuid4())
        live_vessel_record = {
            "id": live_vessel_id,
            "vessel_code": live_vessel_code,
            "vessel_name": vessel.get("vessel_name", "Vessel"),
            "shipping_line": vessel.get("operator_name") or "Customer Line",
            "cargo_type": req.get("cargo_type", "Container"),
            "cargo_volume": int(req.get("cargo_quantity", 1000)),
            "vessel_length": float(vessel.get("length_loa", 300.0)),
            "arrival_time": None,
            "eta": assigned_start,
            "etd": assigned_end,
            "priority": 2,
            "status": "Scheduled",
            "assigned_berth_id": assigned_berth_id,
            "expected_waiting_time": 0.0,
            "created_at": now,
            "updated_at": now
        }
    port_repo.vessels[live_vessel_id] = live_vessel_record

    # 5. Bump schedule_version
    port_repo.schedule_version += 1

    # 6. Update arrival request state
    prev_status = req["status"]
    req["status"] = "APPROVED"
    req["assigned_berth_id"] = assigned_berth_id
    req["approved_start"] = assigned_start
    req["approved_end"] = assigned_end
    req["reviewed_by"] = current_user.id
    req["reviewed_at"] = now
    req["updated_at"] = now
    customer_repo.save_arrival_request(req)

    # 7. Audit log
    b_code = port_repo.berths.get(assigned_berth_id, {}).get("berth_code", "Berth")
    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "PORT_OPERATIONS",
        "action": "APPROVED",
        "previous_status": prev_status,
        "new_status": "APPROVED",
        "details": {
            "assigned_berth": b_code,
            "approved_start": assigned_start.isoformat(),
            "approved_end": assigned_end.isoformat(),
            "live_vessel_id": live_vessel_id
        },
        "schedule_version": port_repo.schedule_version,
        "comment": f"Approved by Operation Manager {current_user.full_name}. Committed to live schedule on {b_code}."
    })

    # 8. Notify customer
    customer_repo.add_notification({
        "organization_id": req["organization_id"],
        "title": f"Arrival Request Approved ({req.get('request_code')})",
        "message": f"Vessel '{vessel['vessel_name']}' has been officially APPROVED for arrival at {b_code} on {assigned_start.strftime('%d %b %H:%M UTC')}.",
        "notification_type": "REQUEST_APPROVED",
        "link_url": f"/customer/arrival-requests/{request_id}"
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/{request_id}/propose-alternative", response_model=ArrivalRequestResponse)
def propose_alternative_schedule(
    request_id: str,
    payload: ProposeAlternativeRequest,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """
    Operation Manager proposes an alternative arrival slot and/or berth.
    Moves request into ALTERNATIVE_PROPOSED / CUSTOMER_RESPONSE_REQUIRED state.
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    vessel = customer_repo.vessels.get(req["vessel_id"])
    now = datetime.now(timezone.utc)
    proposal_id = f"prop-{uuid.uuid4().hex[:12]}"

    proposal_data = {
        "id": proposal_id,
        "request_id": request_id,
        "proposed_eta": payload.proposed_eta,
        "proposed_departure": payload.proposed_departure,
        "proposed_berth_id": payload.proposed_berth_id or req.get("preferred_berth_id"),
        "operational_reason": payload.operational_reason.strip(),
        "customer_response": "PENDING",
        "proposed_by": current_user.id,
        "created_at": now,
    }
    customer_repo.save_proposal(proposal_data)

    prev_status = req["status"]
    req["status"] = "ALTERNATIVE_PROPOSED"
    req["reviewed_by"] = current_user.id
    req["reviewed_at"] = now
    req["updated_at"] = now
    customer_repo.save_arrival_request(req)

    # Audit log
    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "PORT_OPERATIONS",
        "action": "ALTERNATIVE_PROPOSED",
        "previous_status": prev_status,
        "new_status": "ALTERNATIVE_PROPOSED",
        "details": {
            "proposed_eta": payload.proposed_eta.isoformat(),
            "proposed_departure": payload.proposed_departure.isoformat(),
            "proposed_berth_id": payload.proposed_berth_id
        },
        "reason": payload.operational_reason,
        "comment": f"Operation Manager proposed alternative slot: {payload.operational_reason}"
    })

    # Customer notification
    customer_repo.add_notification({
        "organization_id": req["organization_id"],
        "title": f"Alternative Slot Proposed ({req.get('request_code')})",
        "message": f"Port Operations proposed an alternative arrival window for '{vessel['vessel_name']}'. Please review and accept or decline.",
        "notification_type": "ALTERNATIVE_PROPOSED",
        "link_url": f"/customer/arrival-requests/{request_id}"
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/{request_id}/request-changes", response_model=ArrivalRequestResponse)
def request_changes_from_customer(
    request_id: str,
    payload: RequestChangesPayload,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """
    Operation Manager requests additional information or schedule updates from the customer.
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    vessel = customer_repo.vessels.get(req["vessel_id"])
    now = datetime.now(timezone.utc)
    prev_status = req["status"]

    req["status"] = "CHANGES_REQUESTED"
    req["changes_requested_notes"] = payload.notes.strip()
    req["reviewed_by"] = current_user.id
    req["reviewed_at"] = now
    req["updated_at"] = now
    customer_repo.save_arrival_request(req)

    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "PORT_OPERATIONS",
        "action": "CHANGES_REQUESTED",
        "previous_status": prev_status,
        "new_status": "CHANGES_REQUESTED",
        "comment": payload.notes.strip()
    })

    customer_repo.add_notification({
        "organization_id": req["organization_id"],
        "title": f"Information Requested ({req.get('request_code')})",
        "message": f"Port Operations has requested updates for '{vessel['vessel_name']}': {payload.notes.strip()}",
        "notification_type": "CHANGES_REQUESTED",
        "link_url": f"/customer/arrival-requests/{request_id}"
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.post("/{request_id}/reject", response_model=ArrivalRequestResponse)
def reject_vessel_arrival_request(
    request_id: str,
    payload: RejectRequestPayload,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """
    Operation Manager rejects the arrival request with structured justification and audit log.
    """
    req = customer_repo.arrival_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Arrival request not found.")

    if payload.reason == "Other" and not payload.comment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A descriptive comment is required when rejection reason is 'Other'."
        )

    vessel = customer_repo.vessels.get(req["vessel_id"])
    now = datetime.now(timezone.utc)
    prev_status = req["status"]

    req["status"] = "REJECTED"
    req["rejection_reason"] = payload.reason
    req["rejection_comment"] = payload.comment.strip() if payload.comment else None
    req["reviewed_by"] = current_user.id
    req["reviewed_at"] = now
    req["updated_at"] = now
    customer_repo.save_arrival_request(req)

    customer_repo.add_audit_log({
        "request_id": request_id,
        "actor_id": current_user.id,
        "actor_name": current_user.full_name,
        "actor_domain": "PORT_OPERATIONS",
        "action": "REJECTED",
        "previous_status": prev_status,
        "new_status": "REJECTED",
        "reason": payload.reason,
        "comment": payload.comment
    })

    customer_repo.add_notification({
        "organization_id": req["organization_id"],
        "title": f"Arrival Request Declined ({req.get('request_code')})",
        "message": f"Arrival request for '{vessel['vessel_name']}' was declined. Reason: {payload.reason}.",
        "notification_type": "REQUEST_REJECTED",
        "link_url": f"/customer/arrival-requests/{request_id}"
    })

    return ArrivalRequestResponse(**_enrich_arrival_request(req))


@router.get("/{request_id}/audit-trail", response_model=List[AuditLogResponse])
def get_operations_audit_trail(
    request_id: str,
    current_user: UserResponse = Depends(require_role(["admin", "operations", "viewer"]))
):
    """View full auditable history of the request."""
    logs = [log for log in customer_repo.audit_logs.values() if log.get("request_id") == request_id]
    logs.sort(key=lambda x: str(x.get("created_at", "")))
    return [AuditLogResponse(**l) for l in logs]

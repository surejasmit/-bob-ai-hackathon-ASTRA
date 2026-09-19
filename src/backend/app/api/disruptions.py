import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import port_repo
from app.core.auth import get_current_user, require_role
from app.models.schemas import (
    DisruptionCreate,
    DisruptionUpdate,
    DisruptionResponse,
    UserResponse,
    SentinelAlertResponse,
    SentinelAlertItem
)

import logging
from app.core.config import settings
from app.core.database import clean_row, SyncedTable

logger = logging.getLogger("naviops.disruptions")

router = APIRouter(prefix="/api/disruptions", tags=["Disruptions"])


@router.get("", response_model=List[DisruptionResponse])
def get_all_disruptions(
    status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List operational disruptions and incident logs (Read-Only).
    Strictly reads existing database records without creating, seeding, or modifying data.
    """
    if port_repo.is_connected or settings.clean_database_url:
        try:
            conn = port_repo.get_connection()
            if conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM disruptions")
                    db_disruptions = [clean_row(r) for r in cur.fetchall()]
                    port_repo.disruptions.clear()
                    for d in db_disruptions:
                        super(SyncedTable, port_repo.disruptions).__setitem__(d["id"], d)
        except Exception as e:
            logger.warning(f"Failed to refresh disruptions from PostgreSQL: {e}")

    disruptions = list(port_repo.disruptions.values())
    if status:
        disruptions = [d for d in disruptions if d.get("status", "").lower() == status.lower()]

    # Deduplicate by id to prevent any in-memory double-counting
    seen_ids = set()
    unique_disruptions = []
    for d in disruptions:
        did = d.get("id")
        if did and did not in seen_ids:
            seen_ids.add(did)
            unique_disruptions.append(d)
    disruptions = unique_disruptions

    disruptions.sort(key=lambda d: str(d.get("created_at", "")), reverse=True)
    return [DisruptionResponse(**d) for d in disruptions]


@router.get("/sentinel", response_model=SentinelAlertResponse)
def get_disruption_sentinel(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Proactive Disruption Sentinel.
    Evaluates active incidents, identifies at-risk vessels, quantifies financial risk,
    and drafts an automated 1-click mitigation runbook plan.
    """
    active_disruptions = [d for d in port_repo.disruptions.values() if d.get("status") == "Active"]
    alerts = []
    total_risk = 0.0
    all_at_risk_vessel_ids = set()

    for d in active_disruptions:
        res_type = d.get("affected_resource_type", "").lower()
        res_id = d.get("affected_resource_id")
        severity = d.get("severity", "Medium")

        impacted_vessels = []
        if res_type == "berth" and res_id:
            for v in port_repo.vessels.values():
                if v.get("assigned_berth_id") == res_id:
                    impacted_vessels.append(v.get("vessel_name", v.get("vessel_code", "Vessel")))
                    all_at_risk_vessel_ids.add(v.get("id"))
        elif res_type == "crane" and res_id:
            crane = port_repo.cranes.get(res_id)
            if crane and crane.get("assigned_berth_id"):
                c_berth_id = crane.get("assigned_berth_id")
                for v in port_repo.vessels.values():
                    if v.get("assigned_berth_id") == c_berth_id:
                        impacted_vessels.append(v.get("vessel_name", v.get("vessel_code", "Vessel")))
                        all_at_risk_vessel_ids.add(v.get("id"))
        elif res_type == "vessel" and res_id:
            v = port_repo.vessels.get(res_id)
            if v:
                impacted_vessels.append(v.get("vessel_name", v.get("vessel_code", "Vessel")))
                all_at_risk_vessel_ids.add(v.get("id"))

        if not impacted_vessels:
            waiting_vessels = [v for v in port_repo.vessels.values() if v.get("status") in ["Waiting", "Delayed"]]
            impacted_vessels = [v.get("vessel_name", "Vessel") for v in waiting_vessels[:2]]

        sev_multiplier = {"Critical": 45000.0, "High": 25000.0, "Medium": 12000.0, "Low": 5000.0}.get(severity, 10000.0)
        risk_exposure = round(sev_multiplier * max(1, len(impacted_vessels)), 2)
        total_risk += risk_exposure

        if res_type == "berth":
            rec_action = "Reroute affected vessels to adjacent available berths via 72h CP-SAT optimizer."
        elif res_type == "crane":
            rec_action = "Reassign backup operational STS cranes to maintain container moves/hr target."
        else:
            rec_action = "Trigger 72h CP-SAT optimization to minimize downstream liner delays."

        alerts.append(
            SentinelAlertItem(
                id=d.get("id", str(uuid.uuid4())),
                disruption_title=d.get("title", "Operational Disruption"),
                severity=severity,
                affected_resource=f"{res_type.upper()}: {res_id or 'Port General'}",
                at_risk_vessels=impacted_vessels,
                estimated_risk_usd=risk_exposure,
                recommended_action=rec_action
            )
        )

    has_threat = len(alerts) > 0
    overall_recommendation = (
        f"Critical operational risks detected across {len(alerts)} active incidents. "
        f"Immediate 72-hour CP-SAT optimization recommended to safeguard ${total_risk:,.0f} in demurrage exposure."
        if has_threat else "All quayside and yard operations nominal. No active disruption threats detected."
    )

    return SentinelAlertResponse(
        has_threat=has_threat,
        active_alerts=alerts,
        total_risk_exposure_usd=round(total_risk, 2),
        total_at_risk_vessels=len(all_at_risk_vessel_ids),
        recommended_action=overall_recommendation,
        runbook_plan_ready=has_threat
    )


@router.post("", response_model=DisruptionResponse, status_code=status.HTTP_201_CREATED)
def create_disruption(
    payload: DisruptionCreate,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """
    Log an active disruption / impediment (Operations & Admin).
    Automatically propagates affected status to the corresponding crane, berth, or yard.
    """
    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    data = payload.model_dump()
    data.update({
        "id": new_id,
        "start_time": data.get("start_time") or now,
        "created_at": now
    })
    port_repo.disruptions[new_id] = data

    # Automatic side effect propagation
    res_type = data.get("affected_resource_type")
    res_id = data.get("affected_resource_id")
    if res_id:
        if res_type == "crane" and res_id in port_repo.cranes:
            crane = dict(port_repo.cranes[res_id])
            if "fail" in data.get("disruption_type", "").lower():
                crane["status"] = "Failed"
            else:
                crane["status"] = "Maintenance"
            crane["updated_at"] = now
            port_repo.cranes[res_id] = crane
        elif res_type == "berth" and res_id in port_repo.berths:
            berth = dict(port_repo.berths[res_id])
            berth["status"] = "Maintenance"
            berth["updated_at"] = now
            port_repo.berths[res_id] = berth
        elif res_type == "vessel" and res_id in port_repo.vessels:
            vessel = dict(port_repo.vessels[res_id])
            vessel["status"] = "Delayed"
            vessel["updated_at"] = now
            port_repo.vessels[res_id] = vessel

    return DisruptionResponse(**data)


@router.put("/{disruption_id}", response_model=DisruptionResponse)
def update_disruption(
    disruption_id: str,
    payload: DisruptionUpdate,
    current_user: UserResponse = Depends(require_role(["admin", "operations"]))
):
    """Update or resolve an operational incident (Operations & Admin)"""
    if disruption_id not in port_repo.disruptions:
        raise HTTPException(status_code=404, detail="Disruption incident not found")

    item = port_repo.disruptions[disruption_id]
    update_data = payload.model_dump(exclude_unset=True)
    item.update(update_data)

    # If resolved, restore affected resource if feasible
    if update_data.get("status") in ["Resolved", "Mitigated"]:
        res_type = item.get("affected_resource_type")
        res_id = item.get("affected_resource_id")
        now = datetime.now(timezone.utc)
        if res_id:
            if res_type == "crane" and res_id in port_repo.cranes:
                crane = dict(port_repo.cranes[res_id])
                crane["status"] = "Available"
                crane["updated_at"] = now
                port_repo.cranes[res_id] = crane
            elif res_type == "berth" and res_id in port_repo.berths:
                berth = dict(port_repo.berths[res_id])
                berth["status"] = "Available"
                berth["updated_at"] = now
                port_repo.berths[res_id] = berth
            elif res_type == "vessel" and res_id in port_repo.vessels:
                vessel = dict(port_repo.vessels[res_id])
                if vessel.get("status") == "Delayed":
                    vessel["status"] = "Scheduled"
                    vessel["updated_at"] = now
                    port_repo.vessels[res_id] = vessel

    port_repo.disruptions[disruption_id] = item
    return DisruptionResponse(**item)


@router.delete("/{disruption_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_disruption(
    disruption_id: str,
    current_user: UserResponse = Depends(require_role(["admin"]))
):
    """Delete disruption incident (Admin only)"""
    if disruption_id not in port_repo.disruptions:
        raise HTTPException(status_code=404, detail="Disruption incident not found")
    del port_repo.disruptions[disruption_id]
    return None

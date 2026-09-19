import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, EmailStr, Field


# ── Customer Organization Schemas ─────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Company / Organization Name")
    company_email: EmailStr = Field(..., description="Official Company Email")
    company_phone: str = Field(..., min_length=5, max_length=50, description="Primary Contact Phone")
    country: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=3)
    city: str = Field(..., min_length=2, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: str = Field(..., min_length=2, max_length=30)
    website: Optional[str] = None
    registration_number: Optional[str] = None
    industry: Optional[str] = "Commercial Shipping & Maritime Freight"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    company_phone: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    website: Optional[str] = None
    registration_number: Optional[str] = None
    industry: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    company_email: str
    company_phone: str
    country: str
    address: str
    city: str
    state: Optional[str] = None
    postal_code: str
    website: Optional[str] = None
    registration_number: Optional[str] = None
    industry: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Customer User & Auth Schemas ──────────────────────────────────────────────

CustomerRoleType = Literal["CUSTOMER_ADMIN", "CUSTOMER_USER"]


class CustomerSignupRequest(BaseModel):
    # Organization fields
    organization_name: str = Field(..., min_length=2, max_length=200)
    company_email: EmailStr
    company_phone: str = Field(..., min_length=5, max_length=50)
    country: str
    address: str
    city: str
    state: Optional[str] = None
    postal_code: str
    website: Optional[str] = None
    registration_number: Optional[str] = None
    industry: Optional[str] = "Commercial Shipping & Maritime Freight"

    # Initial Customer Admin User fields
    admin_full_name: str = Field(..., min_length=2, max_length=150)
    admin_email: EmailStr
    password: str = Field(..., min_length=8, description="Must be at least 8 characters")
    admin_phone: Optional[str] = None
    admin_job_title: Optional[str] = "Fleet Operations Director"


class CustomerLoginRequest(BaseModel):
    email: EmailStr
    password: str


class CustomerUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    role: CustomerRoleType = "CUSTOMER_USER"
    password: str = Field(..., min_length=8)
    phone: Optional[str] = None
    job_title: Optional[str] = "Operations Coordinator"


class CustomerUserResponse(BaseModel):
    id: str
    organization_id: str
    email: str
    full_name: str
    role: CustomerRoleType
    phone: Optional[str] = None
    job_title: Optional[str] = None
    created_at: datetime


class CustomerAuthResponse(BaseModel):
    token: str
    user: CustomerUserResponse
    organization: OrganizationResponse


class CustomerForgotPasswordRequest(BaseModel):
    email: EmailStr


class CustomerResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


# ── Customer Vessel Schemas ───────────────────────────────────────────────────

VesselTypeEnum = Literal["Container", "Bulk Carrier", "Tanker", "Ro-Ro", "General Cargo", "LPG/LNG"]


class CustomerVesselCreate(BaseModel):
    vessel_name: str = Field(..., min_length=2, max_length=150)
    imo_number: str = Field(..., min_length=7, max_length=30, description="e.g. IMO-9839438 or 9839438")
    vessel_type: VesselTypeEnum = "Container"
    length_loa: float = Field(..., gt=0, description="Length overall in meters")
    beam: float = Field(..., gt=0, description="Beam in meters")
    draft: float = Field(..., gt=0, description="Max summer draft in meters")
    gross_tonnage: int = Field(..., gt=0)
    deadweight_tonnage: int = Field(..., gt=0)
    flag: str = Field(..., min_length=2, max_length=100)
    operator_name: Optional[str] = None
    cargo_type: str = Field(..., min_length=2, max_length=50)
    cargo_capacity: int = Field(..., gt=0, description="Nominal TEU or MT capacity")
    hazardous_cargo: bool = False
    special_handling_requirements: Optional[str] = None


class CustomerVesselUpdate(BaseModel):
    vessel_name: Optional[str] = None
    vessel_type: Optional[VesselTypeEnum] = None
    length_loa: Optional[float] = Field(None, gt=0)
    beam: Optional[float] = Field(None, gt=0)
    draft: Optional[float] = Field(None, gt=0)
    gross_tonnage: Optional[int] = Field(None, gt=0)
    deadweight_tonnage: Optional[int] = Field(None, gt=0)
    flag: Optional[str] = None
    operator_name: Optional[str] = None
    cargo_type: Optional[str] = None
    cargo_capacity: Optional[int] = Field(None, gt=0)
    hazardous_cargo: Optional[bool] = None
    special_handling_requirements: Optional[str] = None


class CustomerVesselResponse(BaseModel):
    id: str
    organization_id: str
    vessel_name: str
    imo_number: str
    vessel_type: str
    length_loa: float
    beam: float
    draft: float
    gross_tonnage: int
    deadweight_tonnage: int
    flag: str
    operator_name: Optional[str] = None
    cargo_type: str
    cargo_capacity: int
    hazardous_cargo: bool
    special_handling_requirements: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Arrival Request Schemas ───────────────────────────────────────────────────

ArrivalRequestStatus = Literal[
    "DRAFT",
    "SUBMITTED",
    "VALIDATING",
    "FEASIBILITY_CHECK",
    "OPTIMIZATION_RUNNING",
    "PENDING_MANAGER_REVIEW",
    "ALTERNATIVE_PROPOSED",
    "CUSTOMER_RESPONSE_REQUIRED",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "COMPLETED"
]


class FeasibilityCheckItem(BaseModel):
    name: str
    passed: bool
    details: str
    severity: Literal["PASS", "WARN", "FAIL"] = "PASS"


class FeasibilityResult(BaseModel):
    status: Literal["PENDING", "PASS", "WARN", "FAIL"]
    score: float = 100.0
    checks: List[FeasibilityCheckItem] = []
    evaluated_at: datetime


class OptimizationImpactMetrics(BaseModel):
    waiting_time_hours: float = 0.0
    berth_utilization_pct: float = 0.0
    congestion_score_pct: float = 0.0
    resource_utilization_pct: float = 0.0
    affected_vessels_count: int = 0
    estimated_demurrage_usd: float = 0.0


class OptimizationRecommendation(BaseModel):
    status: Literal["PENDING", "ACCEPTABLE", "ALTERNATIVE_RECOMMENDED", "INFEASIBLE"]
    recommended_eta: Optional[datetime] = None
    recommended_etd: Optional[datetime] = None
    recommended_berth_id: Optional[str] = None
    recommended_berth_code: Optional[str] = None
    recommended_berth_name: Optional[str] = None
    assigned_cranes: List[str] = []
    reason: Optional[str] = None
    current_metrics: OptimizationImpactMetrics
    proposed_metrics: OptimizationImpactMetrics
    schedule_version: int = 1
    generated_at: datetime


class AlternativeProposalItem(BaseModel):
    id: str
    request_id: str
    proposed_eta: datetime
    proposed_departure: datetime
    proposed_berth_id: Optional[str] = None
    proposed_berth_code: Optional[str] = None
    proposed_berth_name: Optional[str] = None
    operational_reason: str
    customer_response: Literal["PENDING", "ACCEPTED", "DECLINED"] = "PENDING"
    customer_notes: Optional[str] = None
    proposed_by_name: Optional[str] = "Operation Manager"
    created_at: datetime
    responded_at: Optional[datetime] = None


class ArrivalRequestCreate(BaseModel):
    vessel_id: str
    requested_eta: datetime
    expected_departure: datetime
    expected_port_stay_hours: Optional[float] = 12.0
    origin: str = Field(..., min_length=2, max_length=120)
    destination: str = Field(..., min_length=2, max_length=120)
    cargo_type: str = Field(..., min_length=2, max_length=50)
    cargo_quantity: int = Field(..., gt=0, description="TEU or metric tons")
    hazardous_cargo: bool = False
    special_cargo_requirements: Optional[str] = None
    preferred_berth_id: Optional[str] = None
    required_cranes: int = Field(2, ge=1, le=6)
    tug_required: bool = True
    pilot_required: bool = True
    bunkering_required: bool = False
    other_services: Optional[str] = None
    customer_notes: Optional[str] = None
    special_instructions: Optional[str] = None


class ArrivalRequestUpdate(BaseModel):
    requested_eta: Optional[datetime] = None
    expected_departure: Optional[datetime] = None
    expected_port_stay_hours: Optional[float] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    cargo_type: Optional[str] = None
    cargo_quantity: Optional[int] = None
    hazardous_cargo: Optional[bool] = None
    special_cargo_requirements: Optional[str] = None
    preferred_berth_id: Optional[str] = None
    required_cranes: Optional[int] = None
    tug_required: Optional[bool] = None
    pilot_required: Optional[bool] = None
    bunkering_required: Optional[bool] = None
    other_services: Optional[str] = None
    customer_notes: Optional[str] = None
    special_instructions: Optional[str] = None


class ArrivalRequestResponse(BaseModel):
    id: str
    request_code: str
    organization_id: str
    organization_name: Optional[str] = None
    vessel_id: str
    vessel_name: str
    vessel_imo: Optional[str] = None
    vessel_loa: Optional[float] = None
    vessel_beam: Optional[float] = None
    vessel_draft: Optional[float] = None
    vessel_type: Optional[str] = None
    requested_eta: datetime
    expected_departure: datetime
    expected_port_stay_hours: float
    origin: str
    destination: str
    cargo_type: str
    cargo_quantity: int
    hazardous_cargo: bool
    special_cargo_requirements: Optional[str] = None
    preferred_berth_id: Optional[str] = None
    preferred_berth_code: Optional[str] = None
    required_cranes: int
    tug_required: bool
    pilot_required: bool
    bunkering_required: bool
    other_services: Optional[str] = None
    customer_notes: Optional[str] = None
    special_instructions: Optional[str] = None
    status: ArrivalRequestStatus
    feasibility_status: Optional[str] = "PENDING"
    feasibility_details: List[FeasibilityCheckItem] = []
    optimization_status: Optional[str] = "PENDING"
    optimization_recommendation: Optional[OptimizationRecommendation] = None
    assigned_berth_id: Optional[str] = None
    assigned_berth_code: Optional[str] = None
    assigned_berth_name: Optional[str] = None
    approved_start: Optional[datetime] = None
    approved_end: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    rejection_comment: Optional[str] = None
    changes_requested_notes: Optional[str] = None
    schedule_version_at_eval: int = 1
    active_proposal: Optional[AlternativeProposalItem] = None
    submitted_at: datetime
    updated_at: datetime


# ── Operation Manager Action Payloads ──────────────────────────────────────────

class ProposeAlternativeRequest(BaseModel):
    proposed_eta: datetime
    proposed_departure: datetime
    proposed_berth_id: Optional[str] = None
    operational_reason: str = Field(..., min_length=5, description="Clear operational explanation for customer")


class CustomerProposalActionRequest(BaseModel):
    notes: Optional[str] = None


class RequestChangesPayload(BaseModel):
    notes: str = Field(..., min_length=5, description="Specify required additional details or revisions")


class RejectRequestPayload(BaseModel):
    reason: Literal[
        "No Compatible Berth",
        "Port Capacity Exceeded",
        "Safety Constraint",
        "Required Resources Unavailable",
        "No Feasible Schedule",
        "Other"
    ]
    comment: Optional[str] = None


class ApproveRequestPayload(BaseModel):
    schedule_version: Optional[int] = Field(None, description="Current schedule version for concurrency guard")
    berth_id: Optional[str] = None
    assigned_start: Optional[datetime] = None
    assigned_end: Optional[datetime] = None


# ── Audit Log & Notification Schemas ──────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: str
    request_id: str
    actor_id: str
    actor_name: str
    actor_domain: Literal["CUSTOMER", "PORT_OPERATIONS"]
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    details: Dict[str, Any] = {}
    reason: Optional[str] = None
    comment: Optional[str] = None
    schedule_version: int = 1
    created_at: datetime


class CustomerNotificationResponse(BaseModel):
    id: str
    organization_id: str
    user_id: Optional[str] = None
    title: str
    message: str
    notification_type: str
    link_url: Optional[str] = None
    is_read: bool
    created_at: datetime

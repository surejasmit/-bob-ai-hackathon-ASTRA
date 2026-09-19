export type CustomerRole = "CUSTOMER_ADMIN" | "CUSTOMER_USER";

export interface CustomerOrganization {
  id: string;
  name: string;
  company_email: string;
  company_phone: string;
  country: string;
  address: string;
  city: string;
  state?: string;
  postal_code: string;
  website?: string;
  registration_number?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerUser {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: CustomerRole;
  phone?: string;
  job_title?: string;
  created_at: string;
}

export interface CustomerVessel {
  id: string;
  organization_id: string;
  vessel_name: string;
  imo_number: string;
  vessel_type: string;
  length_loa: number;
  beam: number;
  draft: number;
  gross_tonnage: number;
  deadweight_tonnage: number;
  flag: string;
  operator_name?: string;
  cargo_type: string;
  cargo_capacity: number;
  hazardous_cargo: boolean;
  special_handling_requirements?: string;
  created_at: string;
  updated_at: string;
}

export type ArrivalRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATING"
  | "FEASIBILITY_CHECK"
  | "OPTIMIZATION_RUNNING"
  | "PENDING_MANAGER_REVIEW"
  | "ALTERNATIVE_PROPOSED"
  | "CUSTOMER_RESPONSE_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export interface FeasibilityCheckItem {
  name: string;
  passed: boolean;
  details: string;
  severity: "PASS" | "WARN" | "FAIL";
}

export interface OptimizationImpactMetrics {
  waiting_time_hours: number;
  berth_utilization_pct: number;
  congestion_score_pct: number;
  resource_utilization_pct: number;
  affected_vessels_count: number;
  estimated_demurrage_usd: number;
}

export interface OptimizationRecommendation {
  status: "PENDING" | "ACCEPTABLE" | "ALTERNATIVE_RECOMMENDED" | "INFEASIBLE";
  recommended_eta?: string;
  recommended_etd?: string;
  recommended_berth_id?: string;
  recommended_berth_code?: string;
  recommended_berth_name?: string;
  assigned_cranes: string[];
  reason?: string;
  current_metrics: OptimizationImpactMetrics;
  proposed_metrics: OptimizationImpactMetrics;
  schedule_version: number;
  generated_at: string;
}

export interface AlternativeProposal {
  id: string;
  request_id: string;
  proposed_eta: string;
  proposed_departure: string;
  proposed_berth_id?: string;
  proposed_berth_code?: string;
  proposed_berth_name?: string;
  operational_reason: string;
  customer_response: "PENDING" | "ACCEPTED" | "DECLINED";
  customer_notes?: string;
  proposed_by_name?: string;
  created_at: string;
  responded_at?: string;
}

export interface ArrivalRequest {
  id: string;
  request_code: string;
  organization_id: string;
  organization_name?: string;
  vessel_id: string;
  vessel_name: string;
  vessel_imo?: string;
  vessel_loa?: number;
  vessel_beam?: number;
  vessel_draft?: number;
  vessel_type?: string;
  requested_eta: string;
  expected_departure: string;
  expected_port_stay_hours: number;
  origin: string;
  destination: string;
  cargo_type: string;
  cargo_quantity: number;
  hazardous_cargo: boolean;
  special_cargo_requirements?: string;
  preferred_berth_id?: string;
  preferred_berth_code?: string;
  required_cranes: number;
  tug_required: boolean;
  pilot_required: boolean;
  bunkering_required: boolean;
  other_services?: string;
  customer_notes?: string;
  special_instructions?: string;
  status: ArrivalRequestStatus;
  feasibility_status?: "PENDING" | "PASS" | "WARN" | "FAIL";
  feasibility_details: FeasibilityCheckItem[];
  optimization_status?: "PENDING" | "ACCEPTABLE" | "ALTERNATIVE_RECOMMENDED" | "INFEASIBLE";
  optimization_recommendation?: OptimizationRecommendation;
  assigned_berth_id?: string;
  assigned_berth_code?: string;
  assigned_berth_name?: string;
  approved_start?: string;
  approved_end?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  rejection_comment?: string;
  changes_requested_notes?: string;
  schedule_version_at_eval: number;
  active_proposal?: AlternativeProposal;
  submitted_at: string;
  updated_at: string;
}

export interface AuditLogItem {
  id: string;
  request_id: string;
  actor_id: string;
  actor_name: string;
  actor_domain: "CUSTOMER" | "PORT_OPERATIONS";
  action: string;
  previous_status?: string;
  new_status?: string;
  details?: Record<string, any>;
  reason?: string;
  comment?: string;
  schedule_version: number;
  created_at: string;
}

export type AuditLog = AuditLogItem;

export interface CustomerNotification {
  id: string;
  organization_id: string;
  user_id?: string;
  title: string;
  message: string;
  notification_type: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface CustomerAuthSession {
  token: string;
  user: CustomerUser;
  organization: CustomerOrganization;
}

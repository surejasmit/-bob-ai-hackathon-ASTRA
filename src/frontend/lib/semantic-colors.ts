/**
 * NaviOps Centralized Semantic Color & Status Design System
 *
 * Implements a strict operational hierarchy across the entire portal:
 * - 0–24: Low / Healthy (Green)
 * - 25–49: Guarded / Mild (Maritime Blue / Muted Teal)
 * - 50–69: Moderate (Warm Amber / Yellow)
 * - 70–84: High (Orange)
 * - 85–100: Critical (Red)
 *
 * Preserves authentic NaviOps design tokens:
 * - Brand Cyprus: #004741
 * - Maritime Accent: #2F7D8C
 * - Success Green: #2F7D5B
 * - Warning Amber: #C58A2B
 * - High Orange: #C25E00
 * - Danger Red: #B94A48
 * - Neutral Sand/Slate: #5C6B68
 */

export type CongestionSeverity = "low" | "guarded" | "moderate" | "high" | "critical";

export interface CongestionMeta {
  severity: CongestionSeverity;
  label: "Low" | "Guarded" | "Moderate" | "High" | "Critical";
  badgeClass: string;
  cardBgClass: string;
  cardBorderClass: string;
  textColor: string;
  dotColor: string;
  bgSoft: string;
  borderColor: string;
  summary: string;
}

export type StatusContext =
  | "vessel"
  | "berth"
  | "crane"
  | "yard"
  | "disruption"
  | "optimization"
  | "user"
  | "customer_request"
  | "general";

export interface StatusMeta {
  label: string;
  badgeClass: string;
  textColor: string;
  dotColor: string;
}

export interface PriorityMeta {
  label: string;
  badgeClass: string;
  textColor: string;
  tier: number;
}

export interface UtilizationMeta {
  level: "low" | "moderate" | "high" | "critical";
  barClass: string;
  textClass: string;
  borderClass: string;
}

// ---------------------------------------------------------------------------
// 1. Congestion Score Severity (Dynamic 5-Tier System)
// ---------------------------------------------------------------------------

export function getCongestionMeta(scoreOrLevel?: number | string | null): CongestionMeta {
  let score = 0;

  if (typeof scoreOrLevel === "number") {
    score = scoreOrLevel;
  } else if (typeof scoreOrLevel === "string") {
    const parsed = parseFloat(scoreOrLevel);
    if (!isNaN(parsed)) {
      score = parsed;
    } else {
      const lower = scoreOrLevel.toLowerCase();
      if (lower.includes("crit")) score = 90;
      else if (lower.includes("high")) score = 75;
      else if (lower.includes("mod")) score = 55;
      else if (lower.includes("guard") || lower.includes("mild")) score = 35;
      else score = 15;
    }
  }

  // 0–24: Low / Healthy (Normal & healthy operations)
  if (score <= 24.9) {
    return {
      severity: "low",
      label: "Low",
      badgeClass: "bg-[#E5F2EA] text-[#2F7D5B] border-[#A8D9BC]",
      cardBgClass: "bg-[#2F7D5B]",
      cardBorderClass: "border-[#A8D9BC]",
      textColor: "text-[#2F7D5B]",
      dotColor: "bg-[#2F7D5B]",
      bgSoft: "bg-[#E5F2EA]",
      borderColor: "border-[#A8D9BC]",
      summary: "Normal, healthy quayside throughput with minimal anchorage backlog.",
    };
  }

  // 25–49: Guarded / Mild (Slightly elevated activity, no immediate bottleneck)
  if (score <= 49.9) {
    return {
      severity: "guarded",
      label: "Guarded",
      badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE]",
      cardBgClass: "bg-[#2F7D8C]",
      cardBorderClass: "border-[#B0D7DE]",
      textColor: "text-[#2F7D8C]",
      dotColor: "bg-[#2F7D8C]",
      bgSoft: "bg-[#E1F0F2]",
      borderColor: "border-[#B0D7DE]",
      summary: "Guarded operational tempo; steady vessel turnaround within standard windows.",
    };
  }

  // 50–69: Moderate (Increasing operational pressure)
  if (score <= 69.9) {
    return {
      severity: "moderate",
      label: "Moderate",
      badgeClass: "bg-[#FFF4DE] text-[#C58A2B] border-[#F0D49A]",
      cardBgClass: "bg-[#C58A2B]",
      cardBorderClass: "border-[#F0D49A]",
      textColor: "text-[#C58A2B]",
      dotColor: "bg-[#C58A2B]",
      bgSoft: "bg-[#FFF4DE]",
      borderColor: "border-[#F0D49A]",
      summary: "Elevated queue load at anchorage; berth and yard buffer zones narrowing.",
    };
  }

  // 70–84: High (Significant congestion, requires operations focus)
  if (score <= 84.9) {
    return {
      severity: "high",
      label: "High",
      badgeClass: "bg-[#FFEDD5] text-[#C25E00] border-[#FED7AA]",
      cardBgClass: "bg-[#EA580C]",
      cardBorderClass: "border-[#FED7AA]",
      textColor: "text-[#C25E00]",
      dotColor: "bg-[#EA580C]",
      bgSoft: "bg-[#FFEDD5]",
      borderColor: "border-[#FED7AA]",
      summary: "Quayside bottleneck; queue delays exceeding thresholds. 72h optimization advised.",
    };
  }

  // 85–100: Critical (Severe congestion, urgent intervention required)
  return {
    severity: "critical",
    label: "Critical",
    badgeClass: "bg-[#FCE9E8] text-[#B94A48] border-[#F2C4C3]",
    cardBgClass: "bg-[#B94A48]",
    cardBorderClass: "border-[#F2C4C3]",
    textColor: "text-[#B94A48]",
    dotColor: "bg-[#B94A48]",
    bgSoft: "bg-[#FCE9E8]",
    borderColor: "border-[#F2C4C3]",
    summary: "Severe congestion alert! Resource deficits causing cascade delays across terminal.",
  };
}

// ---------------------------------------------------------------------------
// 2. Semantic Status Meta Across All Entities
// ---------------------------------------------------------------------------

export function getStatusMeta(
  rawStatus?: string | null,
  context: StatusContext = "general"
): StatusMeta {
  if (!rawStatus) {
    return {
      label: "Unknown",
      badgeClass: "bg-[#F7F6F2] text-[#5C6B68] border-[#D5D9D3]",
      textColor: "text-[#5C6B68]",
      dotColor: "bg-[#899491]",
    };
  }

  const s = rawStatus.trim().toLowerCase();

  // Context-specific handling
  if (context === "disruption") {
    if (s === "active") {
      return {
        label: "Active Incident",
        badgeClass: "bg-[#FCE9E8] text-[#B94A48] border-[#F2C4C3] font-semibold",
        textColor: "text-[#B94A48]",
        dotColor: "bg-[#B94A48]",
      };
    }
    if (s === "mitigated") {
      return {
        label: "Mitigated",
        badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE] font-medium",
        textColor: "text-[#2F7D8C]",
        dotColor: "bg-[#2F7D8C]",
      };
    }
    if (s === "resolved") {
      return {
        label: "Resolved",
        badgeClass: "bg-[#E5F2EA] text-[#2F7D5B] border-[#A8D9BC] font-medium",
        textColor: "text-[#2F7D5B]",
        dotColor: "bg-[#2F7D5B]",
      };
    }
  }

  if (context === "user") {
    if (s === "active") {
      return {
        label: "Active",
        badgeClass: "bg-[#E5F2EA] text-[#2F7D5B] border-[#A8D9BC] font-medium",
        textColor: "text-[#2F7D5B]",
        dotColor: "bg-[#2F7D5B]",
      };
    }
  }

  // --- Success / Healthy / Completed / Applied ---
  if (
    s === "available" ||
    s === "completed" ||
    s === "resolved" ||
    s === "applied" ||
    s === "optimal" ||
    s === "healthy" ||
    s === "normal"
  ) {
    return {
      label: rawStatus,
      badgeClass: "bg-[#E5F2EA] text-[#2F7D5B] border-[#A8D9BC] font-medium",
      textColor: "text-[#2F7D5B]",
      dotColor: "bg-[#2F7D5B]",
    };
  }

  // --- Info / Scheduled / In-Progress / Operating Normally ---
  if (
    s === "scheduled" ||
    s === "planned" ||
    s === "arrived" ||
    s === "berthing" ||
    s === "loading" ||
    s === "unloading" ||
    s === "occupied" ||
    s === "busy" ||
    s === "assigned" ||
    s === "proposed" ||
    s === "in transit" ||
    s === "mitigated" ||
    s === "low"
  ) {
    return {
      label: rawStatus,
      badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE] font-medium",
      textColor: "text-[#2F7D8C]",
      dotColor: "bg-[#2F7D8C]",
    };
  }

  // --- Warning / Waiting / Near Capacity / Maintenance / Pending ---
  if (
    s === "waiting" ||
    s === "near capacity" ||
    s === "maintenance" ||
    s === "pending" ||
    s === "feasible" ||
    s === "under review" ||
    s === "moderate" ||
    s === "medium" ||
    s === "partially available"
  ) {
    return {
      label: rawStatus,
      badgeClass: "bg-[#FFF4DE] text-[#C58A2B] border-[#F0D49A] font-medium",
      textColor: "text-[#C58A2B]",
      dotColor: "bg-[#C58A2B]",
    };
  }

  // --- High Risk / Delayed / Congested ---
  if (
    s === "delayed" ||
    s === "congested" ||
    s === "high" ||
    s === "restricted" ||
    s === "at risk" ||
    s === "maintenance due"
  ) {
    return {
      label: rawStatus,
      badgeClass: "bg-[#FFEDD5] text-[#C25E00] border-[#FED7AA] font-semibold",
      textColor: "text-[#C25E00]",
      dotColor: "bg-[#EA580C]",
    };
  }

  // --- Customer Arrival Request & Proposal Statuses ---
  if (
    s === "alternative_proposed" ||
    s === "customer_response_required" ||
    s === "action required"
  ) {
    return {
      label: s === "action required" ? "Action Required" : "Alternative Proposed",
      badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE] font-semibold",
      textColor: "text-[#2F7D8C]",
      dotColor: "bg-[#2F7D8C]",
    };
  }

  if (
    s === "pending_manager_review" ||
    s === "changes_requested" ||
    s === "validating" ||
    s === "feasibility_check" ||
    s === "optimization_running" ||
    s === "changes needed"
  ) {
    const labelMap: Record<string, string> = {
      pending_manager_review: "Pending Review",
      changes_requested: "Changes Needed",
      changes_needed: "Changes Needed",
      validating: "Validating",
      feasibility_check: "Feasibility Check",
      optimization_running: "Optimization Running",
    };
    return {
      label: labelMap[s] || rawStatus,
      badgeClass: "bg-[#FFF4DE] text-[#C58A2B] border-[#F0D49A] font-semibold",
      textColor: "text-[#C58A2B]",
      dotColor: "bg-[#C58A2B]",
    };
  }

  if (s === "submitted") {
    return {
      label: "Submitted",
      badgeClass: "bg-[#E1EFEC] text-[#004741] border-[#C5DDD9] font-semibold",
      textColor: "text-[#004741]",
      dotColor: "bg-[#004741]",
    };
  }

  // --- Critical / Failed / Unavailable / Offline / Infeasible ---
  if (
    s === "critical" ||
    s === "failed" ||
    s === "unavailable" ||
    s === "offline" ||
    s === "blocked" ||
    s === "emergency" ||
    s === "infeasible" ||
    s === "rejected" ||
    s === "declined" ||
    s === "cancelled"
  ) {
    return {
      label: s === "rejected" || s === "declined" ? "Declined" : s === "cancelled" ? "Cancelled" : rawStatus,
      badgeClass: "bg-[#FCE9E8] text-[#B94A48] border-[#F2C4C3] font-semibold",
      textColor: "text-[#B94A48]",
      dotColor: "bg-[#B94A48]",
    };
  }

  // --- Neutral / Unknown / Unassigned / Draft ---
  return {
    label: rawStatus,
    badgeClass: "bg-[#F7F6F2] text-[#5C6B68] border-[#D5D9D3]",
    textColor: "text-[#5C6B68]",
    dotColor: "bg-[#899491]",
  };
}

// ---------------------------------------------------------------------------
// 3. Priority Meta (Clear Visual Distinction from Operational Status)
// ---------------------------------------------------------------------------

export function getPriorityMeta(priority: number): PriorityMeta {
  switch (priority) {
    case 1:
      return {
        tier: 1,
        label: "Priority 1 (Critical)",
        badgeClass: "bg-[#FCE9E8] text-[#B94A48] border-[#F2C4C3] font-semibold shadow-2xs",
        textColor: "text-[#B94A48]",
      };
    case 2:
      return {
        tier: 2,
        label: "Priority 2 (High)",
        badgeClass: "bg-[#FFEDD5] text-[#C25E00] border-[#FED7AA] font-semibold",
        textColor: "text-[#C25E00]",
      };
    case 3:
      return {
        tier: 3,
        label: "Priority 3 (Standard)",
        badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE] font-medium",
        textColor: "text-[#2F7D8C]",
      };
    default:
      return {
        tier: 4,
        label: "Priority 4 (Low)",
        badgeClass: "bg-[#F7F6F2] text-[#5C6B68] border-[#D5D9D3] font-normal",
        textColor: "text-[#5C6B68]",
      };
  }
}

// ---------------------------------------------------------------------------
// 4. Resource Utilization & Availability Thresholds
// ---------------------------------------------------------------------------

export function getResourceUtilizationMeta(pct: number): UtilizationMeta {
  if (pct >= 90) {
    return {
      level: "critical",
      barClass: "bg-[#B94A48]",
      textClass: "text-[#B94A48] font-bold",
      borderClass: "border-l-[#B94A48]",
    };
  }
  if (pct >= 75) {
    return {
      level: "high",
      barClass: "bg-[#EA580C]",
      textClass: "text-[#C25E00] font-bold",
      borderClass: "border-l-[#EA580C]",
    };
  }
  if (pct >= 55) {
    return {
      level: "moderate",
      barClass: "bg-[#2F7D8C]",
      textClass: "text-[#2F7D8C] font-semibold",
      borderClass: "border-l-[#2F7D8C]",
    };
  }
  return {
    level: "low",
    barClass: "bg-[#2F7D5B]",
    textClass: "text-[#2F7D5B] font-semibold",
    borderClass: "border-l-[#2F7D5B]",
  };
}

// ---------------------------------------------------------------------------
// 5. User Roles (Distinct Brand/Role Badges)
// ---------------------------------------------------------------------------

export function getUserRoleMeta(role: string): { label: string; badgeClass: string; textColor: string } {
  const r = role.toLowerCase();
  if (r === "admin") {
    return {
      label: "Port Manager (Admin)",
      badgeClass: "bg-[#E1EFEC] text-[#004741] border-[#C5DDD9] font-semibold",
      textColor: "text-[#004741]",
    };
  }
  if (r === "operations") {
    return {
      label: "Operations Staff",
      badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE] font-semibold",
      textColor: "text-[#2F7D8C]",
    };
  }
  if (r === "customer_admin") {
    return {
      label: "Customer Admin",
      badgeClass: "bg-[#E1EFEC] text-[#004741] border-[#C5DDD9] font-semibold",
      textColor: "text-[#004741]",
    };
  }
  if (r === "customer_user") {
    return {
      label: "Customer User",
      badgeClass: "bg-[#E1F0F2] text-[#2F7D8C] border-[#B0D7DE] font-medium",
      textColor: "text-[#2F7D8C]",
    };
  }
  return {
    label: "Viewer (Read-Only)",
    badgeClass: "bg-[#F7F6F2] text-[#5C6B68] border-[#D5D9D3] font-medium",
    textColor: "text-[#5C6B68]",
  };
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Ship,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  GitPullRequest,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Boxes,
  Anchor,
  SlidersHorizontal,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { ArrivalRequest, AuditLogItem } from "@/types/customer";
import { Button } from "@/components/design-system/button";
import { Badge } from "@/components/design-system/badge";
import { cn } from "@/lib/utils";

export default function CustomerRequestTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params?.id as string;

  const [request, setRequest] = useState<ArrivalRequest | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Proposal interaction states
  const [proposalNotes, setProposalNotes] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqData, logs] = await Promise.all([
        customerApi.getArrivalRequest(requestId),
        customerApi.getAuditTrail(requestId).catch(() => []),
      ]);
      setRequest(reqData);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Failed to load request tracking:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) loadData();
  }, [requestId]);

  const handleAcceptAlternative = async () => {
    if (!confirm("Are you sure you want to accept the port-proposed alternative schedule?")) return;
    try {
      setIsResponding(true);
      setActionError(null);
      await customerApi.acceptAlternative(requestId, proposalNotes.trim() || undefined);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to accept alternative.");
    } finally {
      setIsResponding(false);
    }
  };

  const handleDeclineAlternative = async () => {
    const reason = prompt("Please specify a reason for declining the proposed schedule:");
    if (reason === null) return;
    try {
      setIsResponding(true);
      setActionError(null);
      await customerApi.declineAlternative(requestId, reason.trim() || undefined);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to decline alternative.");
    } finally {
      setIsResponding(false);
    }
  };

  if (loading || !request) {
    return (
      <CustomerShell title="Arrival Request Tracking">
        <div className="py-20 text-center text-xs text-[#5C6B68]">
          Loading request details and audit trail...
        </div>
      </CustomerShell>
    );
  }

  // Lifecycle Steps
  const isAlt =
    request.status === "ALTERNATIVE_PROPOSED" ||
    request.status === "CUSTOMER_RESPONSE_REQUIRED";
  const isApproved = request.status === "APPROVED";
  const isRejected = request.status === "REJECTED";

  const steps = [
    { key: "SUBMITTED", label: "Submitted", done: true },
    { key: "FEASIBILITY", label: "Feasibility Check", done: !!request.feasibility_status },
    { key: "OPTIMIZATION", label: "Optimization", done: !!request.optimization_status },
    {
      key: isAlt ? "ALTERNATIVE" : "REVIEW",
      label: isAlt ? "Alternative Proposed" : "Manager Review",
      done: true,
      active: !isApproved && !isRejected,
      isAlt: isAlt,
    },
    {
      key: "DECISION",
      label: isApproved ? "Approved & Committed" : isRejected ? "Declined" : "Final Decision",
      done: isApproved || isRejected,
      active: isApproved,
      failed: isRejected,
    },
  ];

  return (
    <CustomerShell
      title={`Request Tracking: ${request.request_code}`}
      subtitle={`Vessel '${request.vessel_name}' • Submitted on ${new Date(
        request.submitted_at
      ).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`}
      actions={
        <Link href="/customer/arrival-requests">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
            All Requests
          </Button>
        </Link>
      }
    >
      <div className="space-y-5 max-w-5xl mx-auto">
        {/* ── Lifecycle Stepper Card ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-5 sm:p-6 shadow-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C6B68] mb-5">
            Arrival Request Lifecycle State Machine
          </h3>

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
            {steps.map((step, idx) => (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center text-center z-10">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-2xs",
                      step.failed
                        ? "bg-[#B94A48] text-white"
                        : step.isAlt
                        ? "bg-[#C58A2B] text-white ring-4 ring-[#FFF4DE]"
                        : step.done
                        ? "bg-[#004741] text-white"
                        : "bg-[#F7F6F2] border border-[#D5D9D3] text-[#899491]"
                    )}
                  >
                    {step.failed ? (
                      <XCircle className="h-4 w-4" />
                    ) : step.isAlt ? (
                      <GitPullRequest className="h-4 w-4" />
                    ) : step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold mt-1.5 max-w-[110px]",
                      step.active
                        ? "text-[#102A27]"
                        : step.done
                        ? "text-[#004741]"
                        : "text-[#899491]"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "hidden sm:block flex-1 h-0.5 rounded-full mx-2",
                      step.done ? "bg-[#004741]" : "bg-[#E3E5E0]"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Alternative Proposal Alert (If Active) ── */}
        {request.active_proposal && request.active_proposal.customer_response === "PENDING" && (
          <div className="rounded-xl border border-[#F0D49A] bg-[#FFF4DE] p-5 shadow-card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/90 text-[#C58A2B]">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#102A27]">
                    Port Authority Proposed an Alternative Schedule
                  </h3>
                  <p className="text-xs text-[#5C6B68] mt-0.5">
                    The Operation Manager evaluated your request and recommends an adjusted slot to eliminate quayside conflict.
                  </p>
                </div>
              </div>
              <Badge variant="status" status="ALTERNATIVE_PROPOSED" />
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Requested */}
              <div className="p-3.5 rounded-lg bg-white border border-[#E3E5E0]">
                <span className="text-[10px] uppercase font-bold text-[#899491] block mb-1">
                  Customer Requested Slot
                </span>
                <div className="text-sm font-bold text-[#102A27]">
                  {new Date(request.requested_eta).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  UTC
                </div>
                <div className="text-xs text-[#5C6B68] mt-0.5">
                  Preferred Berth: {request.preferred_berth_code || "Any Available"}
                </div>
              </div>

              {/* Port Proposed */}
              <div className="p-3.5 rounded-lg bg-white border-2 border-[#004741]">
                <span className="text-[10px] uppercase font-bold text-[#004741] block mb-1">
                  Port Proposed Slot
                </span>
                <div className="text-sm font-bold text-[#004741]">
                  {new Date(request.active_proposal.proposed_eta).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  UTC
                </div>
                <div className="text-xs text-[#102A27] mt-0.5">
                  Allocated Berth:{" "}
                  <strong>{request.active_proposal.proposed_berth_code || "Quayside Berth"}</strong>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="p-3 rounded-lg bg-white/80 border border-[#E3E5E0] text-xs text-[#5C6B68]">
              <strong className="text-[#102A27]">Port Operational Justification: </strong>
              {request.active_proposal.operational_reason}
            </div>

            {actionError && (
              <div className="p-3 rounded-lg bg-[#FCE9E8] border border-[#F2C4C3] text-[#B94A48] text-xs">
                {actionError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#F0D49A]">
              <input
                type="text"
                placeholder="Optional customer response notes..."
                value={proposalNotes}
                onChange={(e) => setProposalNotes(e.target.value)}
                className="w-full sm:flex-1 rounded-lg border border-[#D5D9D3] bg-white px-3 py-1.5 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isResponding}
                  onClick={handleDeclineAlternative}
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isResponding}
                  onClick={handleAcceptAlternative}
                  leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                >
                  Accept Alternative Slot
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Approved Live Commit Card (If Approved) ── */}
        {isApproved && (
          <div className="p-5 rounded-xl border border-[#A8D9BC] bg-[#E5F2EA] shadow-card flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white text-[#2F7D5B] mt-0.5">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#102A27]">
                Vessel Arrival Officially Approved & Committed
              </h3>
              <p className="text-xs text-[#2F7D5B] mt-0.5">
                Allocated to <strong>{request.assigned_berth_code || "Quayside Berth"}</strong> ({request.assigned_berth_name || "Terminal"}).
                Scheduled arrival: {request.approved_start ? new Date(request.approved_start).toLocaleString() : new Date(request.requested_eta).toLocaleString()}.
              </p>
              <div className="mt-2 text-[11px] text-[#5C6B68]">
                Port pilot and STS crane gangs have been provisioned in the live NaviOps operational schedule.
              </div>
            </div>
          </div>
        )}

        {/* ── Rejection Notice (If Rejected) ── */}
        {isRejected && (
          <div className="p-5 rounded-xl border border-[#F2C4C3] bg-[#FCE9E8] shadow-card flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white text-[#B94A48] mt-0.5">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#B94A48]">
                Arrival Request Declined by Operation Manager
              </h3>
              <p className="text-xs text-[#5C6B68] mt-0.5">
                Reason: <strong>{request.rejection_reason || "Operational constraint"}</strong>
              </p>
              {request.rejection_comment && (
                <p className="text-xs text-[#5C6B68] mt-1 italic">
                  "{request.rejection_comment}"
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Voyage & Vessel Specifications Card ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4]">
            <div className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-[#004741]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
                Voyage & Vessel Operational Specifications
              </h3>
            </div>
            <Badge variant="status" status={request.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block">Vessel Name</span>
              <span className="font-semibold text-[#102A27]">{request.vessel_name}</span>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block">IMO Number</span>
              <span className="font-semibold text-[#102A27]">{request.vessel_imo || "IMO-9812345"}</span>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block">Cargo Type & Volume</span>
              <span className="font-semibold text-[#102A27]">
                {request.cargo_quantity.toLocaleString()} {request.cargo_type}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block">Port Stay</span>
              <span className="font-semibold text-[#102A27]">{request.expected_port_stay_hours} hours</span>
            </div>
          </div>
        </div>

        {/* ── Detailed Feasibility Diagnostics Checklist ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#004741]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
                Deterministic Feasibility Analysis Result
              </h3>
            </div>
            <span
              className={cn(
                "text-[11px] font-semibold px-2.5 py-0.5 rounded-full",
                request.feasibility_status === "PASS"
                  ? "bg-[#E5F2EA] text-[#2F7D5B]"
                  : request.feasibility_status === "WARN"
                  ? "bg-[#FFF4DE] text-[#C58A2B]"
                  : "bg-[#FCE9E8] text-[#B94A48]"
              )}
            >
              FEASIBILITY: {request.feasibility_status}
            </span>
          </div>

          <div className="space-y-2">
            {request.feasibility_details && request.feasibility_details.length > 0 ? (
              request.feasibility_details.map((check, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-[#E3E5E0] bg-[#F7F9F8] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {check.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-[#2F7D5B]" />
                      ) : check.severity === "WARN" ? (
                        <AlertTriangle className="h-4 w-4 text-[#C58A2B]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[#B94A48]" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-[#102A27]">{check.name}</span>
                      <p className="text-[11px] text-[#5C6B68] mt-0.5">{check.details}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                      check.passed
                        ? "bg-[#E5F2EA] text-[#2F7D5B]"
                        : check.severity === "WARN"
                        ? "bg-[#FFF4DE] text-[#C58A2B]"
                        : "bg-[#FCE9E8] text-[#B94A48]"
                    )}
                  >
                    {check.severity}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#5C6B68]">Feasibility evaluation pending.</p>
            )}
          </div>
        </div>

        {/* ── Chronological Audit Trail ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F0EDE4]">
            <Clock className="h-4 w-4 text-[#004741]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
              Full Request Audit Trail
            </h3>
          </div>

          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-[#E3E5E0] bg-[#F7F9F8] flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#102A27]">{log.action}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold",
                        log.actor_domain === "CUSTOMER"
                          ? "bg-[#E1EFEC] text-[#004741]"
                          : "bg-[#E1F0F2] text-[#2F7D8C]"
                      )}
                    >
                      {log.actor_domain}
                    </span>
                    <span className="text-[#899491]">&bull; {log.actor_name}</span>
                  </div>
                  {log.comment && (
                    <p className="text-[#5C6B68] mt-1 italic">"{log.comment}"</p>
                  )}
                  {log.reason && (
                    <p className="text-[#C58A2B] mt-1 font-medium">Reason: {log.reason}</p>
                  )}
                </div>
                <div className="text-right text-[11px] text-[#899491] shrink-0">
                  {new Date(log.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}

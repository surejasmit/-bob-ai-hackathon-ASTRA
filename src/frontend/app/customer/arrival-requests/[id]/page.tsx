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
  ArrowRight,
  ShieldCheck,
  Zap,
  Building2,
  FileSpreadsheet,
  Boxes,
  Anchor,
  HelpCircle,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { ArrivalRequest, AuditLogItem } from "@/types/customer";

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
        <div className="py-20 text-center text-[#6D94B5]">
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
    { key: "OPTIMIZATION", label: "CP-SAT Optimization", done: !!request.optimization_status },
    {
      key: isAlt ? "ALTERNATIVE" : "REVIEW",
      label: isAlt ? "Alternative Proposed" : "Manager Review",
      done: true,
      active: !isApproved && !isRejected,
      isAlt: isAlt,
    },
    {
      key: "DECISION",
      label: isApproved ? "Approved & Committed" : isRejected ? "Declined" : "Final Approval",
      done: isApproved || isRejected,
      active: isApproved,
      failed: isRejected,
    },
  ];

  return (
    <CustomerShell
      title={`Request Tracking: ${request.request_code}`}
      subtitle={`Vessel '${request.vessel_name}' \u2022 Submitted on ${new Date(
        request.submitted_at
      ).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`}
      actions={
        <Link
          href="/customer/arrival-requests"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E2E44] text-[#8CB4D2] hover:text-white text-xs font-semibold transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All Requests</span>
        </Link>
      }
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── Lifecycle Stepper ── */}
        <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#7BA1BF] mb-6">
            Arrival Request Lifecycle State Machine
          </h3>

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
            {steps.map((step, idx) => (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center text-center z-10">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all shadow-md ${
                      step.failed
                        ? "bg-[#DC2626] text-white"
                        : step.isAlt
                        ? "bg-[#0284C7] text-white animate-pulse"
                        : step.done
                        ? "bg-[#009688] text-white"
                        : "bg-[#071926] border border-[#14344B] text-[#5A7E9D]"
                    }`}
                  >
                    {step.failed ? (
                      <XCircle className="h-5 w-5" />
                    ) : step.isAlt ? (
                      <GitPullRequest className="h-5 w-5" />
                    ) : step.done ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold mt-2 max-w-[110px] ${
                      step.active
                        ? "text-white"
                        : step.done
                        ? "text-[#34D399]"
                        : "text-[#5A7E9D]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`hidden sm:block flex-1 h-1 rounded-full mx-2 ${
                      step.done ? "bg-[#009688]" : "bg-[#14344B]"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Alternative Proposal Banner (If Active) ── */}
        {request.active_proposal && request.active_proposal.customer_response === "PENDING" && (
          <div className="rounded-3xl bg-gradient-to-br from-[#0C324D] via-[#0A263B] to-[#071926] border-2 border-[#0284C7] p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#0284C7]/30 text-[#38BDF8]">
                  <GitPullRequest className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    Port Authority Proposed an Alternative Schedule
                  </h3>
                  <p className="text-xs text-[#9AC2E2]">
                    The Operation Manager evaluated your request and recommends an adjusted slot to eliminate quayside conflict.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#0284C7]/30 text-[#38BDF8] border border-[#0284C7]/40">
                Response Required
              </span>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Requested */}
              <div className="p-4 rounded-2xl bg-[#061520] border border-[#13344A]">
                <span className="text-[10px] uppercase font-bold text-[#6D94B5] block mb-1">
                  Customer Requested Slot
                </span>
                <div className="text-sm font-bold text-white">
                  {new Date(request.requested_eta).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  UTC
                </div>
                <div className="text-xs text-[#8CB4D2] mt-1">
                  Preferred Berth: {request.preferred_berth_code || "Any Available"}
                </div>
              </div>

              {/* Port Proposed */}
              <div className="p-4 rounded-2xl bg-[#0A2F4A] border border-[#0284C7]/60">
                <span className="text-[10px] uppercase font-bold text-[#38BDF8] block mb-1">
                  Port Proposed Slot
                </span>
                <div className="text-sm font-bold text-[#34D399]">
                  {new Date(request.active_proposal.proposed_eta).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  UTC
                </div>
                <div className="text-xs text-white mt-1">
                  Allocated Berth:{" "}
                  <strong>{request.active_proposal.proposed_berth_code || "Quayside Berth"}</strong>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="p-3.5 rounded-xl bg-[#061520] border border-[#122E42] text-xs text-[#9AC2E2]">
              <strong className="text-white">Port Operational Justification: </strong>
              {request.active_proposal.operational_reason}
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-[#DC2626]/20 border border-[#DC2626]/50 text-[#FCA5A5] text-xs">
                {actionError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#13344A]">
              <input
                type="text"
                placeholder="Optional customer response notes..."
                value={proposalNotes}
                onChange={(e) => setProposalNotes(e.target.value)}
                className="w-full sm:flex-1 rounded-xl border border-[#16364D] bg-[#061520] px-3.5 py-2.5 text-xs text-white placeholder:text-[#5E83A1] focus:outline-none focus:border-[#38BDF8]"
              />
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isResponding}
                  onClick={handleDeclineAlternative}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1A1E2B] hover:bg-[#252C3E] text-[#EF4444] text-xs font-bold border border-[#3E1B24] transition-all"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={isResponding}
                  onClick={handleAcceptAlternative}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white text-xs font-bold shadow-lg shadow-[#009688]/30 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Accept Alternative Slot</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Approved Live Commit Card (If Approved) ── */}
        {isApproved && (
          <div className="p-6 rounded-3xl bg-[#092B20] border-2 border-[#059669] shadow-xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-[#059669]/30 text-[#34D399] mt-1">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Vessel Arrival Officially Approved & Committed
              </h3>
              <p className="text-xs text-[#A7F3D0] mt-1">
                Allocated to <strong>{request.assigned_berth_code || "Quayside Berth"}</strong> ({request.assigned_berth_name || "Terminal"}).
                Scheduled arrival: {request.approved_start ? new Date(request.approved_start).toLocaleString() : new Date(request.requested_eta).toLocaleString()}.
              </p>
              <div className="mt-3 text-[11px] text-[#6EE7B7]">
                Port pilot and STS crane gangs have been provisioned. Live vessel tracking is now active.
              </div>
            </div>
          </div>
        )}

        {/* ── Rejection Notice (If Rejected) ── */}
        {isRejected && (
          <div className="p-6 rounded-3xl bg-[#3D1418] border-2 border-[#DC2626] shadow-xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-[#DC2626]/30 text-[#F87171] mt-1">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Arrival Request Declined by Operation Manager
              </h3>
              <p className="text-xs text-[#FCA5A5] mt-1">
                Reason: <strong>{request.rejection_reason || "Operational constraint"}</strong>
              </p>
              {request.rejection_comment && (
                <p className="text-xs text-[#FCA5A5]/80 mt-1 italic">
                  "{request.rejection_comment}"
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Detailed Feasibility Diagnostics Checklist ── */}
        <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#13344A]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2DD4BF]" />
              <h3 className="text-sm font-bold text-white">
                Deterministic Feasibility Analysis Result
              </h3>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                request.feasibility_status === "PASS"
                  ? "bg-[#059669]/20 text-[#34D399] border border-[#059669]/40"
                  : request.feasibility_status === "WARN"
                  ? "bg-[#D97706]/20 text-[#FBBF24] border border-[#D97706]/40"
                  : "bg-[#DC2626]/20 text-[#F87171] border border-[#DC2626]/40"
              }`}
            >
              FEASIBILITY: {request.feasibility_status}
            </span>
          </div>

          <div className="space-y-2.5">
            {request.feasibility_details && request.feasibility_details.length > 0 ? (
              request.feasibility_details.map((check, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42] flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {check.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
                      ) : check.severity === "WARN" ? (
                        <AlertTriangle className="h-4 w-4 text-[#FBBF24]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[#F87171]" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white">{check.name}</span>
                      <p className="text-xs text-[#8AB1D1] mt-0.5">{check.details}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      check.passed
                        ? "bg-[#059669]/20 text-[#34D399]"
                        : check.severity === "WARN"
                        ? "bg-[#D97706]/20 text-[#FBBF24]"
                        : "bg-[#DC2626]/20 text-[#F87171]"
                    }`}
                  >
                    {check.severity}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#6D94B5]">Feasibility evaluation pending.</p>
            )}
          </div>
        </div>

        {/* ── Chronological Audit Trail ── */}
        <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#13344A]">
            <Clock className="h-5 w-5 text-[#38BDF8]" />
            <h3 className="text-sm font-bold text-white">Full Request Audit Trail</h3>
          </div>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42] flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{log.action}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        log.actor_domain === "CUSTOMER"
                          ? "bg-[#009688]/20 text-[#34D399]"
                          : "bg-[#0284C7]/20 text-[#38BDF8]"
                      }`}
                    >
                      {log.actor_domain}
                    </span>
                    <span className="text-[#6D94B5]">&bull; {log.actor_name}</span>
                  </div>
                  {log.comment && (
                    <p className="text-[#9AC2E2] mt-1 italic">"{log.comment}"</p>
                  )}
                  {log.reason && (
                    <p className="text-[#FBBF24] mt-1">Reason: {log.reason}</p>
                  )}
                </div>
                <div className="text-right text-[11px] text-[#5A7E9D] shrink-0">
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

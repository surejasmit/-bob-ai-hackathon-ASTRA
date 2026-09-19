"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { ArrivalRequest, AuditLog } from "@/types/customer";
import { Berth } from "@/types";
import {
  ArrowLeft,
  Ship,
  Building2,
  Calendar,
  Clock,
  Anchor,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  SlidersHorizontal,
  FileEdit,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Boxes,
  Compass,
  FileText,
  UserCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OperationArrivalRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [request, setRequest] = useState<ArrivalRequest | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal / Action States
  const [activeActionModal, setActiveActionModal] = useState<
    "APPROVE" | "ALTERNATIVE" | "REQUEST_CHANGES" | "REJECT" | "SIMULATE" | null
  >(null);

  // Form states
  const [approveBerthId, setApproveBerthId] = useState("");
  const [approveStart, setApproveStart] = useState("");
  const [approveEnd, setApproveEnd] = useState("");
  const [approveNotes, setApproveNotes] = useState("");

  const [altBerthId, setAltBerthId] = useState("");
  const [altEta, setAltEta] = useState("");
  const [altEtd, setAltEtd] = useState("");
  const [altReason, setAltReason] = useState("");

  const [changeNotes, setChangeNotes] = useState("");

  const [rejectReason, setRejectReason] = useState("Berth Saturation");
  const [rejectComment, setRejectComment] = useState("");

  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqData, logsData, berthsData] = await Promise.all([
        api.getIncomingArrivalRequestDetail(requestId),
        api.getArrivalRequestAuditTrail(requestId).catch(() => []),
        api.getBerths().catch(() => []),
      ]);
      setRequest(reqData);
      setAuditLogs(logsData);
      setBerths(berthsData);

      // Pre-fill default form fields
      if (reqData) {
        setApproveBerthId(reqData.preferred_berth_id || (berthsData[0]?.id ?? ""));
        setApproveStart(reqData.requested_eta.slice(0, 16));
        setApproveEnd(reqData.expected_departure.slice(0, 16));

        setAltBerthId(reqData.preferred_berth_id || (berthsData[0]?.id ?? ""));
        setAltEta(reqData.requested_eta.slice(0, 16));
        setAltEtd(reqData.expected_departure.slice(0, 16));
      }
    } catch (err: any) {
      console.error("Failed to load request details", err);
      setErrorMessage(err.message || "Failed to load request details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      loadData();
    }
  }, [requestId]);

  // Decision Handlers
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    try {
      setActionLoading(true);
      setErrorMessage("");
      await api.approveArrivalRequest(request.id, {
        berth_id: approveBerthId || undefined,
        assigned_start: approveStart ? new Date(approveStart).toISOString() : undefined,
        assigned_end: approveEnd ? new Date(approveEnd).toISOString() : undefined,
        schedule_version: request.optimization_recommendation?.schedule_version,
        notes: approveNotes,
      });
      setSuccessMessage("Request successfully APPROVED and committed to live port schedule!");
      setActiveActionModal(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Approval failed. Please check schedule version or feasibility constraints.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleProposeAlternative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !altReason.trim()) {
      setErrorMessage("Please specify an operational reason for the alternative schedule.");
      return;
    }
    try {
      setActionLoading(true);
      setErrorMessage("");
      await api.proposeAlternativeSchedule(request.id, {
        proposed_eta: new Date(altEta).toISOString(),
        proposed_departure: new Date(altEtd).toISOString(),
        proposed_berth_id: altBerthId || undefined,
        operational_reason: altReason.trim(),
      });
      setSuccessMessage("Alternative proposal sent to carrier. Awaiting customer response.");
      setActiveActionModal(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to propose alternative.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !changeNotes.trim()) {
      setErrorMessage("Please enter the requested information/changes.");
      return;
    }
    try {
      setActionLoading(true);
      setErrorMessage("");
      await api.requestChangesForArrival(request.id, {
        notes: changeNotes.trim(),
      });
      setSuccessMessage("Changes requested. Customer has been notified.");
      setActiveActionModal(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to request changes.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    try {
      setActionLoading(true);
      setErrorMessage("");
      await api.rejectArrivalRequest(request.id, {
        reason: rejectReason,
        comment: rejectComment.trim() || undefined,
      });
      setSuccessMessage("Arrival request declined. Customer notified.");
      setActiveActionModal(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reject request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!request) return;
    try {
      setActionLoading(true);
      const res = await api.simulateArrivalRequest(request.id);
      setSimulationResult(res);
      setActiveActionModal("SIMULATE");
    } catch (err: any) {
      setErrorMessage(err.message || "Simulation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Review Arrival Request" description="Loading request...">
        <div className="py-24 text-center text-xs text-[#5C6B68]">
          <RefreshCw className="h-8 w-8 animate-spin text-[#004741] mx-auto mb-3" />
          Evaluating vessel specifications, feasibility rules, and optimization schedule...
        </div>
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell title="Arrival Request Not Found" description="Request could not be loaded.">
        <div className="rounded-xl border border-[#F2C4C3] bg-[#FCE9E8] p-6 text-center text-xs text-[#B94A48]">
          Arrival request not found or inaccessible.
          <div className="mt-4">
            <Link
              href="/operations/vessel-requests"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#004741] px-3 py-2 text-xs font-semibold text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Requests
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const v = {
    length_loa: request.vessel_loa,
    draft: request.vessel_draft,
    beam: request.vessel_beam,
    imo_number: request.vessel_imo,
    flag: (request as any).flag || "—",
    hazardous_cargo: request.hazardous_cargo,
  };
  const f = (request.feasibility_details as any) || {};
  const opt = (request.optimization_recommendation as any);

  const isHardFail = request.feasibility_status === "FAIL";
  const isApproved = request.status === "APPROVED";
  const isRejected = request.status === "REJECTED";

  return (
    <AppShell
      title={`Request ${request.request_code}`}
      description={`Review and decide on inbound arrival for ${request.vessel_name || "Vessel"} from ${request.organization_name || "Carrier"}.`}
      onRefresh={loadData}
    >
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between pb-2">
        <Link
          href="/operations/vessel-requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C6B68] hover:text-[#004741] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to All Requests
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#899491]">Status:</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
              isApproved
                ? "bg-[#E5F2EA] text-[#2F7D5B]"
                : isRejected
                ? "bg-[#FCE9E8] text-[#B94A48]"
                : "bg-[#E1EFEC] text-[#004741]"
            )}
          >
            {request.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Notification feedback */}
      {successMessage && (
        <div className="rounded-xl border border-[#C5DDD9] bg-[#E5F2EA] p-3 text-xs text-[#2F7D5B] font-semibold flex items-center justify-between shadow-xs">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="text-[#2F7D5B] hover:opacity-70">
            &times;
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-[#F2C4C3] bg-[#FCE9E8] p-3 text-xs text-[#B94A48] font-semibold flex items-center justify-between shadow-xs">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="text-[#B94A48] hover:opacity-70">
            &times;
          </button>
        </div>
      )}

      {/* 1. Header Cockpit Banner */}
      <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#004741] text-white shadow-sm">
              <Ship className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#102A27]">
                  {request.vessel_name || "Vessel"}
                </h2>
                <span className="font-mono text-xs font-semibold text-[#004741] bg-[#E1EFEC] px-2 py-0.5 rounded">
                  {request.request_code}
                </span>
                {v?.hazardous_cargo && (
                  <span className="rounded bg-[#FFF4DE] px-2 py-0.5 text-[10px] font-bold text-[#C58A2B]">
                    HAZARDOUS CARGO (DG)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5C6B68] mt-1 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-[#899491]" />
                <span className="font-semibold text-[#102A27]">{request.organization_name}</span>
                <span>&bull;</span>
                <span>IMO: {v?.imo_number || "—"}</span>
                <span>&bull;</span>
                <span>Flag: {v?.flag || "—"}</span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs font-semibold text-[#102A27] hover:bg-[#F7F6F2] transition-colors shadow-xs"
            >
              <Zap className="h-3.5 w-3.5 text-[#E0A75E]" />
              <span>Simulate Sandbox</span>
            </button>

            {!isApproved && !isRejected && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveActionModal("ALTERNATIVE")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#C58A2B] bg-[#FFF4DE] px-3 py-2 text-xs font-semibold text-[#C58A2B] hover:bg-[#FFEEC7] transition-colors shadow-xs"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Propose Alternative</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveActionModal("REQUEST_CHANGES")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs font-semibold text-[#5C6B68] hover:bg-[#F7F6F2] transition-colors shadow-xs"
                >
                  <FileEdit className="h-3.5 w-3.5" />
                  <span>Request Changes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveActionModal("REJECT")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#F2C4C3] bg-[#FCE9E8] px-3 py-2 text-xs font-semibold text-[#B94A48] hover:bg-[#FAD9D7] transition-colors shadow-xs"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveActionModal("APPROVE")}
                  disabled={isHardFail}
                  title={isHardFail ? "Cannot approve: hard physical constraints violated" : "Approve and schedule"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors",
                    isHardFail
                      ? "bg-[#899491] opacity-50 cursor-not-allowed"
                      : "bg-[#004741] hover:bg-[#003B36]"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve & Commit to Live</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Key Metrics Bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#F0EDE4] pt-4 text-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#899491] font-semibold">Requested ETA</span>
            <div className="font-semibold text-[#102A27] mt-0.5">
              {new Date(request.requested_eta).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#899491] font-semibold">Expected Departure</span>
            <div className="font-semibold text-[#102A27] mt-0.5">
              {new Date(request.expected_departure).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#899491] font-semibold">Cargo Payload</span>
            <div className="font-semibold text-[#102A27] mt-0.5">
              {request.cargo_quantity.toLocaleString()} {request.cargo_type}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#899491] font-semibold">Vessel Dimensions</span>
            <div className="font-semibold text-[#102A27] mt-0.5">
              {v?.length_loa}m LOA &bull; {v?.draft}m Draft &bull; {v?.beam}m Beam
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid: Feasibility Matrix + CP-SAT Optimization Solver Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Deterministic Feasibility Matrix */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4] mb-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg shadow-xs",
                  f?.overall_status === "PASS"
                    ? "bg-[#E5F2EA] text-[#2F7D5B]"
                    : f?.overall_status === "FAIL"
                    ? "bg-[#FCE9E8] text-[#B94A48]"
                    : "bg-[#FFF4DE] text-[#C58A2B]"
                )}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#102A27]">
                Deterministic Feasibility Checklist
              </h3>
            </div>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-bold uppercase",
                f?.overall_status === "PASS"
                  ? "bg-[#E5F2EA] text-[#2F7D5B]"
                  : f?.overall_status === "FAIL"
                  ? "bg-[#FCE9E8] text-[#B94A48]"
                  : "bg-[#FFF4DE] text-[#C58A2B]"
              )}
            >
              {f?.overall_status || "EVALUATING"}
            </span>
          </div>

          <div className="space-y-2.5">
            {f?.checks && f.checks.length > 0 ? (
              f.checks.map((check: any, idx: number) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3 text-xs transition-colors",
                    check.passed
                      ? "border-[#E5F2EA] bg-[#F7FAF8]"
                      : check.is_hard_constraint
                      ? "border-[#F2C4C3] bg-[#FCE9E8]"
                      : "border-[#F0D49A] bg-[#FFF4DE]"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2F7D5B] mt-0.5" />
                    ) : check.is_hard_constraint ? (
                      <XCircle className="h-4 w-4 shrink-0 text-[#B94A48] mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#C58A2B] mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#102A27]">{check.check_name}</span>
                        {check.is_hard_constraint && (
                          <span className="rounded bg-red-100 px-1.5 py-0.2 text-[9px] font-bold text-red-700">
                            HARD RULE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5C6B68] mt-0.5">{check.details}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0",
                      check.passed
                        ? "bg-[#E5F2EA] text-[#2F7D5B]"
                        : check.is_hard_constraint
                        ? "bg-[#FCE9E8] text-[#B94A48]"
                        : "bg-[#FFF4DE] text-[#C58A2B]"
                    )}
                  >
                    {check.passed ? "Pass" : check.is_hard_constraint ? "Fail" : "Warning"}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#899491]">
                No feasibility checks recorded.
              </div>
            )}
          </div>
        </div>

        {/* Right: CP-SAT Solver Recommendation & Operational Impact */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4] mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1EFEC] text-[#004741] shadow-xs">
                  <Zap className="h-4 w-4 text-[#E0A75E]" />
                </div>
                <h3 className="text-sm font-semibold text-[#102A27]">
                  OR-Tools CP-SAT Recommendation
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-[#004741]">
                Schedule v{opt?.schedule_version || 1}
              </span>
            </div>

            {opt ? (
              <div className="space-y-4">
                {/* Recommended Allocation Card */}
                <div className="rounded-xl border border-[#C5DDD9] bg-[#E1EFEC]/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#004741]">Recommended Berth</span>
                    <span className="text-sm font-bold text-[#102A27]">
                      {opt.recommended_berth_name || "Any Feasible Berth"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-[#C5DDD9] pt-2">
                    <div>
                      <span className="text-[10px] text-[#5C6B68]">Scheduled Start</span>
                      <div className="font-semibold text-[#102A27]">
                        {opt.scheduled_start
                          ? new Date(opt.scheduled_start).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "At Arrival"}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5C6B68]">Scheduled End</span>
                      <div className="font-semibold text-[#102A27]">
                        {opt.scheduled_end
                          ? new Date(opt.scheduled_end).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "At Departure"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operational Impact Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-[#E3E5E0] bg-white p-2.5">
                    <span className="text-[10px] font-semibold text-[#899491] uppercase">Wait Time</span>
                    <div className="text-lg font-bold font-mono text-[#102A27] mt-0.5">
                      {opt.estimated_waiting_hours || 0}h
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E3E5E0] bg-white p-2.5">
                    <span className="text-[10px] font-semibold text-[#899491] uppercase">Congestion &Delta;</span>
                    <div className="text-lg font-bold font-mono text-[#2F7D5B] mt-0.5">
                      {opt.congestion_impact ? `+${opt.congestion_impact.score_delta} pts` : "Minimal"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E3E5E0] bg-white p-2.5">
                    <span className="text-[10px] font-semibold text-[#899491] uppercase">Affected Vessels</span>
                    <div className="text-lg font-bold font-mono text-[#102A27] mt-0.5">
                      {opt.affected_vessels?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Solved Explanation */}
                <div className="rounded-lg border border-[#D5DCDA] bg-white p-3 text-xs text-[#5C6B68]">
                  <span className="font-semibold text-[#102A27]">Solver Insights: </span>
                  {opt.operational_notes ||
                    "Berth allocation satisfies required turnaround window with zero anchorage demurrage risk."}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#899491]">
                Optimization recommendation pending calculation.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0EDE4] flex items-center justify-between text-[11px] text-[#899491]">
            <span>Solver Engine: Google OR-Tools CP-SAT</span>
            <span>Concurrency Guard: v{opt?.schedule_version || 1}</span>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Request Audit Trail */}
      <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4] mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1EFEC] text-[#004741]">
              <FileText className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#102A27]">
              Complete Auditable Event Log
            </h3>
          </div>
          <span className="text-[11px] text-[#899491]">{auditLogs.length} events recorded</span>
        </div>

        <div className="space-y-3">
          {auditLogs.length > 0 ? (
            auditLogs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-4 rounded-lg border border-[#E3E5E0] bg-white p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                        log.actor_domain === "PORT_OPERATIONS"
                          ? "bg-[#004741] text-white"
                          : "bg-blue-100 text-blue-800"
                      )}
                    >
                      {log.actor_domain}
                    </span>
                    <span className="font-semibold text-[#102A27]">{log.action}</span>
                    <span className="text-[#899491]">by</span>
                    <span className="font-medium text-[#102A27]">{log.actor_name || "System"}</span>
                  </div>
                  {log.comment && (
                    <p className="text-[11px] text-[#5C6B68] mt-1 italic">&ldquo;{log.comment}&rdquo;</p>
                  )}
                  {log.reason && (
                    <p className="text-[11px] text-[#B94A48] mt-0.5">Reason: {log.reason}</p>
                  )}
                </div>

                <div className="text-right text-[11px] text-[#899491] shrink-0 font-mono">
                  {new Date(log.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-[#899491]">No audit entries found.</div>
          )}
        </div>
      </div>

      {/* MODAL: APPROVE REQUEST */}
      {activeActionModal === "APPROVE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E5E0] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#2F7D5B]" />
                <h3 className="font-bold text-sm text-[#102A27]">
                  Approve Arrival & Commit to Live Port Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#5C6B68]">
              Approving this request commits <strong>{request.vessel_name}</strong> directly into the live Port Operations vessel schedule (v{opt?.schedule_version || 1}) and notifies the shipping company.
            </p>

            <form onSubmit={handleApprove} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#102A27] block mb-1">Berth Allocation</label>
                <select
                  value={approveBerthId}
                  onChange={(e) => setApproveBerthId(e.target.value)}
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                >
                  {berths.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.berth_name} ({b.berth_code}) &bull; Length: {b.max_vessel_length}m
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#102A27] block mb-1">Confirmed Arrival</label>
                  <input
                    type="datetime-local"
                    value={approveStart}
                    onChange={(e) => setApproveStart(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#102A27] block mb-1">Confirmed Departure</label>
                  <input
                    type="datetime-local"
                    value={approveEnd}
                    onChange={(e) => setApproveEnd(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#102A27] block mb-1">Manager Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="e.g. Berth cleared, pilot assigned for 08:00 UTC inbound channel window."
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                />
              </div>

              <div className="rounded-lg bg-[#E1EFEC] p-3 text-[11px] text-[#004741]">
                <strong>Schedule Concurrency Guard:</strong> This approval locks against schedule version v{opt?.schedule_version || 1}. If another operator altered the schedule, the system will prevent race conditions.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3E5E0]">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-lg border border-[#D5DCDA] px-3 py-2 text-xs font-semibold text-[#5C6B68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#004741] px-4 py-2 text-xs font-bold text-white hover:bg-[#003B36] flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Approval & Commit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROPOSE ALTERNATIVE */}
      {activeActionModal === "ALTERNATIVE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E5E0] pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-[#C58A2B]" />
                <h3 className="font-bold text-sm text-[#102A27]">
                  Propose Alternative Arrival Window
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#5C6B68]">
              Suggest an alternative berth or timing to resolve congestion or resource constraints. The carrier will be prompted to accept or decline.
            </p>

            <form onSubmit={handleProposeAlternative} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#102A27] block mb-1">Proposed Berth</label>
                <select
                  value={altBerthId}
                  onChange={(e) => setAltBerthId(e.target.value)}
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                >
                  {berths.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.berth_name} ({b.berth_code}) &bull; Length: {b.max_vessel_length}m
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#102A27] block mb-1">Proposed ETA</label>
                  <input
                    type="datetime-local"
                    value={altEta}
                    onChange={(e) => setAltEta(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#102A27] block mb-1">Proposed Departure</label>
                  <input
                    type="datetime-local"
                    value={altEtd}
                    onChange={(e) => setAltEtd(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#102A27] block mb-1">
                  Operational Justification (Required)
                </label>
                <textarea
                  rows={3}
                  value={altReason}
                  onChange={(e) => setAltReason(e.target.value)}
                  required
                  placeholder="e.g. Berth 1 occupied by CMA CGM Marco Polo until 14:00. Proposing Berth 2 arrival at 16:00 to avoid anchorage waiting demurrage."
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3E5E0]">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-lg border border-[#D5DCDA] px-3 py-2 text-xs font-semibold text-[#5C6B68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#C58A2B] px-4 py-2 text-xs font-bold text-white hover:bg-[#B07B24] flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Send Proposal to Carrier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST CHANGES */}
      {activeActionModal === "REQUEST_CHANGES" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E5E0] pb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-[#5C6B68]" />
                <h3 className="font-bold text-sm text-[#102A27]">
                  Request Additional Information or Updates
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestChanges} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#102A27] block mb-1">
                  Required Updates or Documentation
                </label>
                <textarea
                  rows={4}
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  required
                  placeholder="e.g. Please provide DG manifest class 3 safety sheet and confirm maximum arrival draft is strictly under 14.5m."
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3E5E0]">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-lg border border-[#D5DCDA] px-3 py-2 text-xs font-semibold text-[#5C6B68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#004741] px-4 py-2 text-xs font-bold text-white hover:bg-[#003B36] flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Submit Request to Carrier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT REQUEST */}
      {activeActionModal === "REJECT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E5E0] pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-[#B94A48]" />
                <h3 className="font-bold text-sm text-[#102A27]">
                  Decline Vessel Arrival Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#5C6B68]">
              Declining will reject the request with official justification. This action is auditable and communicates reason to the customer.
            </p>

            <form onSubmit={handleReject} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#102A27] block mb-1">Primary Reason</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                >
                  <option value="Berth Saturation">Berth Saturation & Queuing Limits Exceeded</option>
                  <option value="Vessel Dimensions Incompatible">Vessel Dimensions Incompatible (LOA/Draft)</option>
                  <option value="Yard Capacity Exceeded">Yard Container Storage Overcapacity (&gt;90%)</option>
                  <option value="Hazardous Cargo Restriction">Hazardous Cargo Restrictions (DG Non-compliant)</option>
                  <option value="Channel Impediment / Adverse Weather">Channel Impediment / Adverse Weather Event</option>
                  <option value="Other">Other Operational Justification</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#102A27] block mb-1">
                  Operational Comments / Justification
                </label>
                <textarea
                  rows={3}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Provide detailed feedback for carrier operations..."
                  className="w-full rounded-lg border border-[#D5DCDA] bg-white px-3 py-2 text-xs text-[#102A27]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3E5E0]">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-lg border border-[#D5DCDA] px-3 py-2 text-xs font-semibold text-[#5C6B68]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#B94A48] px-4 py-2 text-xs font-bold text-white hover:bg-[#A33B39] flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SIMULATION SANDBOX */}
      {activeActionModal === "SIMULATE" && simulationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E5E0] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#E0A75E]" />
                <h3 className="font-bold text-sm text-[#102A27]">
                  What-If Simulation Results (Zero Live Impact)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                &times;
              </button>
            </div>

            <div className="rounded-lg bg-[#F7F9F8] p-3 text-xs text-[#5C6B68]">
              Simulated under live port state v{simulationResult.live_schedule_version} with candidate arrival inserted into solver model:
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[#C5DDD9] bg-[#E1EFEC] p-3">
                <span className="font-semibold text-[#004741]">Candidate Berth</span>
                <div className="text-base font-bold text-[#102A27] mt-1">
                  {simulationResult.recommendation?.recommended_berth_name || "Optimal Berth"}
                </div>
              </div>
              <div className="rounded-lg border border-[#E3E5E0] bg-white p-3">
                <span className="font-semibold text-[#5C6B68]">Estimated Wait</span>
                <div className="text-base font-bold text-[#102A27] mt-1">
                  {simulationResult.recommendation?.estimated_waiting_hours || 0} Hours
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#E3E5E0] bg-white p-3 text-xs text-[#5C6B68]">
              <span className="font-semibold text-[#102A27]">Analysis: </span>
              {simulationResult.recommendation?.operational_notes || "Clean schedule integration with minimal impact."}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E3E5E0]">
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="rounded-lg bg-[#004741] px-4 py-2 text-xs font-bold text-white"
              >
                Close Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

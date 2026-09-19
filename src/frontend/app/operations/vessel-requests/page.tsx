"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { ArrivalRequest } from "@/types/customer";
import {
  ClipboardCheck,
  Ship,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Building2,
  Anchor,
  Calendar,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OperationArrivalRequestsPage() {
  const [requests, setRequests] = useState<ArrivalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const loadRequests = async () => {
    try {
      setRefreshing(true);
      const data = await api.getIncomingArrivalRequests();
      setRequests(data);
    } catch (err) {
      console.error("Failed to load operations arrival requests", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 20_000);
    return () => clearInterval(interval);
  }, []);

  // Filter logic
  const filtered = requests.filter((req) => {
    // Tab filter
    if (activeTab === "PENDING") {
      if (!["SUBMITTED", "UNDER_REVIEW", "FEASIBILITY_CHECK", "OPTIMIZATION_RUNNING"].includes(req.status)) {
        return false;
      }
    } else if (activeTab === "PROPOSED") {
      if (!["ALTERNATIVE_PROPOSED", "CHANGES_REQUESTED"].includes(req.status)) {
        return false;
      }
    } else if (activeTab === "APPROVED") {
      if (req.status !== "APPROVED") return false;
    } else if (activeTab === "REJECTED") {
      if (req.status !== "REJECTED") return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = req.request_code.toLowerCase().includes(q);
      const vesselMatch = (req.vessel_name || "").toLowerCase().includes(q);
      const orgMatch = (req.organization_name || "").toLowerCase().includes(q);
      const cargoMatch = (req.cargo_type || "").toLowerCase().includes(q);
      return codeMatch || vesselMatch || orgMatch || cargoMatch;
    }

    return true;
  });

  // KPI counters
  const totalCount = requests.length;
  const pendingCount = requests.filter((r) =>
    ["SUBMITTED", "UNDER_REVIEW", "FEASIBILITY_CHECK", "OPTIMIZATION_RUNNING"].includes(r.status)
  ).length;
  const proposedCount = requests.filter((r) =>
    ["ALTERNATIVE_PROPOSED", "CHANGES_REQUESTED"].includes(r.status)
  ).length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E5F2EA] px-2.5 py-0.5 text-xs font-semibold text-[#2F7D5B]">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FCE9E8] px-2.5 py-0.5 text-xs font-semibold text-[#B94A48]">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      case "ALTERNATIVE_PROPOSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4DE] px-2.5 py-0.5 text-xs font-semibold text-[#C58A2B]">
            <SlidersHorizontal className="h-3 w-3" />
            Alternative Proposed
          </span>
        );
      case "CHANGES_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <Clock className="h-3 w-3" />
            Changes Requested
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-500">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E1EFEC] px-2.5 py-0.5 text-xs font-semibold text-[#004741]">
            <Clock className="h-3 w-3 animate-pulse" />
            Pending Review
          </span>
        );
    }
  };

  const getFeasibilityBadge = (req: ArrivalRequest) => {
    const status = req.feasibility_status;
    if (status === "PASS") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#E5F2EA] px-2 py-0.5 text-[11px] font-semibold text-[#2F7D5B]">
          <CheckCircle2 className="h-3 w-3" /> Feasible
        </span>
      );
    } else if (status === "FAIL") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#FCE9E8] px-2 py-0.5 text-[11px] font-semibold text-[#B94A48]">
          <XCircle className="h-3 w-3" /> Incompatible
        </span>
      );
    } else if (status === "WARN") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#FFF4DE] px-2 py-0.5 text-[11px] font-semibold text-[#C58A2B]">
          <AlertTriangle className="h-3 w-3" /> Soft Warnings
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
        Evaluating...
      </span>
    );
  };

  return (
    <AppShell
      title="Vessel Arrival Requests"
      description="Evaluate inbound arrival requests, inspect automated CP-SAT feasibility and berth recommendations, and decide on live operational commitments."
      onRefresh={loadRequests}
      isRefreshing={refreshing}
    >
      {/* 1. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inbound Requests */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-card">
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Inbound</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1EFEC] text-[#004741]">
              <ClipboardCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#102A27]">{totalCount}</span>
            <span className="text-xs text-[#5C6B68]">requests recorded</span>
          </div>
        </div>

        {/* Pending Review */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-card border-l-4 border-l-[#004741]">
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Pending Decision</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1EFEC] text-[#004741]">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#004741]">{pendingCount}</span>
            <span className="text-xs text-[#5C6B68]">requires manager action</span>
          </div>
        </div>

        {/* Alternative Proposed */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-card border-l-4 border-l-[#C58A2B]">
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Awaiting Carrier</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF4DE] text-[#C58A2B]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#C58A2B]">{proposedCount}</span>
            <span className="text-xs text-[#5C6B68]">under negotiation</span>
          </div>
        </div>

        {/* Approved & Scheduled */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-card border-l-4 border-l-[#2F7D5B]">
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Approved & Scheduled</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5F2EA] text-[#2F7D5B]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#2F7D5B]">{approvedCount}</span>
            <span className="text-xs text-[#5C6B68]">committed to quayside</span>
          </div>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-[#F7F9F8] rounded-lg border border-[#E3E5E0]">
            {[
              { id: "ALL", label: "All Requests", count: totalCount },
              { id: "PENDING", label: "Pending Review", count: pendingCount },
              { id: "PROPOSED", label: "In Negotiation", count: proposedCount },
              { id: "APPROVED", label: "Approved", count: approvedCount },
              { id: "REJECTED", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all shrink-0",
                  activeTab === tab.id
                    ? "bg-[#004741] text-white shadow-xs"
                    : "text-[#5C6B68] hover:text-[#102A27] hover:bg-white/80"
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      activeTab === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-[#E3E5E0] text-[#5C6B68]"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
            <input
              type="text"
              placeholder="Search request, vessel, line..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#D5DCDA] bg-white pl-9 pr-3 py-2 text-xs text-[#102A27] placeholder-[#899491] focus:border-[#004741] focus:outline-hidden"
            />
          </div>
        </div>

        {/* 3. Table of Requests */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#5C6B68]">
            <RefreshCw className="h-6 w-6 animate-spin text-[#004741] mx-auto mb-2" />
            Loading incoming requests from Customer Module...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#5C6B68] border border-dashed border-[#D5DCDA] rounded-lg">
            <ClipboardCheck className="h-8 w-8 text-[#899491] mx-auto mb-2" />
            <div className="font-semibold text-sm text-[#102A27]">No Arrival Requests Found</div>
            <p className="text-[#899491] mt-1">
              {searchQuery ? "No requests match your search criteria." : "No requests in this category."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E3E5E0]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E5E0] bg-[#F7F9F8] text-[11px] font-semibold uppercase tracking-wider text-[#5C6B68]">
                  <th className="px-4 py-3">Request Code</th>
                  <th className="px-4 py-3">Shipping Line / Carrier</th>
                  <th className="px-4 py-3">Vessel & Dimensions</th>
                  <th className="px-4 py-3">Requested ETA &bull; ETD</th>
                  <th className="px-4 py-3">Feasibility</th>
                  <th className="px-4 py-3">Solver Recommendation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E0] bg-white">
                {filtered.map((req) => {
                  const opt = req.optimization_recommendation;
                  return (
                    <tr key={req.id} className="hover:bg-[#F7F9F8] transition-colors">
                      {/* Code */}
                      <td className="px-4 py-3 font-mono font-semibold text-[#004741]">
                        <Link
                          href={`/operations/vessel-requests/${req.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {req.request_code}
                        </Link>
                        <span className="block text-[10px] text-[#899491] font-sans">
                          {new Date(req.submitted_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Carrier */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#102A27]">
                          {req.organization_name || "Shipping Carrier"}
                        </div>
                        <span className="text-[11px] text-[#5C6B68]">
                          {req.cargo_quantity ? `${req.cargo_quantity.toLocaleString()} ${req.cargo_type}` : req.cargo_type}
                        </span>
                      </td>

                      {/* Vessel */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-semibold text-[#102A27]">
                          <Ship className="h-3.5 w-3.5 text-[#004741]" />
                          <span>{req.vessel_name || "Vessel"}</span>
                        </div>
                        {req.vessel_loa ? (
                          <span className="text-[10px] text-[#899491]">
                            LOA: {req.vessel_loa}m &bull; Draft: {req.vessel_draft}m
                          </span>
                        ) : null}
                      </td>

                      {/* ETA/ETD */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#102A27]">
                          {new Date(req.requested_eta).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <span className="text-[10px] text-[#899491]">
                          to{" "}
                          {new Date(req.expected_departure).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Feasibility */}
                      <td className="px-4 py-3">{getFeasibilityBadge(req)}</td>

                      {/* Solver Recommendation */}
                      <td className="px-4 py-3">
                        {opt?.recommended_berth_name ? (
                          <div>
                            <div className="font-semibold text-[#102A27] flex items-center gap-1">
                              <Anchor className="h-3 w-3 text-[#2F7D8C]" />
                              <span>{opt.recommended_berth_name}</span>
                            </div>
                            <span className="text-[10px] text-[#5C6B68]">
                              Wait: {(opt as any).estimated_waiting_hours ?? opt.current_metrics?.waiting_time_hours ?? 0}h &bull; Sched: v{opt.schedule_version}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#899491] italic">Not scheduled</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">{getStatusBadge(req.status)}</td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Link href={`/operations/vessel-requests/${req.id}`}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg bg-[#004741] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#003B36] transition-colors"
                          >
                            <span>Review & Decide</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  PlusCircle,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  GitPullRequest,
  AlertTriangle,
  XCircle,
  Ship,
  SlidersHorizontal,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { ArrivalRequest } from "@/types/customer";
import { Button } from "@/components/design-system/button";
import { Badge } from "@/components/design-system/badge";
import { cn } from "@/lib/utils";

export default function CustomerArrivalRequestsPage() {
  const [requests, setRequests] = useState<ArrivalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const loadRequests = async () => {
    try {
      setLoading(true);
      const list = await customerApi.getArrivalRequests();
      setRequests(list);
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const totalCount = requests.length;
  const pendingCount = requests.filter((r) =>
    ["SUBMITTED", "VALIDATING", "FEASIBILITY_CHECK", "OPTIMIZATION_RUNNING", "PENDING_MANAGER_REVIEW"].includes(r.status)
  ).length;
  const proposedCount = requests.filter((r) =>
    ["ALTERNATIVE_PROPOSED", "CUSTOMER_RESPONSE_REQUIRED", "CHANGES_REQUESTED"].includes(r.status)
  ).length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED" || r.status === "CANCELLED").length;

  const filteredRequests = requests.filter((r) => {
    // Tab filter
    if (activeTab === "PENDING") {
      if (!["SUBMITTED", "VALIDATING", "FEASIBILITY_CHECK", "OPTIMIZATION_RUNNING", "PENDING_MANAGER_REVIEW"].includes(r.status)) {
        return false;
      }
    } else if (activeTab === "PROPOSED") {
      if (!["ALTERNATIVE_PROPOSED", "CUSTOMER_RESPONSE_REQUIRED", "CHANGES_REQUESTED"].includes(r.status)) {
        return false;
      }
    } else if (activeTab === "APPROVED") {
      if (r.status !== "APPROVED") return false;
    } else if (activeTab === "REJECTED") {
      if (r.status !== "REJECTED" && r.status !== "CANCELLED") return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = r.request_code.toLowerCase().includes(q);
      const vesselMatch = (r.vessel_name || "").toLowerCase().includes(q);
      const originMatch = (r.origin || "").toLowerCase().includes(q);
      const destMatch = (r.destination || "").toLowerCase().includes(q);
      const cargoMatch = (r.cargo_type || "").toLowerCase().includes(q);
      return codeMatch || vesselMatch || originMatch || destMatch || cargoMatch;
    }

    return true;
  });

  return (
    <CustomerShell
      title="Arrival Requests & Tracking History"
      subtitle="Track full lifecycle state machine, automated feasibility diagnostics, and Operation Manager decisions."
      actions={
        <Link href="/customer/arrival-requests/new">
          <Button variant="primary" size="sm" leftIcon={<PlusCircle className="h-3.5 w-3.5" />}>
            New Arrival Request
          </Button>
        </Link>
      }
    >
      <div className="space-y-5">
        {/* ── Filter Tabs & Search Bar ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-4 shadow-card space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-[#F7F9F8] rounded-lg border border-[#E3E5E0]">
              {[
                { id: "ALL", label: "All Requests", count: totalCount },
                { id: "PENDING", label: "Pending Review", count: pendingCount },
                { id: "PROPOSED", label: "Alternative Proposed", count: proposedCount },
                { id: "APPROVED", label: "Approved", count: approvedCount },
                { id: "REJECTED", label: "Declined", count: rejectedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer",
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, vessel, port..."
                className="w-full rounded-lg border border-[#D5D9D3] bg-white pl-9 pr-3 py-1.5 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
              />
            </div>
          </div>
        </div>

        {/* ── Requests Table ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E5E0] bg-[#F7F9F8] text-[11px] font-semibold uppercase tracking-wider text-[#5C6B68]">
                  <th className="px-4 py-3">Request Code</th>
                  <th className="px-4 py-3">Vessel & Specs</th>
                  <th className="px-4 py-3">Requested ETA</th>
                  <th className="px-4 py-3">Voyage Route</th>
                  <th className="px-4 py-3">Feasibility</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Berth</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E0] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[#5C6B68]">
                      Loading arrival requests...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[#5C6B68]">
                      {searchQuery
                        ? "No arrival requests match your search criteria."
                        : "No arrival requests in this category."}
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#F7F9F8] transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-[#102A27]">
                        <Link
                          href={`/customer/arrival-requests/${req.id}`}
                          className="hover:text-[#004741] hover:underline"
                        >
                          {req.request_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#102A27]">{req.vessel_name}</div>
                        <div className="text-[10px] text-[#899491]">
                          {req.vessel_imo || "IMO Verified"} &bull; {req.cargo_quantity.toLocaleString()} {req.cargo_type}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#102A27]">
                        <div>
                          {new Date(req.requested_eta).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[10px] text-[#899491]">
                          {new Date(req.requested_eta).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          UTC
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#5C6B68]">
                        <div className="truncate max-w-[150px]" title={`${req.origin} → ${req.destination}`}>
                          {req.origin} &rarr; {req.destination}
                        </div>
                        <div className="text-[10px] text-[#899491]">
                          Stay: {req.expected_port_stay_hours}h
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {req.feasibility_status === "PASS" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#E5F2EA] px-2 py-0.5 text-[11px] font-semibold text-[#2F7D5B]">
                            <CheckCircle2 className="h-3 w-3" /> Feasible
                          </span>
                        ) : req.feasibility_status === "FAIL" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#FCE9E8] px-2 py-0.5 text-[11px] font-semibold text-[#B94A48]">
                            <XCircle className="h-3 w-3" /> Incompatible
                          </span>
                        ) : req.feasibility_status === "WARN" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#FFF4DE] px-2 py-0.5 text-[11px] font-semibold text-[#C58A2B]">
                            <AlertTriangle className="h-3 w-3" /> Soft Warnings
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-[#F7F6F2] px-2 py-0.5 text-[11px] text-[#899491]">
                            Evaluating...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="status" status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-[#5C6B68]">
                        {req.assigned_berth_code ? (
                          <span className="font-semibold text-[#004741]">
                            {req.assigned_berth_code}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#899491]">
                            {req.preferred_berth_code ? `Pref: ${req.preferred_berth_code}` : "Unassigned"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/customer/arrival-requests/${req.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#004741] bg-[#E1EFEC] hover:bg-[#004741] hover:text-white transition-colors"
                        >
                          <span>Track</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}

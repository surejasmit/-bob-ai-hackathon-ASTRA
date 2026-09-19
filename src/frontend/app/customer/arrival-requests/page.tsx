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
  Eye,
  Ship,
  Calendar,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { ArrivalRequest } from "@/types/customer";

export default function CustomerArrivalRequestsPage() {
  const [requests, setRequests] = useState<ArrivalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#059669]/20 text-[#34D399] border border-[#059669]/30">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case "ALTERNATIVE_PROPOSED":
      case "CUSTOMER_RESPONSE_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#0284C7]/20 text-[#38BDF8] border border-[#0284C7]/30 animate-pulse">
            <GitPullRequest className="h-3 w-3" /> Alternative Proposed
          </span>
        );
      case "PENDING_MANAGER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#D97706]/20 text-[#FBBF24] border border-[#D97706]/30">
            <Clock className="h-3 w-3" /> Under Review
          </span>
        );
      case "CHANGES_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#EA580C]/20 text-[#FB923C] border border-[#EA580C]/30">
            <AlertTriangle className="h-3 w-3" /> Changes Needed
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#DC2626]/20 text-[#F87171] border border-[#DC2626]/30">
            <XCircle className="h-3 w-3" /> Declined
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-[#16364D] text-[#8CB4D2]">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-[#16364D] text-[#8CB4D2]">
            {status}
          </span>
        );
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.request_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vessel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <CustomerShell
      title="Arrival Requests & Tracking History"
      subtitle="Track full lifecycle state machine, feasibility diagnostics, and Operation Manager decisions."
      actions={
        <Link
          href="/customer/arrival-requests/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white font-bold text-xs shadow-lg shadow-[#009688]/25 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Arrival Request</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* ── Filters & Search ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-[#091E2C] border border-[#13344A]">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, vessel, port..."
              className="w-full rounded-xl border border-[#16364D] bg-[#061520] px-3.5 py-2 pl-9 text-xs text-white placeholder:text-[#5E83A1] focus:outline-none focus:border-[#009688]"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5E83A1]" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-[#5E83A1]" />
            <span className="text-xs text-[#7BA1BF]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#16364D] bg-[#061520] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#009688]"
            >
              <option value="all">All Request Statuses</option>
              <option value="PENDING_MANAGER_REVIEW">Under Review</option>
              <option value="ALTERNATIVE_PROPOSED">Alternative Proposed</option>
              <option value="APPROVED">Approved</option>
              <option value="CHANGES_REQUESTED">Changes Needed</option>
              <option value="REJECTED">Declined</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* ── Requests Table ── */}
        <div className="rounded-3xl bg-[#091E2C]/90 border border-[#13344A] p-6 shadow-xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#6D94B5] uppercase tracking-wider font-bold border-b border-[#13344A]">
                  <th className="py-3.5 px-3">Request Code</th>
                  <th className="py-3.5 px-3">Vessel & Specs</th>
                  <th className="py-3.5 px-3">Requested ETA</th>
                  <th className="py-3.5 px-3">Voyage Route</th>
                  <th className="py-3.5 px-3">Feasibility</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Assigned Berth</th>
                  <th className="py-3.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#13344A]/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6D94B5]">
                      Loading arrival requests...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6D94B5]">
                      No arrival requests match your query.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#0E2E44]/50 transition-colors">
                      <td className="py-4 px-3 font-mono font-bold text-white">
                        <Link
                          href={`/customer/arrival-requests/${req.id}`}
                          className="hover:text-[#38BDF8] transition-colors"
                        >
                          {req.request_code}
                        </Link>
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-semibold text-white">{req.vessel_name}</div>
                        <div className="text-[10px] text-[#6D94B5]">
                          {req.vessel_imo || "Verified"} &bull; {req.cargo_quantity.toLocaleString()} {req.cargo_type}
                        </div>
                      </td>
                      <td className="py-4 px-3 text-[#A5C7E2]">
                        <div className="font-medium">
                          {new Date(req.requested_eta).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[10px] text-[#6D94B5]">
                          {new Date(req.requested_eta).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          UTC &bull; {req.expected_port_stay_hours}h stay
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="text-white font-medium truncate max-w-[140px]">
                          {req.origin}
                        </div>
                        <div className="text-[10px] text-[#6D94B5] truncate max-w-[140px]">
                          &rarr; {req.destination}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.feasibility_status === "PASS"
                              ? "bg-[#059669]/20 text-[#34D399]"
                              : req.feasibility_status === "WARN"
                              ? "bg-[#D97706]/20 text-[#FBBF24]"
                              : "bg-[#DC2626]/20 text-[#F87171]"
                          }`}
                        >
                          {req.feasibility_status || "EVALUATING"}
                        </span>
                      </td>
                      <td className="py-4 px-3">{getStatusBadge(req.status)}</td>
                      <td className="py-4 px-3">
                        {req.assigned_berth_code ? (
                          <span className="font-bold text-[#34D399]">
                            {req.assigned_berth_code}
                          </span>
                        ) : req.preferred_berth_code ? (
                          <span className="text-[#8CB4D2]">
                            Pref: {req.preferred_berth_code}
                          </span>
                        ) : (
                          <span className="text-[#567A99]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right">
                        <Link
                          href={`/customer/arrival-requests/${req.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#0E3550] hover:bg-[#14476B] px-3 py-1.5 rounded-xl border border-[#1B4F75] transition-all"
                        >
                          <Eye className="h-3 w-3 text-[#38BDF8]" />
                          <span>Track</span>
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

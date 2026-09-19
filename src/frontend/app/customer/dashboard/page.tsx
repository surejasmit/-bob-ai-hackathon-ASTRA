"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Ship,
  FileSpreadsheet,
  PlusCircle,
  GitPullRequest,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Building2,
  Calendar,
  Anchor,
  Compass,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi, getCachedCustomerSession } from "@/lib/customer-api";
import {
  CustomerVessel,
  ArrivalRequest,
  CustomerOrganization,
} from "@/types/customer";

export default function CustomerDashboardPage() {
  const [vessels, setVessels] = useState<CustomerVessel[]>([]);
  const [requests, setRequests] = useState<ArrivalRequest[]>([]);
  const [org, setOrg] = useState<CustomerOrganization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCachedCustomerSession();
    if (cached.org) setOrg(cached.org);

    Promise.all([
      customerApi.getVessels().catch(() => []),
      customerApi.getArrivalRequests().catch(() => []),
      customerApi.getOrganization().catch(() => null),
    ])
      .then(([vList, rList, oData]) => {
        setVessels(vList);
        setRequests(rList);
        if (oData) setOrg(oData);
      })
      .finally(() => setLoading(false));
  }, []);

  const pendingRequests = requests.filter(
    (r) =>
      r.status === "PENDING_MANAGER_REVIEW" ||
      r.status === "SUBMITTED" ||
      r.status === "FEASIBILITY_CHECK" ||
      r.status === "VALIDATING"
  );
  const approvedRequests = requests.filter((r) => r.status === "APPROVED");
  const alternativeProposals = requests.filter(
    (r) => r.status === "ALTERNATIVE_PROPOSED" || r.status === "CUSTOMER_RESPONSE_REQUIRED"
  );

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
            Declined
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

  return (
    <CustomerShell
      title="Customer Operations Dashboard"
      subtitle="Fleet status, active vessel arrival requests, and port schedule negotiations."
      actions={
        <Link
          href="/customer/arrival-requests/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white font-bold text-xs shadow-lg shadow-[#009688]/25 transition-all hover:scale-105"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Arrival Request</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* ── Organization Welcome Banner ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0E2E44] via-[#0A2438] to-[#071926] border border-[#174666] p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#009688]/20 border border-[#009688]/40 text-[#2DD4BF] text-xs font-semibold">
                <Building2 className="h-3.5 w-3.5" />
                <span>Verified Shipping Organization</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {org?.name || "ABC Shipping Pvt. Ltd."}
              </h2>
              <p className="text-xs sm:text-sm text-[#8CB4D2] max-w-xl leading-relaxed">
                Coordinating berthing schedules and operational turnaround with NaviOps Port Authority.
                All requests pass automated feasibility analysis before final Operation Manager review.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/customer/vessels"
                className="px-4 py-2.5 rounded-xl bg-[#0F3550] hover:bg-[#16476B] text-white text-xs font-bold border border-[#1E5279] transition-all flex items-center gap-2"
              >
                <Ship className="h-4 w-4 text-[#38BDF8]" />
                <span>Manage Fleet</span>
              </Link>
              <Link
                href="/customer/arrival-requests/new"
                className="px-4 py-2.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white text-xs font-bold shadow-lg shadow-[#009688]/30 transition-all flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Submit Request</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── KPI Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/customer/vessels"
            className="rounded-2xl bg-[#091E2C] border border-[#13344A] p-5 hover:border-[#009688]/60 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between text-[#7EA6C7] mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">My Vessels</span>
              <div className="p-2 rounded-xl bg-[#0F324A] text-[#38BDF8] group-hover:scale-110 transition-transform">
                <Ship className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {loading ? "..." : vessels.length}
            </div>
            <p className="text-[11px] text-[#6D94B5] mt-1">Registered in company fleet</p>
          </Link>

          <Link
            href="/customer/arrival-requests"
            className="rounded-2xl bg-[#091E2C] border border-[#13344A] p-5 hover:border-[#FBBF24]/60 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between text-[#7EA6C7] mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Requests</span>
              <div className="p-2 rounded-xl bg-[#3D2C0C] text-[#FBBF24] group-hover:scale-110 transition-transform">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {loading ? "..." : pendingRequests.length}
            </div>
            <p className="text-[11px] text-[#6D94B5] mt-1">Under port manager review</p>
          </Link>

          <Link
            href="/customer/proposals"
            className="rounded-2xl bg-[#091E2C] border border-[#13344A] p-5 hover:border-[#38BDF8]/60 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between text-[#7EA6C7] mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Alternative Proposals</span>
              <div className="p-2 rounded-xl bg-[#0C2E47] text-[#38BDF8] group-hover:scale-110 transition-transform">
                <GitPullRequest className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {loading ? "..." : alternativeProposals.length}
            </div>
            <p className="text-[11px] text-[#6D94B5] mt-1">Port proposed new arrival slot</p>
          </Link>

          <Link
            href="/customer/arrival-requests"
            className="rounded-2xl bg-[#091E2C] border border-[#13344A] p-5 hover:border-[#34D399]/60 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between text-[#7EA6C7] mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Approved Requests</span>
              <div className="p-2 rounded-xl bg-[#093526] text-[#34D399] group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {loading ? "..." : approvedRequests.length}
            </div>
            <p className="text-[11px] text-[#6D94B5] mt-1">Confirmed in live port schedule</p>
          </Link>
        </div>

        {/* ── Active Alternative Action Banner (if any) ── */}
        {alternativeProposals.length > 0 && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0C324D] to-[#082030] border border-[#0284C7]/50 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#0284C7]/30 text-[#38BDF8] mt-0.5">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Alternative Arrival Proposed for {alternativeProposals[0].vessel_name} ({alternativeProposals[0].request_code})
                </h3>
                <p className="text-xs text-[#90B7D6] mt-0.5">
                  The Port Authority has evaluated your request and proposed an optimal alternative berthing slot.
                </p>
              </div>
            </div>
            <Link
              href={`/customer/arrival-requests/${alternativeProposals[0].id}`}
              className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold shrink-0 flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <span>Review Proposal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Recent Arrival Requests Table ── */}
        <div className="rounded-3xl bg-[#091E2C]/90 border border-[#13344A] p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#13344A] mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Active Arrival Requests</h3>
              <p className="text-xs text-[#7BA1BF] mt-0.5">
                Track real-time evaluation status and Operation Manager decisions.
              </p>
            </div>
            <Link
              href="/customer/arrival-requests"
              className="text-xs font-bold text-[#38BDF8] hover:text-[#7DD3FC] flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#6D94B5] uppercase tracking-wider font-bold border-b border-[#13344A]">
                  <th className="py-3 px-3">Request Code</th>
                  <th className="py-3 px-3">Vessel</th>
                  <th className="py-3 px-3">Requested ETA</th>
                  <th className="py-3 px-3">Cargo</th>
                  <th className="py-3 px-3">Feasibility</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#13344A]/60">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#6D94B5]">
                      No arrival requests submitted yet. Click "New Arrival Request" to get started.
                    </td>
                  </tr>
                ) : (
                  requests.slice(0, 5).map((req) => (
                    <tr key={req.id} className="hover:bg-[#0E2E44]/50 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-white">
                        {req.request_code}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-white">{req.vessel_name}</div>
                        <div className="text-[10px] text-[#6D94B5]">
                          {req.vessel_imo || "IMO Verified"} &bull; {req.vessel_loa || 320}m
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-[#A5C7E2]">
                        <div className="font-medium">
                          {new Date(req.requested_eta).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-[10px] text-[#6D94B5]">
                          {new Date(req.requested_eta).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          UTC
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-medium text-white">{req.cargo_type}</span>
                        <div className="text-[10px] text-[#6D94B5]">
                          {req.cargo_quantity.toLocaleString()} units
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
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
                      <td className="py-3.5 px-3">{getStatusBadge(req.status)}</td>
                      <td className="py-3.5 px-3 text-right">
                        <Link
                          href={`/customer/arrival-requests/${req.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#38BDF8] hover:text-white px-2.5 py-1 rounded-lg bg-[#0E3550] hover:bg-[#14476B] transition-all"
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

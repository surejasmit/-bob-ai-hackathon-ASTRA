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
  ChevronRight,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi, getCachedCustomerSession } from "@/lib/customer-api";
import {
  CustomerVessel,
  ArrivalRequest,
  CustomerOrganization,
} from "@/types/customer";
import { Badge } from "@/components/design-system/badge";
import { Button } from "@/components/design-system/button";

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

  return (
    <CustomerShell
      title="Customer Operations Dashboard"
      subtitle="Fleet status, active vessel arrival requests, and port schedule negotiations."
      actions={
        <Link href="/customer/arrival-requests/new">
          <Button variant="primary" size="sm" leftIcon={<PlusCircle className="h-3.5 w-3.5" />}>
            New Arrival Request
          </Button>
        </Link>
      }
    >
      <div className="space-y-5">
        {/* ── Organization Welcome Card ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-6 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#E1EFEC] border border-[#C5DDD9] text-[#004741] text-xs font-semibold">
                <Building2 className="h-3.5 w-3.5" />
                <span>Verified Carrier Organization</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102A27]">
                {org?.name || "ABC Shipping Pvt. Ltd."}
              </h2>
              <p className="text-xs sm:text-sm text-[#5C6B68] max-w-2xl leading-relaxed">
                Coordinating berthing schedules and operational turnaround with NaviOps Port Authority.
                All arrival requests pass automated feasibility analysis before final Operation Manager review.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/customer/vessels">
                <Button variant="secondary" size="sm" leftIcon={<Ship className="h-3.5 w-3.5" />}>
                  Manage Fleet
                </Button>
              </Link>
              <Link href="/customer/arrival-requests/new">
                <Button variant="primary" size="sm" leftIcon={<PlusCircle className="h-3.5 w-3.5" />}>
                  Submit Request
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Summary KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Registered Vessels */}
          <Link
            href="/customer/vessels"
            className="rounded-xl border border-[#E3E5E0] bg-white p-4 shadow-card border-l-4 border-l-[#2F7D8C] hover:shadow-card-hover transition-shadow block"
          >
            <div className="flex items-center justify-between text-xs text-[#5C6B68]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">My Vessels</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1F0F2] text-[#2F7D8C]">
                <Ship className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#102A27]">
                {loading ? "..." : vessels.length}
              </span>
              <span className="text-xs text-[#5C6B68]">registered in fleet</span>
            </div>
          </Link>

          {/* Pending Decision */}
          <Link
            href="/customer/arrival-requests"
            className="rounded-xl border border-[#E3E5E0] bg-white p-4 shadow-card border-l-4 border-l-[#004741] hover:shadow-card-hover transition-shadow block"
          >
            <div className="flex items-center justify-between text-xs text-[#5C6B68]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Pending Review</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1EFEC] text-[#004741]">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#004741]">
                {loading ? "..." : pendingRequests.length}
              </span>
              <span className="text-xs text-[#5C6B68]">under port evaluation</span>
            </div>
          </Link>

          {/* Alternative Proposed */}
          <Link
            href="/customer/proposals"
            className="rounded-xl border border-[#E3E5E0] bg-white p-4 shadow-card border-l-4 border-l-[#C58A2B] hover:shadow-card-hover transition-shadow block"
          >
            <div className="flex items-center justify-between text-xs text-[#5C6B68]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Alternative Proposed</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF4DE] text-[#C58A2B]">
                <GitPullRequest className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#C58A2B]">
                {loading ? "..." : alternativeProposals.length}
              </span>
              <span className="text-xs text-[#5C6B68]">response required</span>
            </div>
          </Link>

          {/* Approved & Scheduled */}
          <Link
            href="/customer/arrival-requests"
            className="rounded-xl border border-[#E3E5E0] bg-white p-4 shadow-card border-l-4 border-l-[#2F7D5B] hover:shadow-card-hover transition-shadow block"
          >
            <div className="flex items-center justify-between text-xs text-[#5C6B68]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Approved & Scheduled</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5F2EA] text-[#2F7D5B]">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#2F7D5B]">
                {loading ? "..." : approvedRequests.length}
              </span>
              <span className="text-xs text-[#5C6B68]">committed to quayside</span>
            </div>
          </Link>
        </div>

        {/* ── Active Alternative Proposal Alert (if any) ── */}
        {alternativeProposals.length > 0 && (
          <div className="rounded-xl border border-[#F0D49A] bg-[#FFF4DE] p-4 text-[#C58A2B] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white/80 text-[#C58A2B] mt-0.5">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#102A27]">
                  Alternative Schedule Proposed for {alternativeProposals[0].vessel_name} ({alternativeProposals[0].request_code})
                </h3>
                <p className="text-xs text-[#5C6B68] mt-0.5">
                  The Operation Manager has evaluated your request and proposed an adjusted arrival window.
                </p>
              </div>
            </div>
            <Link href={`/customer/arrival-requests/${alternativeProposals[0].id}`}>
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Review Proposal
              </Button>
            </Link>
          </div>
        )}

        {/* ── Recent Arrival Requests Table ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#E3E5E0] bg-[#F7F9F8]">
            <div>
              <h3 className="text-sm font-semibold text-[#102A27]">Recent Arrival Requests</h3>
              <p className="text-[11px] text-[#5C6B68] mt-0.5">
                Track real-time evaluation status, solver recommendations, and operational decisions.
              </p>
            </div>
            <Link
              href="/customer/arrival-requests"
              className="text-xs font-semibold text-[#004741] hover:underline inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E5E0] bg-[#F7F9F8] text-[11px] font-semibold uppercase tracking-wider text-[#5C6B68]">
                  <th className="px-4 py-3">Request Code</th>
                  <th className="px-4 py-3">Vessel</th>
                  <th className="px-4 py-3">Requested ETA</th>
                  <th className="px-4 py-3">Cargo Spec</th>
                  <th className="px-4 py-3">Feasibility</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E0] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[#5C6B68]">
                      Loading arrival requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[#5C6B68]">
                      No arrival requests submitted yet. Click "New Arrival Request" to get started.
                    </td>
                  </tr>
                ) : (
                  requests.slice(0, 6).map((req) => (
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
                          {req.vessel_imo || "IMO Verified"} &bull; {req.vessel_loa || 300}m LOA
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
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#102A27]">{req.cargo_type}</span>
                        <div className="text-[10px] text-[#899491]">
                          {req.cargo_quantity.toLocaleString()} units
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {req.feasibility_status === "PASS" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#E5F2EA] px-2 py-0.5 text-[11px] font-semibold text-[#2F7D5B]">
                            <CheckCircle2 className="h-3 w-3" /> Feasible
                          </span>
                        ) : req.feasibility_status === "FAIL" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#FCE9E8] px-2 py-0.5 text-[11px] font-semibold text-[#B94A48]">
                            <AlertTriangle className="h-3 w-3" /> Incompatible
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

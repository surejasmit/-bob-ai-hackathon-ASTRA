"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Ship,
  Calendar,
  Anchor,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { ArrivalRequest } from "@/types/customer";

export default function CustomerProposalsPage() {
  const [requests, setRequests] = useState<ArrivalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerApi
      .getArrivalRequests()
      .then((list) => {
        // Filter requests that have had alternative proposals
        const withProposals = list.filter((r) => r.active_proposal != null);
        setRequests(withProposals);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <CustomerShell
      title="Alternative Arrival Proposals"
      subtitle="Review alternative berthing slots recommended by the NaviOps Operation Manager."
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="py-16 text-center text-[#6D94B5]">Loading proposals...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#091E2C] border border-[#13344A] text-[#6D94B5]">
            <GitPullRequest className="h-10 w-10 mx-auto mb-3 text-[#234A66]" />
            <p className="font-bold text-sm text-white">No Alternative Proposals Pending</p>
            <p className="text-xs mt-1">
              When Port Operations suggests an adjusted arrival slot for your vessel, it will appear here.
            </p>
          </div>
        ) : (
          requests.map((req) => {
            const prop = req.active_proposal!;
            const isPending = prop.customer_response === "PENDING";
            return (
              <div
                key={req.id}
                className={`rounded-3xl bg-[#091E2C] border p-6 sm:p-7 shadow-xl space-y-4 transition-all ${
                  isPending
                    ? "border-[#0284C7] bg-gradient-to-br from-[#0C324D] to-[#071926]"
                    : "border-[#13344A]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#13344A]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0E3550] text-[#38BDF8]">
                      <Ship className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">
                        {req.vessel_name} ({req.request_code})
                      </h3>
                      <p className="text-xs text-[#7BA1BF]">
                        Route: {req.origin} &rarr; {req.destination} &bull; {req.cargo_quantity} {req.cargo_type}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full w-fit ${
                      prop.customer_response === "ACCEPTED"
                        ? "bg-[#059669]/20 text-[#34D399] border border-[#059669]/30"
                        : prop.customer_response === "DECLINED"
                        ? "bg-[#DC2626]/20 text-[#F87171] border border-[#DC2626]/30"
                        : "bg-[#0284C7]/20 text-[#38BDF8] border border-[#0284C7]/40 animate-pulse"
                    }`}
                  >
                    {prop.customer_response === "PENDING"
                      ? "Action Required"
                      : `Response: ${prop.customer_response}`}
                  </span>
                </div>

                {/* Comparison Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#061520] border border-[#13344A]">
                    <span className="text-[10px] font-bold uppercase text-[#6D94B5] block mb-1">
                      Original Requested Slot
                    </span>
                    <div className="text-sm font-bold text-white">
                      {new Date(req.requested_eta).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      UTC
                    </div>
                    <div className="text-xs text-[#8AB1D1] mt-1">
                      Preferred Berth: {req.preferred_berth_code || "Any Available"}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0A2F4A] border border-[#0284C7]/50">
                    <span className="text-[10px] font-bold uppercase text-[#38BDF8] block mb-1">
                      Port Proposed Slot
                    </span>
                    <div className="text-sm font-bold text-[#34D399]">
                      {new Date(prop.proposed_eta).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      UTC
                    </div>
                    <div className="text-xs text-white mt-1">
                      Allocated Berth: <strong>{prop.proposed_berth_code || "Quayside Berth"}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#061520] text-xs text-[#9AC2E2]">
                  <strong className="text-white">Port Authority Operational Reason: </strong>
                  {prop.operational_reason}
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <Link
                    href={`/customer/arrival-requests/${req.id}`}
                    className="inline-flex items-center gap-2 text-xs font-bold text-white bg-[#009688] hover:bg-[#007F73] px-4 py-2.5 rounded-xl shadow-md transition-all"
                  >
                    <span>Open Tracking &amp; Respond</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </CustomerShell>
  );
}

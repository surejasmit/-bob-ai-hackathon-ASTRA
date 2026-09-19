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
  SlidersHorizontal,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { ArrivalRequest } from "@/types/customer";
import { Button } from "@/components/design-system/button";
import { Badge } from "@/components/design-system/badge";
import { cn } from "@/lib/utils";

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
      subtitle="Review alternative berthing slots recommended by the NaviOps Operation Manager to optimize port turnarounds."
    >
      <div className="space-y-5 max-w-5xl mx-auto">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#5C6B68]">
            Loading proposals...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-[#D5DCDA] bg-white text-[#5C6B68]">
            <GitPullRequest className="h-10 w-10 mx-auto mb-2 text-[#899491]" />
            <p className="font-semibold text-sm text-[#102A27]">No Alternative Proposals Pending</p>
            <p className="text-xs text-[#899491] mt-1">
              When Port Operations suggests an adjusted arrival slot for your vessel, it will appear here for review.
            </p>
          </div>
        ) : (
          requests.map((req) => {
            const prop = req.active_proposal!;
            const isPending = prop.customer_response === "PENDING";
            return (
              <div
                key={req.id}
                className={cn(
                  "rounded-xl border bg-white p-5 sm:p-6 shadow-card space-y-4 transition-all",
                  isPending ? "border-[#F0D49A] border-l-4 border-l-[#C58A2B]" : "border-[#E3E5E0]"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0EDE4]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E1F0F2] text-[#2F7D8C]">
                      <Ship className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#102A27] text-sm">
                        {req.vessel_name} ({req.request_code})
                      </h3>
                      <p className="text-[11px] text-[#5C6B68]">
                        Route: {req.origin} &rarr; {req.destination} &bull; {req.cargo_quantity.toLocaleString()} {req.cargo_type}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="status"
                    status={
                      prop.customer_response === "PENDING"
                        ? "ALTERNATIVE_PROPOSED"
                        : prop.customer_response === "ACCEPTED"
                        ? "APPROVED"
                        : "REJECTED"
                    }
                  />
                </div>

                {/* Comparison Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#F7F6F2] border border-[#E3E5E0]">
                    <span className="text-[10px] font-bold uppercase text-[#899491] block mb-1">
                      Original Requested Slot
                    </span>
                    <div className="text-sm font-bold text-[#102A27]">
                      {new Date(req.requested_eta).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      UTC
                    </div>
                    <div className="text-xs text-[#5C6B68] mt-0.5">
                      Preferred Berth: {req.preferred_berth_code || "Any Available"}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-white border-2 border-[#004741]">
                    <span className="text-[10px] font-bold uppercase text-[#004741] block mb-1">
                      Port Proposed Slot
                    </span>
                    <div className="text-sm font-bold text-[#004741]">
                      {new Date(prop.proposed_eta).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      UTC
                    </div>
                    <div className="text-xs text-[#102A27] mt-0.5">
                      Allocated Berth: <strong>{prop.proposed_berth_code || "Quayside Berth"}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0] text-xs text-[#5C6B68]">
                  <strong className="text-[#102A27]">Port Authority Operational Reason: </strong>
                  {prop.operational_reason}
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <Link href={`/customer/arrival-requests/${req.id}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                    >
                      Open Tracking &amp; Respond
                    </Button>
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

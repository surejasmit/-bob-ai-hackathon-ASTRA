import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NaviOps Customer Portal — Vessel Arrival Requests & Fleet Coordination",
  description:
    "External shipping line portal for submitting vessel arrival requests, tracking feasibility & CP-SAT optimization evaluations, and coordinating berthing approvals.",
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

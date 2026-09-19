"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { DashboardSummary, Berth, Vessel, SentinelAlertResponse, OptimizationRun } from "@/types";
import { formatDuration, getCongestionMeta, getResourceUtilizationMeta } from "@/lib/utils";
import {
  Ship,
  Anchor,
  Cpu,
  Boxes,
  AlertTriangle,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Leaf,
  Radio,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalSelector } from "@/components/landing/portal-selector";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [sentinel, setSentinel] = useState<SentinelAlertResponse | null>(null);
  const [latestRun, setLatestRun] = useState<OptimizationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // Dual Domain Access & Portal Selector State
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [hasPortToken, setHasPortToken] = useState(false);
  const [hasCustomerToken, setHasCustomerToken] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [sumData, vesselsData, sentinelData, runData] = await Promise.all([
        api.getDashboardSummary(),
        api.getVessels(),
        api.getDisruptionSentinel().catch(() => null),
        api.getLatestOptimizationRun().catch(() => null),
      ]);
      setSummary(sumData);
      setVessels(vesselsData);
      if (sentinelData) setSentinel(sentinelData);
      if (runData) setLatestRun(runData);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const portToken = localStorage.getItem("naviops_token");
      const customerToken = localStorage.getItem("naviops_customer_token");
      const querySelect = window.location.search.includes("select=1");

      setHasPortToken(Boolean(portToken));
      setHasCustomerToken(Boolean(customerToken));

      if (querySelect || !portToken) {
        setShowSelector(true);
        setLoading(false);
        setIsAuthChecking(false);
        return;
      }

      setIsAuthChecking(false);
      loadData();
      const interval = setInterval(loadData, 30_000);
      return () => clearInterval(interval);
    }
  }, []);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-xs text-[#5C6B68]">
          <div className="h-6 w-6 border-2 border-[#004741] border-t-transparent rounded-full animate-spin" />
          <span>Connecting to NaviOps Maritime OS...</span>
        </div>
      </div>
    );
  }

  // If user has not signed in as Port Worker, or explicitly chose the workspace selector:
  if (!hasPortToken || showSelector) {
    return (
      <PortalSelector
        hasPortSession={hasPortToken}
        hasCustomerSession={hasCustomerToken}
        onEnterPortDashboard={() => {
          setShowSelector(false);
          loadData();
        }}
      />
    );
  }

  const congestion = summary?.congestion;
  const metrics = summary?.metrics;

  interface AttentionItem {
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  }

  const attentionItems: AttentionItem[] = [];

  if (summary?.active_disruptions && summary.active_disruptions.length > 0) {
    summary.active_disruptions.forEach((d) => {
      attentionItems.push({
        id: `disruption-${d.id}`,
        severity: d.severity === "Critical" ? "critical" : "warning",
        title: d.title,
        description: d.description || "Operational disruption reported.",
        actionLabel: "View Disruption",
        actionHref: "/disruptions",
      });
    });
  }

  if ((summary?.failed_cranes || 0) > 0) {
    attentionItems.push({
      id: "crane-outage",
      severity: "critical",
      title: `${summary?.failed_cranes} STS Crane Offline`,
      description: "Crane outage reduces handling rate at assigned berths. Optimization required.",
      actionLabel: "Inspect Cranes",
      actionHref: "/cranes",
    });
  }

  const delayedVessels = vessels.filter(
    (v) => (v.status === "Waiting" && v.expected_waiting_time >= 3) || v.status === "Delayed"
  );
  delayedVessels.forEach((v) => {
    attentionItems.push({
      id: `vessel-wait-${v.id}`,
      severity: "warning",
      title: `${v.vessel_name} Waiting > ${formatDuration(v.expected_waiting_time)}`,
      description: `Inbound ${v.shipping_line} vessel awaiting berth allocation in anchorage queue.`,
      actionLabel: "Assign Berth",
      actionHref: "/operations",
    });
  });

  if ((metrics?.yard_utilization_rate || 0) >= 80) {
    attentionItems.push({
      id: "yard-pressure",
      severity: (metrics?.yard_utilization_rate || 0) >= 90 ? "critical" : "warning",
      title: `High Yard Capacity Pressure (${metrics?.yard_utilization_rate}%)`,
      description: `${(summary?.total_occupied_yard || 0).toLocaleString()} TEU in container buffer zones.`,
      actionLabel: "Inspect Yards",
      actionHref: "/yards",
    });
  }

  // Congestion score semantic metadata (strict 5-tier dynamic system)
  const congestionMeta = getCongestionMeta(congestion?.score ?? 0);

  // Resource utilization semantic helpers
  const waitingCount = metrics?.waiting_at_anchorage ?? 0;
  const waitingColor =
    waitingCount >= 7
      ? { border: "border-l-[#B94A48]", iconBg: "bg-[#FCE9E8]", iconColor: "text-[#B94A48]", text: "text-[#B94A48]" }
      : waitingCount >= 4
      ? { border: "border-l-[#C58A2B]", iconBg: "bg-[#FFF4DE]", iconColor: "text-[#C58A2B]", text: "text-[#C58A2B]" }
      : waitingCount >= 1
      ? { border: "border-l-[#2F7D8C]", iconBg: "bg-[#E1F0F2]", iconColor: "text-[#2F7D8C]", text: "text-[#2F7D8C]" }
      : { border: "border-l-[#2F7D5B]", iconBg: "bg-[#E5F2EA]", iconColor: "text-[#2F7D5B]", text: "text-[#2F7D5B]" };

  const berthUtilMeta = getResourceUtilizationMeta(metrics?.berth_utilization_rate ?? 0);
  const craneUtilMeta = getResourceUtilizationMeta(metrics?.crane_utilization_rate ?? 0);
  const yardUtilMeta = getResourceUtilizationMeta(metrics?.yard_utilization_rate ?? 0);

  return (
    <AppShell
      title="Port Operations Dashboard"
      description="Monitor real-time congestion, identify operational bottlenecks, and take targeted action."
      congestionScore={congestion?.score ?? 0}
      congestionLevel={congestionMeta.label}
      onRefresh={loadData}
      isRefreshing={refreshing}
    >
      {/* Proactive Disruption Sentinel Alert Banner */}
      {sentinel && sentinel.has_threat && (
        <div className="rounded-xl border border-[#F2C4C3] bg-gradient-to-r from-[#FCE9E8]/90 via-white/80 to-[#FFF4DE]/90 backdrop-blur-md p-4 shadow-md animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#B94A48] text-white shadow-sm">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#B94A48]">
                    Proactive Disruption Sentinel Active
                  </span>
                  <span className="rounded-full bg-[#B94A48]/10 px-2 py-0.5 text-[10px] font-semibold text-[#B94A48]">
                    {sentinel.active_alerts.length} Incident{sentinel.active_alerts.length > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#102A27] mt-0.5">
                  Estimated Demurrage Exposure:{" "}
                  <span className="font-bold text-[#B94A48] font-mono">
                    ${sentinel.total_risk_exposure_usd.toLocaleString()}
                  </span>{" "}
                  across {sentinel.total_at_risk_vessels} at-risk vessels.
                </p>
                <p className="text-[11px] text-[#5C6B68] mt-1 line-clamp-1">
                  {sentinel.recommended_action}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/copilot"
                className="rounded-lg border border-[#D5DCDA] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#102A27] hover:bg-white transition-colors"
              >
                Ask Copilot
              </Link>
              <Link
                href="/optimization"
                className="flex items-center gap-1.5 rounded-lg bg-[#102A27] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1B3835] shadow-sm transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-[#E0A75E]" />
                1-Click Mitigation
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 1. Primary Congestion Hero Banner */}
      <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Score badge */}
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-bold text-white shadow-sm transition-colors",
                congestionMeta.cardBgClass
              )}
            >
              <span className="text-xl leading-none">{congestion?.score ?? 0}</span>
              <span className="text-[10px] font-medium opacity-80">/ 100</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold uppercase tracking-wider", congestionMeta.textColor)}>
                  {congestionMeta.label} Congestion
                </span>
                <span className="text-[#D5D9D3]">·</span>
                <span className="text-xs text-[#5C6B68]">Port Index Status</span>
              </div>
              <h2 className="text-base font-semibold text-[#102A27] mt-0.5">
                {congestion?.explanation || congestionMeta.summary}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white/90 backdrop-blur-xs px-2.5 py-2 text-xs font-medium text-[#5C6B68] hover:bg-white hover:text-[#102A27] transition-colors shadow-2xs"
              title="Return to the portal selection screen"
            >
              <span>Switch Workspace</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/80 backdrop-blur-sm px-3 py-2 text-xs font-medium text-[#5C6B68] hover:bg-white hover:text-[#004741] transition-colors shadow-sm"
            >
              <span>{showFormulaDetails ? "Hide Calculation" : "View Calculation Details"}</span>
              {showFormulaDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            <Link href="/port-twin">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-500/20 transition-colors shadow-sm"
              >
                <Radio className="h-3.5 w-3.5 text-cyan-700" />
                <span>Port Twin</span>
              </button>
            </Link>

            <Link href="/optimization">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#004741] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#003B36] transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Run 72h Optimization</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Expandable Calculation Details */}
        {showFormulaDetails && (
          <div className="mt-4 border-t border-[#F0EDE4] pt-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#102A27]">
                Congestion Factor Breakdown & Mathematical Weights
              </span>
              <span className="text-[11px] text-[#899491]">
                Dynamic rule-based evaluation (0–100 scale)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {congestion?.factors && congestion.factors.length > 0 ? (
                congestion.factors.map((f, idx) => {
                  let friendlyName = f.name;
                  if (f.name.includes("Anchorage Queue")) friendlyName = "Vessels Waiting";
                  else if (f.name.includes("Berth Saturation")) friendlyName = "Berth Utilization";
                  else if (f.name.includes("Crane Fleet")) friendlyName = "Crane Utilization";
                  else if (f.name.includes("Yard Capacity")) friendlyName = "Yard Capacity Pressure";
                  else if (f.name.includes("Average Delay")) friendlyName = "Average Waiting Time";
                  else if (f.name.includes("Active Disruption")) friendlyName = "Disruption Impact";

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-white/80 bg-white/75 backdrop-blur-sm p-2.5 text-xs shadow-sm"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-[#102A27]">{friendlyName}</span>
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            f.score_contribution >= 15
                              ? "text-[#B94A48]"
                              : f.score_contribution >= 8
                              ? "text-[#C25E00]"
                              : f.score_contribution >= 4
                              ? "text-[#C58A2B]"
                              : "text-[#2F7D8C]"
                          )}
                        >
                          +{f.score_contribution} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5C6B68] mt-1 line-clamp-1">
                        {f.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-[#899491] border-t border-[#E3E5E0] pt-1">
                        <span>Weight: {f.weight > 0 ? `${(f.weight * 100).toFixed(0)}%` : "Additive"}</span>
                        <span>Raw: {f.raw_value}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-2 text-center text-xs text-[#899491] italic">
                  Telemetry factor details loading...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Four Frosted Glass KPI Cards with Semantic Accents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vessels Waiting */}
        <div className={cn("rounded-xl border border-white/80 bg-white/60 backdrop-blur-md p-4 shadow-card hover:shadow-card-hover transition-all border-l-4", waitingColor.border)}>
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-medium uppercase tracking-wider text-[10px]">Vessels Waiting</span>
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shadow-sm", waitingColor.iconBg)}>
              <Ship className={cn("h-3.5 w-3.5", waitingColor.iconColor)} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]", waitingColor.text)}>
              {metrics?.waiting_at_anchorage ?? "—"}
            </span>
            <span className="text-xs text-[#5C6B68] font-medium">in queue</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#5C6B68] border-t border-[#F0EDE4] pt-2">
            <span>Avg wait: {congestion?.avg_waiting_time_hours || 0}h</span>
            <span className="text-[#899491]">{metrics?.active_vessels_total || 0} total</span>
          </div>
        </div>

        {/* Berth Utilization */}
        <div className={cn("rounded-xl border border-white/80 bg-white/60 backdrop-blur-md p-4 shadow-card hover:shadow-card-hover transition-all border-l-4", berthUtilMeta.borderClass)}>
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-medium uppercase tracking-wider text-[10px]">Berth Utilization</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1F0F2]/90 shadow-sm">
              <Anchor className="h-3.5 w-3.5 text-[#2F7D8C]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]", berthUtilMeta.textClass)}>
              {metrics?.berth_utilization_rate ?? "—"}%
            </span>
            <span className="text-xs text-[#5C6B68] font-medium">occupied</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#5C6B68] border-t border-[#F0EDE4] pt-2">
            <span>{summary?.available_berths ?? 0} berths available</span>
            <span className="text-[#899491]">{summary?.total_berths ?? 0} total</span>
          </div>
        </div>

        {/* Crane Availability */}
        <div className={cn("rounded-xl border border-white/80 bg-white/60 backdrop-blur-md p-4 shadow-card hover:shadow-card-hover transition-all border-l-4", (summary?.failed_cranes || 0) > 0 ? "border-l-[#B94A48]" : craneUtilMeta.borderClass)}>
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-medium uppercase tracking-wider text-[10px]">Crane Availability</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF4DE]/90 shadow-sm">
              <Cpu className="h-3.5 w-3.5 text-[#C58A2B]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]", (summary?.failed_cranes || 0) > 0 ? "text-[#B94A48]" : craneUtilMeta.textClass)}>
              {metrics?.crane_utilization_rate ?? "—"}%
            </span>
            <span className="text-xs text-[#5C6B68] font-medium">active</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#5C6B68] border-t border-[#F0EDE4] pt-2">
            <span className={(summary?.failed_cranes || 0) > 0 ? "text-[#B94A48] font-semibold" : ""}>
              {summary?.failed_cranes ?? 0} offline
            </span>
            <span className="text-[#899491]">{summary?.total_cranes ?? 0} STS cranes</span>
          </div>
        </div>

        {/* Yard Capacity */}
        <div className={cn("rounded-xl border border-white/80 bg-white/60 backdrop-blur-md p-4 shadow-card hover:shadow-card-hover transition-all border-l-4", yardUtilMeta.borderClass)}>
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <span className="font-medium uppercase tracking-wider text-[10px]">Yard Capacity</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5F2EA]/90 shadow-sm">
              <Boxes className="h-3.5 w-3.5 text-[#2F7D5B]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]", yardUtilMeta.textClass)}>
              {metrics?.yard_utilization_rate ?? "—"}%
            </span>
            <span className="text-xs text-[#5C6B68] font-medium">utilized</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#5C6B68] border-t border-[#F0EDE4] pt-2 truncate">
            <span className="truncate">{(summary?.total_occupied_yard ?? 0).toLocaleString()} TEU</span>
            <span className="text-[#899491] shrink-0">/ {(summary?.total_yard_capacity ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 2b. GreenPort ESG & Demurrage Financial Ledger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Demurrage ROI Avoided */}
        <div className="rounded-xl border border-white/80 bg-gradient-to-r from-white/70 to-[#E5F2EA]/50 backdrop-blur-md p-4 shadow-card hover:shadow-card-hover transition-all border-l-4 border-l-[#2F7D5B]">
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-[#102A27]">
                Demurrage Financial Ledger
              </span>
              <span className="rounded bg-[#E5F2EA] px-1.5 py-0.5 text-[9px] font-bold text-[#2F7D5B]">
                ROI POSITIVE
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5F2EA] shadow-sm">
              <DollarSign className="h-4 w-4 text-[#2F7D5B]" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono text-[#2F7D5B] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
              +${(latestRun?.metrics?.demurrage_saved_usd ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-[#5C6B68]">avoided demurrage penalty</span>
          </div>
          <p className="mt-1 text-[11px] text-[#5C6B68]">
            Calculated against pre-optimization delay baseline using carrier fleet daily demurrage benchmarks.
          </p>
        </div>

        {/* GreenPort CO2 Abatement */}
        <div className="rounded-xl border border-white/80 bg-gradient-to-r from-white/70 to-[#E1F3F5]/50 backdrop-blur-md p-4 shadow-card hover:shadow-card-hover transition-all border-l-4 border-l-[#2F7D8C]">
          <div className="flex items-center justify-between text-xs text-[#5C6B68]">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-[#102A27]">
                GreenPort Decarbonization (ESG)
              </span>
              <span className="rounded bg-[#E1F3F5] px-1.5 py-0.5 text-[9px] font-bold text-[#2F7D8C]">
                IMO 2030 ALIGNED
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1F3F5] shadow-sm">
              <Leaf className="h-4 w-4 text-[#2F7D8C]" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono text-[#2F7D8C] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
              {(latestRun?.metrics?.co2_abated_mt ?? 0).toFixed(1)} MT CO₂
            </span>
            <span className="text-xs text-[#5C6B68]">emissions abated</span>
          </div>
          <p className="mt-1 text-[11px] text-[#5C6B68]">
            Estimated auxiliary engine fuel combustion prevented by reducing anchorage idle queuing time.
          </p>
        </div>
      </div>

      {/* 3. Operational Grid: Attention + Next Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Requires Attention */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4] mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF4DE]">
                <AlertCircle className="h-3.5 w-3.5 text-[#C58A2B]" />
              </div>
              <h3 className="text-sm font-semibold text-[#102A27]">
                Requires Attention ({attentionItems.length})
              </h3>
            </div>
            <span className="text-[11px] text-[#899491]">High priority</span>
          </div>

          {attentionItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5C6B68] flex flex-col items-center gap-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5F2EA] mb-1">
                <CheckCircle2 className="h-5 w-5 text-[#2F7D5B]" />
              </div>
              <span className="font-medium text-[#102A27]">All Clear</span>
              <span className="text-[#899491]">All quayside assets operating within normal parameters.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3 text-xs transition-colors",
                    item.severity === "critical"
                      ? "border-[#F2C4C3] bg-[#FCE9E8]"
                      : "border-[#F0D49A] bg-[#FFF4DE]"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          item.severity === "critical" ? "bg-[#B94A48]" : "bg-[#C58A2B]"
                        )}
                      />
                      <span className={cn(
                        "font-semibold",
                        item.severity === "critical" ? "text-[#B94A48]" : "text-[#C58A2B]"
                      )}>
                        {item.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#5C6B68] line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  <Link href={item.actionHref} className="shrink-0">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-[#E3E5E0] px-2.5 py-1 text-[11px] font-medium text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741] transition-colors shadow-sm"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Next Actions */}
        <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE4] mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1EFEC]">
                <Compass className="h-3.5 w-3.5 text-[#004741]" />
              </div>
              <h3 className="text-sm font-semibold text-[#102A27]">
                Recommended Next Actions
              </h3>
            </div>
            <span className="text-[11px] text-[#899491]">Operational playbook</span>
          </div>

          <div className="space-y-2.5">
            {/* Action 1 */}
            <div className="flex items-center justify-between rounded-lg border border-[#E1EFEC] bg-[#F7F9F8] p-3 hover:border-[#C5DDD9] hover:bg-[#E1EFEC] transition-colors group">
              <div>
                <div className="font-semibold text-xs text-[#102A27] group-hover:text-[#004741]">
                  Run 72-Hour Optimization
                </div>
                <p className="text-[11px] text-[#5C6B68] mt-0.5">
                  Execute Google OR-Tools CP-SAT solver to clear anchorage queue backlog.
                </p>
              </div>
              <Link href="/optimization">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#004741] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#003B36] transition-colors shrink-0"
                >
                  <span>Open Solver</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>

            {/* Action 2 */}
            <div className="flex items-center justify-between rounded-lg border border-[#E3E5E0] bg-white p-3 hover:bg-[#F7F6F2] transition-colors">
              <div>
                <div className="font-semibold text-xs text-[#102A27]">
                  Quayside Vessel Allocations
                </div>
                <p className="text-[11px] text-[#5C6B68] mt-0.5">
                  Assign berths to waiting vessels and update turnaround progress.
                </p>
              </div>
              <Link href="/operations">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E3E5E0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741] transition-colors shrink-0"
                >
                  <span>Operations</span>
                  <ArrowRight className="h-3 w-3 text-[#899491]" />
                </button>
              </Link>
            </div>

            {/* Action 3 */}
            <div className="flex items-center justify-between rounded-lg border border-[#E3E5E0] bg-white p-3 hover:bg-[#F7F6F2] transition-colors">
              <div>
                <div className="font-semibold text-xs text-[#102A27]">
                  Manage Incident Disruptions
                </div>
                <p className="text-[11px] text-[#5C6B68] mt-0.5">
                  Review crane outages, channel impediments, and adverse weather impact.
                </p>
              </div>
              <Link href="/disruptions">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E3E5E0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741] transition-colors shrink-0"
                >
                  <span>Incidents</span>
                  <ArrowRight className="h-3 w-3 text-[#899491]" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

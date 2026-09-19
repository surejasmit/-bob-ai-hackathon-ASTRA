"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ship,
  Anchor,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  Radio,
  Building2,
  Users,
  Lock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalSelectorProps {
  onEnterPortDashboard?: () => void;
  hasPortSession?: boolean;
  hasCustomerSession?: boolean;
}

export function PortalSelector({
  onEnterPortDashboard,
  hasPortSession = false,
  hasCustomerSession = false,
}: PortalSelectorProps) {
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState<"customer" | "port" | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF2F0] via-[#F4F7F6] to-[#E5EDE9] flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans">
      {/* Decorative background blurs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#004741]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#E0A75E]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation / Brand */}
      <header className="relative z-10 flex items-center justify-between max-w-6xl mx-auto w-full pb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#004741] text-white shadow-md">
            <Anchor className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-[#004741] leading-none">
                NaviOps
              </span>
              <span className="rounded bg-[#004741]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#004741] uppercase tracking-wider">
                Maritime OS
              </span>
            </div>
            <p className="text-[11px] text-[#5C6B68] font-medium mt-0.5">
              Intelligent Port & Vessel Operating System
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-[#5C6B68]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-xs px-3 py-1 border border-[#D5DCDA] shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#2F7D5B] animate-pulse" />
            Port Systems Operational
          </span>
        </div>
      </header>

      {/* Main Hero & Choice Section */}
      <main className="relative z-10 max-w-5xl mx-auto w-full my-auto py-6">
        {/* Hero Title */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E1EFEC] px-3 py-1 text-xs font-semibold text-[#004741] mb-3 shadow-2xs">
            <Lock className="h-3 w-3" />
            <span>Dual-Domain Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#102A27] tracking-tight">
            How are you accessing NaviOps?
          </h1>
          <p className="text-sm text-[#5C6B68] mt-2.5 leading-relaxed">
            Select your role to access your dedicated operational workspace. Domain boundaries and authentication credentials are strictly segregated.
          </p>
        </div>

        {/* The Two Distinct Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* 1. CUSTOMER CARD */}
          <div
            onMouseEnter={() => setHoveredCard("customer")}
            onMouseLeave={() => setHoveredCard(null)}
            className={cn(
              "group relative flex flex-col justify-between rounded-2xl border bg-white/85 backdrop-blur-md p-6 lg:p-8 shadow-card transition-all duration-300",
              hoveredCard === "customer"
                ? "border-[#004741] shadow-card-hover -translate-y-1"
                : "border-white/80 hover:border-[#C5DDD9]"
            )}
          >
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#004741] to-[#1B5E57] text-white shadow-md">
                  <Ship className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-[#E1EFEC] px-3 py-1 text-[11px] font-bold text-[#004741] uppercase tracking-wider">
                  Customer Portal
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-[#102A27] group-hover:text-[#004741] transition-colors">
                Customer
              </h2>
              <div className="text-xs font-medium text-[#004741] mt-0.5">
                Shipping Lines, Vessel Operators & Agents
              </div>

              <p className="text-xs text-[#5C6B68] mt-3 leading-relaxed">
                Submit and manage vessel arrival requests, track approvals, and coordinate with port operations.
              </p>

              {/* Feature Checklist */}
              <div className="mt-5 space-y-2 border-t border-[#F0EDE4] pt-4 text-xs text-[#102A27]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Submit vessel arrival requests with preferred windows</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Real-time physical feasibility & LOA verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Review and accept or decline alternative proposals</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Track lifecycle state from submission to confirmed berth</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 space-y-2.5">
              <Link href="/customer/auth" className="block w-full">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#004741] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#003B36] transition-all group-hover:shadow-md"
                >
                  <span>Enter Customer Portal</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
              <div className="text-center">
                <Link
                  href="/customer/auth?mode=register"
                  className="text-[11px] font-semibold text-[#004741] hover:underline"
                >
                  New shipping company? Register an account
                </Link>
              </div>
            </div>
          </div>

          {/* 2. PORT WORKER CARD */}
          <div
            onMouseEnter={() => setHoveredCard("port")}
            onMouseLeave={() => setHoveredCard(null)}
            className={cn(
              "group relative flex flex-col justify-between rounded-2xl border bg-white/85 backdrop-blur-md p-6 lg:p-8 shadow-card transition-all duration-300",
              hoveredCard === "port"
                ? "border-[#102A27] shadow-card-hover -translate-y-1"
                : "border-white/80 hover:border-[#C5DDD9]"
            )}
          >
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#102A27] to-[#1E3E3B] text-white shadow-md">
                  <Anchor className="h-6 w-6 text-[#E0A75E]" />
                </div>
                <span className="rounded-full bg-[#FFF4DE] px-3 py-1 text-[11px] font-bold text-[#C58A2B] uppercase tracking-wider">
                  Port Operations
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-[#102A27] group-hover:text-[#004741] transition-colors">
                Port Worker
              </h2>
              <div className="text-xs font-medium text-[#C58A2B] mt-0.5">
                Port Authorities, Planners & Terminal Managers
              </div>

              <p className="text-xs text-[#5C6B68] mt-3 leading-relaxed">
                Access port operations, vessel schedules, optimization, resources, disruptions, and operational management.
              </p>

              {/* Feature Checklist */}
              <div className="mt-5 space-y-2 border-t border-[#F0EDE4] pt-4 text-xs text-[#102A27]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Review inbound arrival requests & feasibility matrices</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Google OR-Tools CP-SAT 72h berth optimization</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>Propose alternative slots or approve requests into live schedule</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2F7D5B] shrink-0" />
                  <span>2.5D Digital Twin, Demurrage Ledger & Bob AI Copilot</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 space-y-2.5">
              {hasPortSession && onEnterPortDashboard ? (
                <button
                  type="button"
                  onClick={onEnterPortDashboard}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#102A27] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#1B3835] transition-all group-hover:shadow-md"
                >
                  <span>Resume Port Operations</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <Link href="/port/login" className="block w-full">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#102A27] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#1B3835] transition-all group-hover:shadow-md"
                  >
                    <span>Enter Port Operations</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
              )}
              <div className="text-center">
                <Link
                  href="/port/login"
                  className="text-[11px] font-semibold text-[#5C6B68] hover:text-[#102A27]"
                >
                  Authorized terminal staff & admin login
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Credentials Quick Assistance Bar */}
        <div className="mt-8 rounded-xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-sm text-xs text-[#5C6B68]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#E0A75E] shrink-0" />
              <span className="font-semibold text-[#102A27]">Demo Credentials:</span>
              <span>Customer: <strong className="text-[#004741]">john@abcshipping.com</strong> / <strong className="text-[#004741]">admin123</strong></span>
              <span className="hidden md:inline">&bull;</span>
              <span className="hidden md:inline">Port Staff: <strong className="text-[#102A27]">admin@naviops.port</strong> / <strong className="text-[#102A27]">admin123</strong></span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/customer/auth"
                className="text-[11px] font-semibold text-[#004741] hover:underline"
              >
                Customer Sign In &rarr;
              </Link>
              <span>|</span>
              <Link
                href="/port/login"
                className="text-[11px] font-semibold text-[#102A27] hover:underline"
              >
                Port Login &rarr;
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full pt-6 border-t border-[#D5DCDA]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#899491]">
        <span>NaviOps &bull; Advanced Maritime Intelligence & Vessel Flow Management</span>
        <span>Deterministic Feasibility &bull; Google OR-Tools CP-SAT &bull; IMO 2030 Aligned</span>
      </footer>
    </div>
  );
}

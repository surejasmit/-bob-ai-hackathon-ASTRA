"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Anchor, Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowLeft, ArrowRight, Ship } from "lucide-react";
import { Button } from "@/design-system/button";
import { api, setAuthToken } from "@/lib/api";
import { getRoleDashboard } from "@/lib/roles";

export default function PortLoginPage() {
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("naviops_token");
      const role = localStorage.getItem("naviops_role");
      if (token) {
        router.replace(getRoleDashboard(role));
      }
    }
  }, [router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim();
    const cleanPassword = loginPassword.trim();
    if (!cleanEmail || !cleanPassword) {
      setError("Please enter both email and password.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const normalizedEmail = cleanEmail.toLowerCase().endsWith("@naviops.com")
        ? cleanEmail.slice(0, -4) + ".port"
        : cleanEmail;

      const res = await api.login(normalizedEmail, cleanPassword);
      setAuthToken(res.token);
      localStorage.setItem("naviops_token", res.token);
      localStorage.setItem("naviops_role", res.user.role);
      localStorage.setItem("naviops_user", JSON.stringify(res.user));

      const destination = getRoleDashboard(res.user.role);
      window.location.href = destination;
    } catch (err: any) {
      const msg = err.message || "Invalid email or password.";
      setError(
        msg.includes("Invalid email or password")
          ? "Invalid email or password. Please check your credentials or contact your administrator."
          : msg
      );
      setIsLoading(false);
    }
  };

  const handlePreFill = (role: "admin" | "ops" | "executive") => {
    const map = {
      admin: { email: "admin@naviops.port", pass: "admin123" },
      ops: { email: "ops@naviops.port", pass: "admin123" },
      executive: { email: "executive@naviops.port", pass: "admin123" },
    };
    setLoginEmail(map[role].email);
    setLoginPassword(map[role].pass);
    setError(null);
  };

  const inputClass =
    "w-full rounded-xl border border-[#D5D9D3] bg-[#F7F8F6] px-4 py-3 pl-11 text-sm text-[#102A27] placeholder:text-[#899491] focus:bg-white focus:border-[#004741] focus:outline-none focus:ring-2 focus:ring-[#004741]/20 transition-all";

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between bg-[#071715]">
      {/* ── Ambient Maritime Depth Background & Subtle Grid ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(0, 114, 104, 0.35) 0%, rgba(10, 31, 29, 0.9) 55%, #05100F 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#004741]/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#2F7D8C]/15 blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <header className="relative z-10 px-6 sm:px-12 py-5 flex items-center justify-between border-b border-[#0E3531]/60 bg-[#071E1C]/40 backdrop-blur-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8CBDB7] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Gateway</span>
        </Link>
        <div className="text-xs text-[#8CBDB7]">
          Shipping Customer?{" "}
          <Link href="/customer/auth" className="text-[#54D2C3] font-bold hover:underline">
            Customer Portal Login
          </Link>
        </div>
      </header>

      {/* ── Main Container ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14">
        {/* Brand Emblem & Title */}
        <div className="text-center mb-8 max-w-lg">
          <div className="inline-flex items-center justify-center mb-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-2xl transition-transform hover:scale-105 duration-300"
              style={{
                background: "linear-gradient(135deg, #005F58 0%, #003B36 100%)",
                boxShadow: "0 8px 32px rgba(0, 71, 65, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Anchor className="h-7 w-7 text-[#54D2C3]" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Port Worker <span className="font-light text-[#7BCBD8]">Terminal Access</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#A0B5B2] font-medium mt-1.5 max-w-md mx-auto leading-relaxed">
            Authorized Port Authority Personnel &bull; Quayside Operations, CP-SAT Optimization, &amp; Vessel Approvals
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-md">
          <div
            className="rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-xl relative"
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              boxShadow:
                "0 24px 64px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            }}
          >
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#FFF0F0] border border-[#FFD0D0] p-3.5 text-xs text-[#9B1C1C]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#E02424]" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#354845] mb-1.5">
                  Port Authority Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="ops@naviops.port"
                    className={inputClass}
                  />
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#899491]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#354845] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className={`${inputClass} pr-11`}
                  />
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#899491]" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-[#899491] hover:text-[#102A27]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center py-3.5 text-sm font-semibold rounded-xl bg-[#004741] text-white hover:bg-[#003833] shadow-lg shadow-[#004741]/25 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? "Authenticating Session..." : "Sign In to Terminal"}
                </Button>
              </div>
            </form>

            {/* Quick Demo Pre-Fill Buttons */}
            <div className="mt-6 pt-4 border-t border-[#EEF0EB]">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#7A8885] mb-2.5 text-center">
                Demo Accounts (Quick Sign In)
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => handlePreFill("ops")}
                  className="p-2 rounded-lg bg-[#F0F5F4] hover:bg-[#E0ECEB] text-[11px] font-bold text-[#004741] border border-[#D5E5E3] transition-all"
                >
                  Operation Mgr
                </button>
                <button
                  type="button"
                  onClick={() => handlePreFill("admin")}
                  className="p-2 rounded-lg bg-[#F0F5F4] hover:bg-[#E0ECEB] text-[11px] font-bold text-[#004741] border border-[#D5E5E3] transition-all"
                >
                  Port Admin
                </button>
                <button
                  type="button"
                  onClick={() => handlePreFill("executive")}
                  className="p-2 rounded-lg bg-[#F0F5F4] hover:bg-[#E0ECEB] text-[11px] font-bold text-[#004741] border border-[#D5E5E3] transition-all"
                >
                  Port Viewer
                </button>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-5 pt-3 border-t border-[#EEF0EB] flex items-center justify-center gap-2 text-[11px] text-[#7A8885]">
              <ShieldCheck className="h-4 w-4 text-[#004741]" />
              <span>TLS 1.3 Encrypted &bull; Access Monitored &amp; Logged</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 py-4 text-center text-xs text-[#7A918E]">
        <p>NaviOps Port Authority Operating System &bull; Version 2.4.0</p>
      </footer>
    </div>
  );
}

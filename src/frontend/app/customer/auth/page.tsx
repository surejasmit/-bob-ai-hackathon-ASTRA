"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ship,
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Globe,
  FileText,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Briefcase,
  AlertCircle,
  Anchor,
} from "lucide-react";
import { customerApi, getCustomerAuthToken } from "@/lib/customer-api";
import { Button } from "@/components/design-system/button";

export default function CustomerAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  // Sign in state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign up state (Company + Admin)
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [country, setCountry] = useState("Singapore");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [website, setWebsite] = useState("");
  const [regNumber, setRegNumber] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminJobTitle, setAdminJobTitle] = useState("Fleet Operations Director");

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") setActiveTab("signup");

    const token = getCustomerAuthToken();
    if (token) {
      router.replace("/customer/dashboard");
    }
  }, [router, searchParams]);

  const handleFillDemo = () => {
    setActiveTab("signin");
    setLoginEmail("john@abcshipping.com");
    setLoginPassword("admin123");
    setErrorMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMsg("Please provide both email and password.");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await customerApi.login(loginEmail.trim(), loginPassword.trim());
      router.replace("/customer/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials. Please verify your email and password.");
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !companyEmail || !companyPhone || !country || !address || !city || !postalCode) {
      setErrorMsg("Please fill out all required company fields.");
      return;
    }
    if (!adminName || !adminEmail || !adminPassword) {
      setErrorMsg("Please fill out initial Customer Admin account details.");
      return;
    }
    if (adminPassword.length < 8) {
      setErrorMsg("Admin password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await customerApi.signup({
        organization_name: companyName.trim(),
        company_email: companyEmail.trim(),
        company_phone: companyPhone.trim(),
        country: country.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateVal.trim() || undefined,
        postal_code: postalCode.trim(),
        website: website.trim() || undefined,
        registration_number: regNumber.trim() || undefined,
        admin_full_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        password: adminPassword,
        admin_job_title: adminJobTitle.trim(),
      });
      router.replace("/customer/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register organization. Please review your details.");
      setIsLoading(false);
    }
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
          Port Authority staff?{" "}
          <Link href="/port/login" className="text-[#54D2C3] font-bold hover:underline">
            Port Worker Access
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
              <Ship className="h-7 w-7 text-[#54D2C3]" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Customer <span className="font-light text-[#7BCBD8]">Carrier Portal</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#A0B5B2] font-medium mt-1.5 max-w-md mx-auto leading-relaxed">
            Authorized Carrier Portal &bull; Vessel Arrival Requests, Feasibility Diagnostics, &amp; Schedule Collaboration
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-xl">
          <div
            className="rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-xl relative"
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              boxShadow:
                "0 24px 64px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Tabs */}
            <div className="flex rounded-xl bg-[#F7F8F6] p-1 border border-[#E3E5E0] mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signin");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "signin"
                    ? "bg-[#004741] text-white shadow-sm"
                    : "text-[#5C6B68] hover:text-[#102A27]"
                }`}
              >
                Sign In to Carrier Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signup");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "signup"
                    ? "bg-[#004741] text-white shadow-sm"
                    : "text-[#5C6B68] hover:text-[#102A27]"
                }`}
              >
                Register Carrier Organization
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#FFF0F0] border border-[#FFD0D0] p-3.5 text-xs text-[#9B1C1C]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#E02424]" />
                <span className="font-medium leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Quick Demo Credentials Pill */}
            <div className="mb-6 p-3 rounded-xl bg-[#E1EFEC] border border-[#C5DDD9] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="h-4 w-4 text-[#004741] shrink-0" />
                <span className="text-xs text-[#004741] truncate">
                  Demo: <strong>ABC Shipping Pvt. Ltd.</strong> (john@abcshipping.com)
                </span>
              </div>
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] font-bold text-white bg-[#004741] hover:bg-[#003833] px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer"
              >
                Autofill
              </button>
            </div>

            {/* ── TAB 1: SIGN IN ── */}
            {activeTab === "signin" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#354845] mb-1.5">
                    Carrier or Operator Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      placeholder="john@abcshipping.com"
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
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className={`${inputClass} pr-11`}
                    />
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#899491]" />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3.5 top-3.5 text-[#899491] hover:text-[#102A27] cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full"
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Sign In to Carrier Portal
                  </Button>
                </div>
              </form>
            )}

            {/* ── TAB 2: SIGN UP ── */}
            {activeTab === "signup" && (
              <form onSubmit={handleSignupSubmit} className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#004741] pb-1 border-b border-[#F0EDE4]">
                  1. Company Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Oceanic Freight Lines"
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Official Email *</label>
                    <input
                      type="email"
                      required
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="ops@oceanicfreight.com"
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Telephone *</label>
                    <input
                      type="tel"
                      required
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+65 6123 4567"
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Country *</label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#102A27] mb-1">Headquarters Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="10 Marina Boulevard, Tower 2"
                    className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">State / Prov</label>
                    <input
                      type="text"
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Postal Code *</label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-[#004741] pt-3 pb-1 border-b border-[#F0EDE4]">
                  2. Administrator Account
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Captain David Vance"
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#102A27] mb-1">Admin Email *</label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="david@oceanicfreight.com"
                      className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#102A27] mb-1">Password (min 8 chars) *</label>
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F8F6] px-3 py-2 text-xs text-[#102A27] focus:bg-white focus:border-[#004741] focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full"
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Complete Company Registration
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 px-6 sm:px-12 py-4 border-t border-[#0E3531]/60 bg-[#071E1C]/40 backdrop-blur-md text-center text-xs text-[#6C8A86]">
        NaviOps Shipping Carrier Portal &bull; Isolated Domain &bull; Secure Port Integration
      </footer>
    </div>
  );
}

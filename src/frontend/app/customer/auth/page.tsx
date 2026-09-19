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
} from "lucide-react";
import { customerApi, getCustomerAuthToken } from "@/lib/customer-api";

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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    "w-full rounded-xl border border-[#16364D] bg-[#071926] px-4 py-3 pl-11 text-sm text-white placeholder:text-[#5E83A1] focus:bg-[#092233] focus:border-[#009688] focus:outline-none focus:ring-2 focus:ring-[#009688]/20 transition-all";

  return (
    <div className="min-h-screen w-full bg-[#05131C] text-[#E0EBF5] flex flex-col justify-between relative overflow-hidden antialiased">
      {/* ── Maritime Teal Ambient Radial Highlights ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -15%, rgba(0, 150, 136, 0.25) 0%, rgba(5, 19, 28, 0.95) 60%, #030D13 100%)",
        }}
      />
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#009688]/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#0284C7]/15 blur-3xl pointer-events-none" />

      {/* ── Top Header Bar ── */}
      <header className="relative z-10 px-6 sm:px-12 py-5 flex items-center justify-between border-b border-[#112A3E]/60 bg-[#071926]/40 backdrop-blur-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#7CA1BF] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to NaviOps Gateway</span>
        </Link>
        <div className="text-xs text-[#7CA1BF]">
          Port Authority staff?{" "}
          <Link href="/port/login" className="text-[#38BDF8] font-bold hover:underline">
            Port Worker Login
          </Link>
        </div>
      </header>

      {/* ── Center Content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14">
        {/* Title */}
        <div className="text-center mb-8 max-w-lg">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#009688] to-[#0D4B48] text-white shadow-xl shadow-[#009688]/25 border border-[#009688]/40">
              <Ship className="h-7 w-7 text-[#A7F3D0]" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Customer <span className="text-[#2DD4BF]">Shipping Portal</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#87ADC9] mt-2 font-normal">
            Submit and track vessel arrival requests, collaborate on berthing windows, and accept alternative schedules.
          </p>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-xl rounded-3xl bg-[#091E2C]/90 border border-[#173F5C] p-6 sm:p-9 shadow-2xl backdrop-blur-xl">
          {/* Tabs */}
          <div className="flex rounded-xl bg-[#061520] p-1 border border-[#14344B] mb-6">
            <button
              onClick={() => {
                setActiveTab("signin");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "signin"
                  ? "bg-[#009688] text-white shadow-md"
                  : "text-[#87ADC9] hover:text-white"
              }`}
            >
              Sign In to Fleet
            </button>
            <button
              onClick={() => {
                setActiveTab("signup");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "signup"
                  ? "bg-[#009688] text-white shadow-md"
                  : "text-[#87ADC9] hover:text-white"
              }`}
            >
              Register Company
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#7F1D1D]/30 border border-[#DC2626]/50 text-[#FCA5A5] text-xs font-medium flex items-start gap-2.5">
              <div className="h-4 w-4 rounded-full bg-[#EF4444] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                !
              </div>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Demo Credentials Pill */}
          <div className="mb-6 p-3 rounded-xl bg-[#0E2C40]/60 border border-[#1C4E72]/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#38BDF8]" />
              <span className="text-xs text-[#95BAD6]">
                Demo Company: <strong className="text-white">ABC Shipping Pvt. Ltd.</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] font-bold text-[#2DD4BF] hover:text-white px-2.5 py-1 rounded bg-[#009688]/20 border border-[#009688]/40 hover:bg-[#009688] transition-all"
            >
              Autofill Demo
            </button>
          </div>

          {/* ── TAB 1: SIGN IN ── */}
          {activeTab === "signin" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1.5">
                  Company or Operator Email
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
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1.5">
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
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-3.5 text-[#5E83A1] hover:text-white"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white font-bold text-sm shadow-lg shadow-[#009688]/30 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? "Authenticating Session..." : "Sign In to Customer Portal"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* ── TAB 2: SIGN UP (COMPANY REGISTRATION) ── */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignupSubmit} className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {/* Organization Section */}
              <div className="pb-2 border-b border-[#14344B]">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>1. Company / Organization Details</span>
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                  Company Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="e.g. Oceanic Bulk & Container Line"
                    className={inputClass}
                  />
                  <Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Company Email *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      required
                      placeholder="ops@oceanicline.com"
                      className={inputClass}
                    />
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Company Phone *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      required
                      placeholder="+65 6789 0000"
                      className={inputClass}
                    />
                    <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Country *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                      placeholder="Singapore"
                      className={inputClass}
                    />
                    <Globe className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    City *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      placeholder="Singapore"
                      className={inputClass}
                    />
                    <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                  Headquarters Street Address *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="10 Collyer Quay, Ocean Financial Centre"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                    placeholder="049315"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Registration No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="SG-2023-89472"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Initial Customer Admin Section */}
              <div className="pt-4 pb-2 border-b border-[#14344B]">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span>2. Primary Customer Administrator</span>
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                    placeholder="Capt. Thomas Sterling"
                    className={inputClass}
                  />
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Admin Email *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      placeholder="thomas@oceanicline.com"
                      className={inputClass}
                    />
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Job Title
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={adminJobTitle}
                      onChange={(e) => setAdminJobTitle(e.target.value)}
                      placeholder="Fleet Operations Director"
                      className={inputClass}
                    />
                    <Briefcase className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                  Admin Password (min. 8 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    className={`${inputClass} pr-11`}
                  />
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#5E83A1]" />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-3.5 text-[#5E83A1] hover:text-white"
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white font-bold text-sm shadow-lg shadow-[#009688]/30 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? "Creating Company Profile..." : "Register Company & Create Admin"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-[#133247] flex items-center justify-center gap-2 text-[11px] text-[#658CAE]">
            <ShieldCheck className="h-4 w-4 text-[#009688]" />
            <span>Multi-Tenant Organization Isolation &bull; End-to-End Encrypted</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-[#5D819F]">
        <p>NaviOps Port Authority Operating System &bull; External Shipping Line Gateway</p>
      </footer>
    </div>
  );
}

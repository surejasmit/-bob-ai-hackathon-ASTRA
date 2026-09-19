"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Ship,
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  GitPullRequest,
  Building2,
  Users,
  Bell,
  LogOut,
  ChevronRight,
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Menu,
  X,
  Anchor,
} from "lucide-react";
import {
  customerApi,
  clearCustomerAuthToken,
  getCustomerAuthToken,
  getCachedCustomerSession,
} from "@/lib/customer-api";
import {
  CustomerUser,
  CustomerOrganization,
  CustomerNotification,
} from "@/types/customer";

interface CustomerShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function CustomerShell({
  children,
  title,
  subtitle,
  actions,
}: CustomerShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<CustomerUser | null>(null);
  const [org, setOrg] = useState<CustomerOrganization | null>(null);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const token = getCustomerAuthToken();
    if (!token) {
      router.replace("/customer/auth");
      return;
    }

    const cached = getCachedCustomerSession();
    if (cached.user && cached.org) {
      setUser(cached.user);
      setOrg(cached.org);
      setIsLoadingAuth(false);
    }

    // Refresh from backend
    customerApi
      .getMe()
      .then((session) => {
        setUser(session.user);
        setOrg(session.organization);
        setIsLoadingAuth(false);
      })
      .catch((err) => {
        if (err.status === 401 || err.message?.includes("401")) {
          clearCustomerAuthToken();
          router.replace("/customer/auth");
        } else {
          setIsLoadingAuth(false);
        }
      });

    // Load notifications
    customerApi
      .getNotifications()
      .then((notifs) => setNotifications(notifs))
      .catch(() => {});
  }, [router]);

  const handleLogout = () => {
    clearCustomerAuthToken();
    window.location.href = "/";
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/customer/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "My Vessels",
      href: "/customer/vessels",
      icon: Ship,
    },
    {
      name: "Arrival Requests",
      href: "/customer/arrival-requests",
      icon: FileSpreadsheet,
    },
    {
      name: "New Request",
      href: "/customer/arrival-requests/new",
      icon: PlusCircle,
      badge: "Submit",
    },
    {
      name: "Alternative Proposals",
      href: "/customer/proposals",
      icon: GitPullRequest,
    },
    {
      name: "Company Profile",
      href: "/customer/profile",
      icon: Building2,
    },
  ];

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#06151F] text-[#E0EBF5] flex flex-col antialiased selection:bg-[#009688]/30">
      {/* ── Top Ambient Glow ── */}
      <div
        className="fixed top-0 left-0 right-0 h-96 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 150, 136, 0.18) 0%, rgba(6, 21, 31, 0) 100%)",
        }}
      />

      {/* ── Navigation Header ── */}
      <header className="sticky top-0 z-40 border-b border-[#133247] bg-[#081B28]/85 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Portal Type */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 text-[#8CB4D2] hover:text-white rounded-lg hover:bg-[#0E2C42]"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link href="/customer/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#009688] to-[#0E5257] flex items-center justify-center text-white shadow-lg shadow-[#009688]/20 group-hover:scale-105 transition-all">
                <Ship className="h-5 w-5 text-[#A7F3D0]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black tracking-tight text-white text-base">NaviOps</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#009688]/20 text-[#34D399] border border-[#009688]/30">
                    Customer Portal
                  </span>
                </div>
                <p className="text-[11px] text-[#7198B5] font-medium truncate max-w-[200px] sm:max-w-xs">
                  {org?.name || "Shipping Organization"}
                </p>
              </div>
            </Link>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 rounded-xl text-[#8CB4D2] hover:text-white hover:bg-[#0E2C42] border border-transparent hover:border-[#1E435E] transition-all"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-[#EF4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#081B28]">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0A2234] border border-[#173F5C] shadow-2xl p-4 z-50 animate-in fade-in-50 slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-3 border-b border-[#173F5C]/80 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8CB4D2]">
                      Notifications
                    </span>
                    <span className="text-[11px] text-[#7198B5]">
                      {notifications.length} recent
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#7198B5] py-4 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            customerApi.markNotificationRead(n.id);
                            setNotifications((prev) =>
                              prev.map((x) =>
                                x.id === n.id ? { ...x, is_read: true } : x
                              )
                            );
                            if (n.link_url) router.push(n.link_url);
                            setShowNotifMenu(false);
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            n.is_read
                              ? "bg-[#081B28]/40 border-[#143247]/50 opacity-75 hover:opacity-100"
                              : "bg-[#0E2F47]/80 border-[#009688]/40 hover:border-[#009688]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">
                              {n.notification_type.includes("APPROVED") ? (
                                <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
                              ) : n.notification_type.includes("PROPOSED") ? (
                                <GitPullRequest className="h-4 w-4 text-[#38BDF8]" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-[#FBBF24]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {n.title}
                              </p>
                              <p className="text-[11px] text-[#A2C3DC] mt-0.5 line-clamp-2">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-[#5D86A7] mt-1 block">
                                {new Date(n.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Identity Chip */}
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-[#133247]">
              <div className="h-8 w-8 rounded-lg bg-[#0E2F47] border border-[#1C4B6F] flex items-center justify-center font-bold text-xs text-[#38BDF8]">
                {user?.full_name?.charAt(0) || "C"}
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs font-semibold text-white">
                  {user?.full_name || "Customer User"}
                </p>
                <span className="text-[10px] text-[#2DD4BF] font-mono">
                  {user?.role === "CUSTOMER_ADMIN" ? "Admin" : "Operator"}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-[#7E9EB8] hover:text-[#EF4444] rounded-xl hover:bg-[#1A1A28] border border-transparent hover:border-[#3E1B24] transition-all"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container: Sidebar + Content ── */}
      <div className="max-w-7xl mx-auto w-full flex-1 flex px-4 sm:px-8 py-6 gap-6 sm:gap-8 relative z-10">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between rounded-2xl bg-[#091E2C]/80 border border-[#13344A] p-4 shadow-xl backdrop-blur-sm self-start sticky top-20">
          <div className="space-y-1.5">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#638DAE]">
              Navigation
            </div>
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    active
                      ? "bg-[#009688] text-white shadow-lg shadow-[#009688]/30 font-bold"
                      : "text-[#97BDDC] hover:text-white hover:bg-[#0E2E44]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${active ? "text-white" : "text-[#5B88AD] group-hover:text-[#38BDF8]"}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && !active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#009688]/20 text-[#34D399] border border-[#009688]/30">
                      {item.badge}
                    </span>
                  )}
                  {active && <ChevronRight className="h-4 w-4 text-white/80" />}
                </Link>
              );
            })}
          </div>

          {/* Port Operations Switcher Notice */}
          <div className="mt-8 pt-4 border-t border-[#13344A]">
            <div className="p-3 rounded-xl bg-[#06141F] border border-[#13344A] text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8CB4D2]">
                <Shield className="h-3.5 w-3.5 text-[#009688]" />
                <span>Port Operations</span>
              </div>
              <p className="text-[10px] text-[#638DAE] mt-1 leading-relaxed">
                Port Authority staff? Switch to internal terminal operations.
              </p>
              <Link
                href="/port/login"
                className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
              >
                <span>Port Worker Login</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex">
            <div className="w-72 bg-[#091E2C] border-r border-[#173F5C] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#173F5C] mb-4">
                  <span className="font-bold text-white text-sm">Customer Menu</span>
                  <button onClick={() => setMobileNavOpen(false)} className="text-[#8CB4D2]">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                          active
                            ? "bg-[#009688] text-white"
                            : "text-[#97BDDC] hover:text-white hover:bg-[#0E2E44]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#172635] text-[#EF4444] text-xs font-semibold"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Page Title & Subtitle Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-[#8CB4D2] mt-1 font-normal leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
          </div>

          {/* Page Body */}
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#133247] py-4 text-center text-xs text-[#547997] relative z-10">
        <p>
          NaviOps External Customer Shipping Portal &bull; Multi-Tenant Isolated Domain &bull; v2.4.0
        </p>
      </footer>
    </div>
  );
}

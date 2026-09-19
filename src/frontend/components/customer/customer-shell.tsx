"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Ship,
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  GitPullRequest,
  Building2,
  Bell,
  LogOut,
  ChevronDown,
  Shield,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Menu,
  X,
  Anchor,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const roleLabel =
    user?.role === "CUSTOMER_ADMIN" ? "Customer Admin" : "Customer User";

  const roleIcon =
    user?.role === "CUSTOMER_ADMIN" ? (
      <ShieldCheck className="h-3 w-3 text-[#004741]" />
    ) : (
      <UserCheck className="h-3 w-3 text-[#2F7D8C]" />
    );

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#004741] text-white shadow-card-md animate-pulse mb-4">
          <Anchor className="h-7 w-7" />
        </div>
        <div className="text-sm font-semibold text-[#102A27]">
          Authenticating Customer Session...
        </div>
        <div className="text-xs text-[#5C6B68] mt-1">
          Verifying organization credentials and carrier access
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] relative flex flex-col selection:bg-[#E1EFEC] selection:text-[#004741]">
      {/* ── Fixed Left Sidebar (Desktop) ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex w-60 flex-col border-r border-[#E3E5E0] bg-white">
        {/* Brand Header */}
        <div className="flex h-14 items-center border-b border-[#E3E5E0] px-5">
          <Link href="/customer/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#004741] text-white shadow-sm">
              <Anchor className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-[#004741] leading-tight">
                NaviOps
              </span>
              <span className="block text-[9px] font-medium tracking-widest uppercase text-[#899491] leading-tight">
                Customer Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Organization Badge in Sidebar */}
        <div className="px-4 py-2.5 border-b border-[#F0EDE4] bg-[#F7F9F8]">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 text-[#5C6B68] shrink-0" />
            <span className="text-xs font-semibold text-[#102A27] truncate">
              {org?.name || "Shipping Organization"}
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#899491]">
              Customer Navigation
            </div>
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                      isActive
                        ? "bg-[#E1EFEC] text-[#004741] font-semibold"
                        : "text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-[#004741]" : "text-[#899491] group-hover:text-[#004741]"
                      )}
                    />
                    <div className="flex flex-1 items-center justify-between truncate">
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className="rounded bg-[#004741]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#004741]">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Port Operations Switcher */}
        <div className="px-3 py-2 border-t border-[#E3E5E0] bg-[#F7F9F8]">
          <Link
            href="/operations"
            className="flex items-center justify-between rounded-lg border border-[#D5DCDA] bg-white px-2.5 py-1.5 text-xs font-medium text-[#102A27] hover:border-[#004741] hover:text-[#004741] shadow-2xs transition-colors group"
          >
            <div className="flex items-center gap-2 truncate">
              <Compass className="h-3.5 w-3.5 text-[#004741]" />
              <span className="truncate text-[11px] font-semibold">Port Operations</span>
            </div>
            <ExternalLink className="h-3 w-3 text-[#899491] group-hover:text-[#004741]" />
          </Link>
        </div>

        {/* User Footer */}
        <div className="border-t border-[#E3E5E0] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E1EFEC] text-xs font-bold text-[#004741] border border-[#C5DDD9]">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "C"}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-[#102A27] truncate">
                  {user?.full_name || "Customer"}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#5C6B68]">
                  {roleIcon}
                  <span>{roleLabel}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-[#899491] hover:bg-[#FCE9E8] hover:text-[#B94A48] transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#102A27]/25 backdrop-blur-xs flex">
          <div className="w-64 bg-white border-r border-[#E3E5E0] p-4 flex flex-col justify-between shadow-card-lg animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E5E0] mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004741] text-white">
                    <Anchor className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-[#004741]">NaviOps Customer</span>
                </div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg p-1.5 text-[#899491] hover:bg-[#F7F6F2] hover:text-[#102A27]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                        isActive
                          ? "bg-[#E1EFEC] text-[#004741] font-semibold"
                          : "text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E3E5E0] space-y-2">
              <Link
                href="/operations"
                className="flex items-center justify-between rounded-lg border border-[#D5DCDA] bg-[#F7F9F8] px-3 py-2 text-xs font-semibold text-[#102A27]"
              >
                <span>Port Operations</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#899491]" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#FCE9E8] text-[#B94A48] text-xs font-semibold"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Layout (Header + Content) ── */}
      <div className="flex flex-col lg:pl-60 relative min-h-screen">
        {/* Sticky Header Bar */}
        <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-[#E3E5E0] bg-white/97 px-4 sm:px-6 backdrop-blur-sm">
          {/* Left: Mobile Toggle + Title & Subtitle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-[#5C6B68] hover:text-[#102A27] rounded-lg hover:bg-[#F7F6F2]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col justify-center">
              <h1 className="text-sm font-semibold tracking-tight text-[#102A27]">{title}</h1>
              {subtitle && (
                <p className="text-[11px] text-[#5C6B68] font-normal leading-tight line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions, Notifications, User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Custom page actions */}
            {actions && <div className="flex items-center gap-2">{actions}</div>}

            {/* Notifications Menu */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                title="Notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3E5E0] bg-white text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741] transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#B94A48] px-1 text-[9px] font-bold text-white shadow-xs">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-[#E3E5E0] bg-white p-3 shadow-card-md z-50 animate-in fade-in-50 slide-in-from-top-1">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0EDE4] mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6B68]">
                      Notifications
                    </span>
                    <span className="text-[11px] text-[#899491]">
                      {notifications.length} recent
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#899491] py-4 text-center">
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
                          className={cn(
                            "p-2.5 rounded-lg border text-left cursor-pointer transition-all text-xs",
                            n.is_read
                              ? "bg-white border-[#F0EDE4] text-[#5C6B68] hover:bg-[#F7F6F2]"
                              : "bg-[#E1EFEC]/40 border-[#C5DDD9] text-[#102A27] hover:bg-[#E1EFEC]/70"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                              {n.notification_type.includes("APPROVED") ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#2F7D5B]" />
                              ) : n.notification_type.includes("PROPOSED") ? (
                                <GitPullRequest className="h-3.5 w-3.5 text-[#2F7D8C]" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 text-[#C58A2B]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{n.title}</div>
                              <p className="text-[11px] text-[#5C6B68] mt-0.5 line-clamp-2">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-[#899491] block mt-1">
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

            {/* Profile Dropdown */}
            {user && (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 rounded-full border border-transparent py-0.5 pl-1 pr-2 text-xs hover:bg-[#F7F6F2] hover:border-[#E3E5E0] transition-all"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#004741] text-[11px] font-bold text-white">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : "C"}
                  </div>
                  <span className="font-medium text-[#102A27] hidden sm:inline max-w-[130px] truncate">
                    {user.full_name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-[#899491]" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#E3E5E0] bg-white p-2 shadow-card-md z-50 text-xs animate-in fade-in-50 slide-in-from-top-1">
                    <div className="px-2 py-1.5 border-b border-[#F0EDE4] mb-1.5">
                      <div className="font-semibold text-[#102A27] truncate">
                        {user.full_name}
                      </div>
                      <div className="text-[11px] text-[#899491] truncate mt-0.5">
                        {user.email}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#004741]">
                        <Shield className="h-3 w-3" />
                        <span>{roleLabel}</span>
                      </div>
                      <div className="text-[10px] text-[#5C6B68] mt-0.5 truncate">
                        {org?.name}
                      </div>
                    </div>

                    <Link
                      href="/customer/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#102A27] transition-colors"
                    >
                      <Building2 className="h-3.5 w-3.5 text-[#899491]" />
                      <span>Company Profile</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[#B94A48] hover:bg-[#FCE9E8] transition-colors text-left mt-1 border-t border-[#F0EDE4] pt-2 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative z-10 flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-5">
          {children}
        </main>
      </div>
    </div>
  );
}

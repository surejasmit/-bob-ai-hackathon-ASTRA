"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Compass,
  Ship,
  Anchor,
  Cpu,
  Boxes,
  Zap,
  AlertTriangle,
  Bot,
  Users,
  LogOut,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Eye,
  Radio,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
import { User, UserRole } from "@/types";

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: UserRole[];
  badge?: string;
  children?: { name: string; href: string; icon: any }[];
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const role: UserRole = user?.role || "viewer";

  const isAssetsActive =
    pathname.startsWith("/vessels") ||
    pathname.startsWith("/berths") ||
    pathname.startsWith("/cranes") ||
    pathname.startsWith("/yards");

  const [assetsOpen, setAssetsOpen] = useState(isAssetsActive);

  const mainNavItems: NavItem[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      roles: ["admin", "operations", "viewer"],
    },
    {
      name: "Arrival Requests",
      href: "/operations/vessel-requests",
      icon: ClipboardCheck,
      roles: ["admin", "operations"],
      badge: "Inbound",
    },
    {
      name: "Operations",
      href: "/operations",
      icon: Compass,
      roles: ["admin", "operations"],
    },
    {
      name: "Port Twin",
      href: "/port-twin",
      icon: Radio,
      roles: ["admin", "operations", "viewer"],
      badge: "2.5D",
    },
    {
      name: "Assets",
      href: "/vessels",
      icon: Ship,
      roles: ["admin", "operations", "viewer"],
      children: [
        { name: "Vessels Fleet", href: "/vessels", icon: Ship },
        { name: "Quay Berths", href: "/berths", icon: Anchor },
        { name: "STS Cranes", href: "/cranes", icon: Cpu },
        { name: "Yard Zones", href: "/yards", icon: Boxes },
      ],
    },
    {
      name: "Optimization",
      href: "/optimization",
      icon: Zap,
      roles: ["admin", "operations", "viewer"],
    },
    {
      name: "Disruptions",
      href: "/disruptions",
      icon: AlertTriangle,
      roles: ["admin", "operations", "viewer"],
    },
    {
      name: "Bob Copilot",
      href: "/copilot",
      icon: Bot,
      roles: ["admin", "operations", "viewer"],
    },
  ];

  const adminNavItems: NavItem[] = [
    {
      name: "Users",
      href: "/users",
      icon: Users,
      roles: ["admin"],
    },
  ];

  const visibleMainItems = mainNavItems.filter((item) => item.roles.includes(role));
  const visibleAdminItems = adminNavItems.filter((item) => item.roles.includes(role));

  const roleLabel =
    role === "admin"
      ? "Port Admin"
      : role === "operations"
      ? "Ops Staff"
      : "Viewer";

  const roleIcon =
    role === "admin" ? (
      <ShieldCheck className="h-3 w-3 text-[#004741]" />
    ) : role === "operations" ? (
      <UserCheck className="h-3 w-3 text-[#2F7D8C]" />
    ) : (
      <Eye className="h-3 w-3 text-[#C58A2B]" />
    );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-[#E3E5E0] bg-white">
      {/* Brand Header */}
      <div className="flex h-14 items-center border-b border-[#E3E5E0] px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#004741] text-white shadow-sm">
            <Anchor className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-sm font-bold tracking-tight text-[#004741] leading-tight">
              NaviOps
            </span>
            <span className="block text-[9px] font-medium tracking-widest uppercase text-[#899491] leading-tight">
              Port Operations
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Main Section */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#899491]">
            Main
          </div>
          <nav className="space-y-0.5">
            {visibleMainItems.map((item) => {
              const Icon = item.icon;

              if (item.children) {
                const isCurrentActive = isAssetsActive;
                return (
                  <div key={item.name} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setAssetsOpen(!assetsOpen)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                        isCurrentActive
                          ? "bg-[#E1EFEC] text-[#004741] font-semibold"
                          : "text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isCurrentActive
                              ? "text-[#004741]"
                              : "text-[#899491] group-hover:text-[#004741]"
                          )}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {assetsOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[#899491]" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-[#899491]" />
                      )}
                    </button>

                    {assetsOpen && (
                      <div className="pl-6 pr-1 space-y-0.5">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.href;
                          const ChildIcon = child.icon;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
                                isChildActive
                                  ? "bg-[#E1EFEC] text-[#004741] font-semibold"
                                  : "text-[#5C6B68] hover:bg-[#F7F6F2] hover:text-[#004741]"
                              )}
                            >
                              <ChildIcon
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  isChildActive ? "text-[#004741]" : "text-[#899491]"
                                )}
                              />
                              <span className="truncate">{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

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

        {/* Administration Section */}
        {visibleAdminItems.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#899491]">
              Administration
            </div>
            <nav className="space-y-0.5">
              {visibleAdminItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
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
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Customer Module Switcher */}
      <div className="px-3 py-2 border-t border-[#E3E5E0] bg-[#F7F9F8]">
        <Link
          href="/customer/dashboard"
          className="flex items-center justify-between rounded-lg border border-[#D5DCDA] bg-white px-2.5 py-1.5 text-xs font-medium text-[#102A27] hover:border-[#004741] hover:text-[#004741] shadow-xs transition-colors group"
        >
          <div className="flex items-center gap-2 truncate">
            <Ship className="h-3.5 w-3.5 text-[#004741]" />
            <span className="truncate text-[11px] font-semibold">Customer Portal</span>
          </div>
          <ExternalLink className="h-3 w-3 text-[#899491] group-hover:text-[#004741]" />
        </Link>
      </div>

      {/* User Footer */}
      <div className="border-t border-[#E3E5E0] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E1EFEC] text-xs font-bold text-[#004741] border border-[#C5DDD9]">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-[#102A27] truncate">
                {user?.full_name || "User"}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#5C6B68]">
                {roleIcon}
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-[#899491] hover:bg-[#FCE9E8] hover:text-[#B94A48] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Shield,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi, getCachedCustomerSession } from "@/lib/customer-api";
import {
  CustomerOrganization,
  CustomerUser,
} from "@/types/customer";

export default function CustomerProfilePage() {
  const [org, setOrg] = useState<CustomerOrganization | null>(null);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite user state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"CUSTOMER_USER" | "CUSTOMER_ADMIN">("CUSTOMER_USER");
  const [newPassword, setNewPassword] = useState("Password123!");
  const [newJobTitle, setNewJobTitle] = useState("Operations Coordinator");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [oData, uList, me] = await Promise.all([
        customerApi.getOrganization(),
        customerApi.getUsers(),
        customerApi.getMe(),
      ]);
      setOrg(oData);
      setUsers(uList);
      setCurrentUser(me.user);
    } catch (err) {
      console.error("Failed to load organization data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    try {
      setIsSubmitting(true);
      await customerApi.createUser({
        email: newEmail.trim(),
        full_name: newName.trim(),
        role: newRole,
        password: newPassword,
        job_title: newJobTitle.trim(),
      });
      setShowInviteModal(false);
      setNewEmail("");
      setNewName("");
      await loadData();
    } catch (err: any) {
      setInviteError(err.message || "Failed to add company user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = currentUser?.role === "CUSTOMER_ADMIN";
  const inputClass =
    "w-full rounded-xl border border-[#16364D] bg-[#071926] px-3.5 py-2 text-xs text-white placeholder:text-[#5E83A1] focus:bg-[#092233] focus:border-[#009688] focus:outline-none focus:ring-1 focus:ring-[#009688]";

  return (
    <CustomerShell
      title="Company Profile & User Directory"
      subtitle="Manage registered shipping organization credentials and authorized staff access."
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── Organization Info Card ── */}
        <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 sm:p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-[#13344A]">
            <div className="p-2.5 rounded-2xl bg-[#009688]/20 text-[#34D399]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {org?.name || "Shipping Organization"}
              </h3>
              <p className="text-xs text-[#7BA1BF]">{org?.industry || "Maritime Freight"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42]">
              <span className="text-[10px] uppercase font-bold text-[#6D94B5] block mb-1">
                Official Company Email
              </span>
              <span className="font-semibold text-white">{org?.company_email}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42]">
              <span className="text-[10px] uppercase font-bold text-[#6D94B5] block mb-1">
                Telephone Contact
              </span>
              <span className="font-semibold text-white">{org?.company_phone}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42]">
              <span className="text-[10px] uppercase font-bold text-[#6D94B5] block mb-1">
                Country & City
              </span>
              <span className="font-semibold text-white">
                {org?.city}, {org?.country}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42] sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-[#6D94B5] block mb-1">
                Headquarters Address
              </span>
              <span className="font-semibold text-white">
                {org?.address} {org?.postal_code && `(${org?.postal_code})`}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#061520] border border-[#122E42]">
              <span className="text-[10px] uppercase font-bold text-[#6D94B5] block mb-1">
                Registration No.
              </span>
              <span className="font-mono text-white">{org?.registration_number || "Verified"}</span>
            </div>
          </div>
        </div>

        {/* ── Team Directory ── */}
        <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 sm:p-7 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#13344A]">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-[#38BDF8]" />
              <h3 className="text-sm font-bold text-white">Authorized Company Users</h3>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#009688] hover:bg-[#007F73] px-3.5 py-1.5 rounded-xl shadow-md transition-all"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Add Team Member</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#6D94B5] uppercase tracking-wider font-bold border-b border-[#13344A]">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Job Title</th>
                  <th className="py-3 px-3">Access Role</th>
                  <th className="py-3 px-3 text-right">Member Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#13344A]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#0E2E44]/50 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-white flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-[#0F3550] text-[#38BDF8] flex items-center justify-center font-bold text-xs">
                        {u.full_name.charAt(0)}
                      </div>
                      <span>{u.full_name}</span>
                    </td>
                    <td className="py-3.5 px-3 text-[#9AC2E2] font-mono">{u.email}</td>
                    <td className="py-3.5 px-3 text-[#7BA1BF]">{u.job_title || "Operator"}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.role === "CUSTOMER_ADMIN"
                            ? "bg-[#009688]/20 text-[#34D399] border border-[#009688]/40"
                            : "bg-[#0284C7]/20 text-[#38BDF8] border border-[#0284C7]/40"
                        }`}
                      >
                        {u.role === "CUSTOMER_ADMIN" ? "CUSTOMER ADMIN" : "CUSTOMER USER"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right text-[#5A7E9D]">
                      {new Date(u.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add User Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#091E2C] border border-[#174666] shadow-2xl p-6 relative">
            <h3 className="text-base font-extrabold text-white mb-1">
              Add Authorized Company User
            </h3>
            <p className="text-xs text-[#7BA1BF] mb-4">
              Add team members to submit and track arrival requests under your organization.
            </p>

            {inviteError && (
              <div className="mb-4 p-3 rounded-xl bg-[#DC2626]/20 border border-[#DC2626]/50 text-[#FCA5A5] text-xs">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="Operations Coordinator"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="CUSTOMER_USER">CUSTOMER_USER (Create & Track Requests)</option>
                  <option value="CUSTOMER_ADMIN">CUSTOMER_ADMIN (Full Organization Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#13344A]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0E2E44] text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white text-xs font-bold shadow-lg"
                >
                  {isSubmitting ? "Adding..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import {
  CustomerOrganization,
  CustomerUser,
} from "@/types/customer";
import { Button } from "@/components/design-system/button";
import { Badge } from "@/components/design-system/badge";
import { Modal } from "@/components/design-system/modal";
import { FormField, Input, Select } from "@/components/design-system/form-field";

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

  return (
    <CustomerShell
      title="Company Profile & User Directory"
      subtitle="Manage registered shipping organization credentials and authorized staff access."
    >
      <div className="space-y-5 max-w-5xl mx-auto">
        {/* ── Organization Info Card ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#F0EDE4]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E1EFEC] text-[#004741]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#102A27]">
                {org?.name || "Shipping Organization"}
              </h3>
              <p className="text-[11px] text-[#5C6B68]">{org?.industry || "Maritime Freight"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block mb-0.5">
                Official Company Email
              </span>
              <span className="font-semibold text-[#102A27]">{org?.company_email}</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block mb-0.5">
                Telephone Contact
              </span>
              <span className="font-semibold text-[#102A27]">{org?.company_phone}</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block mb-0.5">
                Country & City
              </span>
              <span className="font-semibold text-[#102A27]">
                {org?.city}, {org?.country}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0] sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-[#899491] block mb-0.5">
                Headquarters Address
              </span>
              <span className="font-semibold text-[#102A27]">
                {org?.address} {org?.postal_code && `(${org?.postal_code})`}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0]">
              <span className="text-[10px] uppercase font-bold text-[#899491] block mb-0.5">
                Registration No.
              </span>
              <span className="font-mono font-semibold text-[#102A27]">
                {org?.registration_number || "Verified"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Team Directory ── */}
        <div className="rounded-xl border border-[#E3E5E0] bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#E3E5E0] bg-[#F7F9F8]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#004741]" />
              <h3 className="text-sm font-semibold text-[#102A27]">Authorized Company Users</h3>
            </div>

            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowInviteModal(true)}
                leftIcon={<UserPlus className="h-3.5 w-3.5" />}
              >
                Add Team Member
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E5E0] bg-[#F7F9F8] text-[11px] font-semibold uppercase tracking-wider text-[#5C6B68]">
                  <th className="px-4 py-3">User Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Access Role</th>
                  <th className="px-4 py-3 text-right">Member Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E5E0] bg-white">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7F9F8] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#102A27]">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#E1EFEC] text-[#004741] flex items-center justify-center font-bold text-[11px] border border-[#C5DDD9]">
                          {u.full_name.charAt(0)}
                        </div>
                        <span>{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#5C6B68] font-mono">{u.email}</td>
                    <td className="px-4 py-3 text-[#5C6B68]">{u.job_title || "Operator"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="role" role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-right text-[#899491]">
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
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Add Authorized Company User"
        description="Add team members to submit and track arrival requests under your organization."
        maxWidth="md"
      >
        {inviteError && (
          <div className="mb-4 p-3 rounded-lg bg-[#FCE9E8] border border-[#F2C4C3] text-[#B94A48] text-xs font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{inviteError}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-3.5">
          <FormField label="Full Name" required>
            <Input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sarah Connor"
            />
          </FormField>

          <FormField label="Email Address" required>
            <Input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="sarah@company.com"
            />
          </FormField>

          <FormField label="Job Title">
            <Input
              type="text"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              placeholder="Operations Coordinator"
            />
          </FormField>

          <FormField label="Role" required>
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
            >
              <option value="CUSTOMER_USER">Customer User (Create & Track Requests)</option>
              <option value="CUSTOMER_ADMIN">Customer Admin (Full Organization Admin)</option>
            </Select>
          </FormField>

          <FormField label="Temporary Password" required>
            <Input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#F0EDE4]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowInviteModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Add User
            </Button>
          </div>
        </form>
      </Modal>
    </CustomerShell>
  );
}

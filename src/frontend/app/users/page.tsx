"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Search,
  UserPlus,
  User as UserIcon,
  Mail,
  Lock,
  Building,
  Shield,
  Check,
  X,
  AlertCircle,
  Trash2,
  Copy,
  Key,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/design-system/card";
import { Badge } from "@/design-system/badge";
import { Button } from "@/design-system/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/design-system/table";
import { Modal } from "@/design-system/modal";
import { api } from "@/lib/api";
import { User, UserRole } from "@/types";
import { useToast } from "@/components/design-system/toast";
import { useConfirm } from "@/components/design-system/confirm-dialog";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>("admin");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<{ [userId: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updateStatus, setUpdateStatus] = useState<{ [userId: string]: string }>({});
  const toast = useToast();
  const confirm = useConfirm();

  // ── Password storage & visibility state ──
  const [savedPasswords, setSavedPasswords] = useState<Record<string, string>>({
    "admin@naviops.port": "admin123",
    "ops@naviops.port": "admin123",
    "executive@naviops.port": "admin123",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);

  // ── Modal states ──
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // ── Create user form state ──
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createDept, setCreateDept] = useState("Quayside Operations");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("operations");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsersData = async () => {
    setIsLoading(true);
    try {
      const userList = await api.getUsers();
      setUsers(userList);
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to load personnel directory.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRole = (localStorage.getItem("naviops_role") as UserRole) || "admin";
      setCurrentRole(savedRole);
      const userJson = localStorage.getItem("naviops_user");
      if (userJson) {
        try {
          const parsed = JSON.parse(userJson);
          if (parsed?.id) setCurrentUserId(parsed.id);
        } catch (e) {}
      }

      // Load persisted credentials for created users
      const stored = localStorage.getItem("naviops_user_passwords");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSavedPasswords((prev) => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    }
    fetchUsersData();
  }, []);

  const saveUserCredential = (userId: string, email: string, pass: string) => {
    setSavedPasswords((prev) => {
      const updated = {
        ...prev,
        [userId]: pass,
        [email.toLowerCase()]: pass,
      };
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("naviops_user_passwords", JSON.stringify(updated));
        }
      } catch (e) {}
      return updated;
    });
  };

  const getDisplayPassword = (user: User) => {
    const emailKey = user.email.toLowerCase();
    if (savedPasswords[user.id]) return savedPasswords[user.id];
    if (savedPasswords[emailKey]) return savedPasswords[emailKey];
    if (emailKey === "admin@naviops.port" || emailKey === "ops@naviops.port" || emailKey === "executive@naviops.port") {
      return "admin123";
    }
    return "Set upon creation";
  };

  const copyToClipboard = (text: string, fieldId: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success("Copied to Clipboard", `${label} copied.`);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    const cleanPass = newPasswordInput.trim();
    if (!cleanPass || cleanPass.length < 6) {
      setPasswordUpdateError("Password must be at least 6 characters long.");
      return;
    }
    setIsPasswordUpdating(true);
    setPasswordUpdateError(null);
    try {
      await api.updateUserPassword(userId, cleanPass);
      saveUserCredential(userId, email, cleanPass);
      toast.success("Password Updated", "User password has been updated and saved.");
      setIsResettingPassword(false);
      setNewPasswordInput("");
    } catch (err: any) {
      setPasswordUpdateError(err.message || "Failed to update password.");
      toast.error("Update Failed", err.message || "Could not update password.");
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  // ── Delete User Handler ──
  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.id === currentUserId) {
      toast.error("Action Prohibited", "You cannot delete your own active administrator account.");
      return;
    }

    const isConfirmed = await confirm({
      title: `Delete User: ${targetUser.full_name}`,
      description: `Are you sure you want to permanently delete ${targetUser.full_name} (${targetUser.email})? They will immediately lose access to NaviOps. This action cannot be undone.`,
      confirmText: "Delete Account",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!isConfirmed) return;

    setIsDeleting((prev) => ({ ...prev, [targetUser.id]: true }));
    try {
      await api.deleteUser(targetUser.id);
      toast.success("User Deleted", `${targetUser.full_name} has been removed from the system.`);
      if (selectedUser?.id === targetUser.id) {
        setSelectedUser(null);
      }
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      await fetchUsersData();
    } catch (err: any) {
      toast.error("Delete Failed", err.message || "Could not delete user account.");
    } finally {
      setIsDeleting((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  // ── Create User Handler ──
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = createName.trim();
    const cleanEmail = createEmail.trim();
    const cleanPassword = createPassword.trim();
    const cleanDept = createDept.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setCreateError("Please fill out all required fields.");
      return;
    }

    if (cleanPassword.length < 6) {
      setCreateError("Password must be at least 6 characters long.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const newUser = await api.adminCreateUser({
        full_name: cleanName,
        email: cleanEmail,
        department: cleanDept || "Port Operations",
        password: cleanPassword,
        role: createRole,
      });

      // Save user credentials so the admin can view and copy them
      saveUserCredential(newUser.id, cleanEmail, cleanPassword);

      // Re-fetch users from database to ensure persistence
      await fetchUsersData();

      toast.success(
        "User Created",
        `${newUser.full_name} was successfully created with role ${newUser.role.toUpperCase()}. Password has been saved.`
      );

      // Reset & close modal
      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreateDept("Quayside Operations");
      setCreatePassword("");
      setCreateRole("operations");
    } catch (err: any) {
      setCreateError(err.message || "Failed to register user account.");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Role Update Handler ──
  const handleRoleUpdate = async (userId: string, newRole: string) => {
    const userToUpdate = users.find((u) => u.id === userId);
    const confirmed = await confirm({
      title: "Change user access role?",
      description: `Are you sure you want to change ${userToUpdate?.full_name || "this user"}'s permissions to ${newRole.toUpperCase()}? This takes effect immediately.`,
      confirmText: "Update role",
      cancelText: "Cancel",
      variant: "warning",
    });

    if (!confirmed) return;

    setUpdateStatus((prev) => ({ ...prev, [userId]: "saving" }));
    try {
      const updated = await api.updateUserRole(userId, newRole);

      // 1. Update in the directory table list
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));

      // 2. If inspecting this user in profile modal, update profile modal view
      setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, role: updated.role } : prev));

      setUpdateStatus((prev) => ({ ...prev, [userId]: "saved" }));
      toast.success(
        "User role updated",
        `${userToUpdate?.full_name || "User"}'s role is now ${newRole.toUpperCase()}.`
      );

      setTimeout(() => {
        setUpdateStatus((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }, 2000);

      // 3. If user modified their own account, update session & notify AppShell
      const currentUserStr = localStorage.getItem("naviops_user");
      if (currentUserStr) {
        try {
          const current = JSON.parse(currentUserStr);
          if (current.id === userId) {
            const updatedCurrent = { ...current, role: newRole };
            localStorage.setItem("naviops_user", JSON.stringify(updatedCurrent));
            localStorage.setItem("naviops_role", newRole);
            setCurrentRole(newRole as UserRole);
            window.dispatchEvent(new CustomEvent("naviops_user_updated", { detail: updatedCurrent }));
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      toast.error("Failed to update role", err.message || "Action restricted.");
      setUpdateStatus((prev) => ({ ...prev, [userId]: "error" }));
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter((u) => u.role === "admin").length;
  const opsCount = users.filter((u) => u.role === "operations").length;
  const viewerCount = users.filter((u) => u.role === "viewer").length;

  return (
    <AppShell
      title="Personnel & Role-Based Access Control"
      description="Manage port personnel directory, assign operational privileges, and review access levels."
      onRefresh={fetchUsersData}
      isRefreshing={isLoading}
      allowedRoles={["admin"]}
    >

      {/* Admin View */}
      {currentRole === "admin" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-[#E3E5E0] bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5C6B68] uppercase tracking-wider">
                  Total Accounts
                </span>
                <Users className="h-4 w-4 text-[#899491]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#102A27]">{users.length}</div>
              <div className="text-[11px] text-[#5C6B68] mt-0.5">Active directory records</div>
            </div>

            <div className="rounded-lg border border-[#E3E5E0] bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#004741] uppercase tracking-wider">
                  Port Managers
                </span>
                <ShieldCheck className="h-4 w-4 text-[#004741]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#004741]">{adminCount}</div>
              <div className="text-[11px] text-[#5C6B68] mt-0.5">Full CRUD & Approval authority</div>
            </div>

            <div className="rounded-lg border border-[#E3E5E0] bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2F7D8C] uppercase tracking-wider">
                  Operations Staff
                </span>
                <UserCheck className="h-4 w-4 text-[#2F7D8C]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#2F7D8C]">{opsCount}</div>
              <div className="text-[11px] text-[#5C6B68] mt-0.5">Control center & Solver run</div>
            </div>

            <div className="rounded-lg border border-[#E3E5E0] bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5C6B68] uppercase tracking-wider">
                  Viewers (Read-Only)
                </span>
                <Eye className="h-4 w-4 text-[#5C6B68]" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#5C6B68]">{viewerCount}</div>
              <div className="text-[11px] text-[#5C6B68] mt-0.5">Executive & Stakeholder view</div>
            </div>
          </div>

          {/* Directory Filter & Search */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold text-[#102A27]">
                  Personnel Directory & Privilege Matrix
                </CardTitle>
                <p className="text-xs text-[#5C6B68] mt-0.5">
                  Manage port personnel accounts, assign operational roles, and review privileges.
                </p>
              </div>
              {/* In-page User Registration Button */}
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5 text-xs bg-[#004741] text-white hover:bg-[#003833]"
                onClick={() => {
                  setCreateError(null);
                  setIsCreateModalOpen(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create User
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by personnel name, email, or department..."
                    className="w-full rounded-lg border border-[#D5D9D3] px-3 py-2 pl-9 text-sm text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-medium text-[#5C6B68] whitespace-nowrap">
                    Role Filter:
                  </span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-lg border border-[#D5D9D3] bg-white px-3 py-2 text-xs font-medium text-[#5C6B68] focus:border-[#004741] focus:outline-none"
                  >
                    <option value="all">All Roles ({users.length})</option>
                    <option value="admin">Admin ({adminCount})</option>
                    <option value="operations">Operations ({opsCount})</option>
                    <option value="viewer">Viewer ({viewerCount})</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-lg border border-[#E3E5E0] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F7F6F2]/80">
                      <TableHead>User / Personnel</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Role Management (Admin Action)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-[#899491] text-xs">
                          No personnel found matching the query.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSaving = updateStatus[user.id] === "saving";
                        const isSaved = updateStatus[user.id] === "saved";

                        return (
                          <TableRow key={user.id} className="hover:bg-[#F7F6F2]/60 transition-colors">
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSelectedUser(user)}
                                className="flex items-center gap-3 text-left group focus:outline-none"
                                title="Click to view detailed profile"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EDE4] text-xs font-bold text-[#004741] border border-[#E3E5E0] group-hover:bg-[#E1EFEC] group-hover:border-[#C5DDD9] transition-colors">
                                  {user.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-[#102A27] text-sm group-hover:text-[#004741] transition-colors">
                                    {user.full_name}
                                  </div>
                                  <div className="text-xs text-[#5C6B68]">{user.email}</div>
                                </div>
                              </button>
                            </TableCell>

                            <TableCell className="text-xs font-medium text-[#5C6B68]">
                              {user.department || "Port Operations"}
                            </TableCell>

                            <TableCell>
                              {user.role === "admin" && (
                                <Badge variant="role" role="admin" size="sm" className="gap-1 font-semibold">
                                  <ShieldCheck className="h-3 w-3 text-[#004741]" />
                                  Port Manager (Admin)
                                </Badge>
                              )}
                              {user.role === "operations" && (
                                <Badge variant="role" role="operations" size="sm" className="gap-1 font-semibold">
                                  <UserCheck className="h-3 w-3 text-[#2F7D8C]" />
                                  Operations Staff
                                </Badge>
                              )}
                              {user.role === "viewer" && (
                                <Badge variant="role" role="viewer" size="sm" className="gap-1 font-medium">
                                  <Eye className="h-3 w-3 text-[#5C6B68]" />
                                  Viewer (Read-Only)
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <select
                                  value={user.role}
                                  onChange={(e) => handleRoleUpdate(user.id, e.target.value)}
                                  disabled={isSaving}
                                  className="rounded border border-[#D5D9D3] bg-white px-2.5 py-1 text-xs font-medium text-[#102A27] shadow-2xs hover:border-[#D5D9D3] focus:border-[#004741] focus:outline-none disabled:opacity-50"
                                >
                                  <option value="admin">Admin (Full Control)</option>
                                  <option value="operations">Operations Staff</option>
                                  <option value="viewer">Viewer (Read-Only)</option>
                                </select>

                                {isSaved && (
                                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Updated
                                  </span>
                                )}
                                {isSaving && (
                                  <span className="text-[11px] text-[#899491]">Saving...</span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedUser(user)}
                                  className="h-7 text-xs gap-1.5 text-[#004741] border-[#C5DDD9] hover:bg-[#E1EFEC]"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Profile
                                </Button>
                                {currentRole === "admin" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isDeleting[user.id] || user.id === currentUserId}
                                    onClick={() => handleDeleteUser(user)}
                                    className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                    title={user.id === currentUserId ? "Cannot delete your own account" : "Delete user"}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only">Delete</span>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* RBAC Policy Reference Card */}
              <div className="rounded-lg border border-[#E3E5E0] bg-[#F7F6F2]/70 p-4 mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C6B68] mb-2">
                  Role Privileges Reference
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded border border-[#E3E5E0]">
                    <span className="font-semibold text-[#004741] flex items-center gap-1 mb-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Port Manager / Admin
                    </span>
                    <p className="text-[#5C6B68] text-[11px]">
                      Full system access. Create, edit, delete vessels, berths, cranes, yards, and disruptions. Approve and apply 72h optimization schedules. Manage users and roles.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded border border-[#E3E5E0]">
                    <span className="font-semibold text-emerald-700 flex items-center gap-1 mb-1">
                      <UserCheck className="h-3.5 w-3.5" /> Operations Staff
                    </span>
                    <p className="text-[#5C6B68] text-[11px]">
                      Quayside control. Register incoming vessels, log active disruptions, trigger OR-Tools optimization solver. Cannot delete critical records or approve final schedule plans.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded border border-[#E3E5E0]">
                    <span className="font-semibold text-amber-700 flex items-center gap-1 mb-1">
                      <Eye className="h-3.5 w-3.5" /> Viewer / Executive
                    </span>
                    <p className="text-[#5C6B68] text-[11px]">
                      Read-only access. Can view port KPIs, congestion indices, Gantt charts, and disruption logs without modification rights.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*              MODAL: CREATE NEW USER                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!isCreating) {
            setIsCreateModalOpen(false);
            setCreateError(null);
          }
        }}
        title="Create New User"
        description="Create a user account with assigned operational role. Persisted directly in the database."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 pt-1">
          {createError && (
            <div className="flex items-start gap-2 rounded-xl border border-[#F2C4C3] bg-[#FCE9E8] p-3 text-xs text-[#B94A48]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#102A27] mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Capt. Sarah Jenkins"
                className="w-full rounded-lg border border-[#D5D9D3] bg-white py-2 pl-9 pr-3 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
              />
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102A27] mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="e.g. sjenkins@naviops.port"
                className="w-full rounded-lg border border-[#D5D9D3] bg-white py-2 pl-9 pr-3 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
              />
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102A27] mb-1">
              Department
            </label>
            <div className="relative">
              <input
                type="text"
                value={createDept}
                onChange={(e) => setCreateDept(e.target.value)}
                placeholder="e.g. Quayside Operations Control"
                className="w-full rounded-lg border border-[#D5D9D3] bg-white py-2 pl-9 pr-3 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
              />
              <Building className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102A27] mb-1">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-lg border border-[#D5D9D3] bg-white py-2 pl-9 pr-3 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
              />
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102A27] mb-1">
              Initial Operational Role
            </label>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-[#D5D9D3] bg-white px-3 py-2 text-xs font-medium text-[#102A27] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
            >
              <option value="operations">Operations Staff (Quayside control & solver execution)</option>
              <option value="admin">Port Manager / Admin (Full CRUD & approvals)</option>
              <option value="viewer">Viewer (Read-only metrics & dashboard access)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F0EDE4]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isCreating}
              className="gap-1.5 bg-[#004741] text-white hover:bg-[#003833]"
            >
              {isCreating ? (
                <>Registering Personnel...</>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Create User
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*            MODAL: PERSONNEL PROFILE & OPERATIONAL CLEARANCES     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => {
            setSelectedUser(null);
            setShowPassword(false);
            setIsResettingPassword(false);
            setNewPasswordInput("");
            setPasswordUpdateError(null);
          }}
          title="Personnel Profile & Operational Credentials"
          description="View sign-in credentials, manage access passwords, and review live operational privileges."
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            {/* Header Badge & Identity */}
            <div className="flex items-center gap-3.5 p-3.5 bg-[#F7F6F2] rounded-xl border border-[#E3E5E0]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#004741] text-base font-bold text-white shadow-sm">
                {selectedUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[#102A27] text-sm truncate">
                    {selectedUser.full_name}
                  </h3>
                  {selectedUser.role === "admin" && (
                    <Badge variant="role" role="admin" size="sm" className="gap-1 font-semibold">
                      <ShieldCheck className="h-3 w-3 text-[#004741]" />
                      Port Manager (Admin)
                    </Badge>
                  )}
                  {selectedUser.role === "operations" && (
                    <Badge variant="role" role="operations" size="sm" className="gap-1 font-semibold">
                      <UserCheck className="h-3 w-3 text-[#2F7D8C]" />
                      Operations Staff
                    </Badge>
                  )}
                  {selectedUser.role === "viewer" && (
                    <Badge variant="role" role="viewer" size="sm" className="gap-1 font-medium">
                      <Eye className="h-3 w-3 text-[#5C6B68]" />
                      Viewer (Read-Only)
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[#5C6B68] mt-0.5 font-medium">{selectedUser.email}</div>
                <div className="text-[11px] text-[#899491] flex items-center gap-1 mt-0.5">
                  <Building className="h-3 w-3" />
                  {selectedUser.department || "Port Operations"}
                </div>
              </div>
            </div>

            {/* ── Sign-In & Access Credentials Card ── */}
            <div className="rounded-xl border border-[#A2D9D1] bg-[#F0FAF7] p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#D0EDE7]">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#004741] text-white">
                    <Key className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#102A27]">
                      Sign-In &amp; Account Credentials
                    </h4>
                    <p className="text-[10px] text-[#5C6B68]">
                      Account identity and operational credentials.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const pass = getDisplayPassword(selectedUser);
                    const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
                    const credText = `NaviOps Port Orchestration Portal Credentials\n• Personnel Name: ${selectedUser.full_name}\n• Email / Login ID: ${selectedUser.email}\n• Password: ${pass}\n• Assigned Role: ${selectedUser.role.toUpperCase()}\n• Department: ${selectedUser.department || "Port Operations"}\n• Sign-In URL: ${portalUrl}`;
                    copyToClipboard(credText, "all", "All credentials");
                  }}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1 text-[#004741] border-[#A2D9D1] bg-white hover:bg-[#E1EFEC]"
                >
                  {copiedField === "all" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" /> Copied Details!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy All Credentials
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                {/* Full Name / Username */}
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-[#E3E5E0]">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#899491] block">
                      User Name / Full Name
                    </span>
                    <span className="font-semibold text-[#102A27] text-xs truncate block">
                      {selectedUser.full_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedUser.full_name, "name", "Full Name")}
                    className="p-1.5 text-[#5C6B68] hover:text-[#004741] hover:bg-[#F0FAF7] rounded transition-colors"
                    title="Copy Name"
                  >
                    {copiedField === "name" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Email Address / Login ID */}
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-[#E3E5E0]">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#899491] block">
                      Email Address (Login ID)
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#102A27] truncate block">
                      {selectedUser.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedUser.email, "email", "Email Address")}
                    className="p-1.5 text-[#5C6B68] hover:text-[#004741] hover:bg-[#F0FAF7] rounded transition-colors"
                    title="Copy Email"
                  >
                    {copiedField === "email" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Password - Viewable / Toggleable & Copyable */}
                <div className="bg-white px-3 py-2 rounded-lg border border-[#E3E5E0]">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-[#899491] block">
                        Password
                      </span>
                      <span className="font-mono text-xs font-bold text-[#102A27] tracking-wider block mt-0.5">
                        {showPassword ? getDisplayPassword(selectedUser) : "••••••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="p-1.5 text-[#5C6B68] hover:text-[#004741] hover:bg-[#F0FAF7] rounded transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(getDisplayPassword(selectedUser), "password", "Password")}
                        className="p-1.5 text-[#5C6B68] hover:text-[#004741] hover:bg-[#F0FAF7] rounded transition-colors"
                        title="Copy Password"
                      >
                        {copiedField === "password" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Reset / Set Password toggle */}
                <div className="pt-1">
                  {!isResettingPassword ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsResettingPassword(true);
                        setNewPasswordInput("");
                        setPasswordUpdateError(null);
                      }}
                      className="text-[11px] font-semibold text-[#004741] hover:underline flex items-center gap-1"
                    >
                      <Key className="h-3 w-3" /> Reset / Set New Password
                    </button>
                  ) : (
                    <div className="p-3 bg-white rounded-lg border border-[#D5D9D3] space-y-2 mt-1">
                      <div className="text-xs font-semibold text-[#102A27]">Set New Password</div>
                      {passwordUpdateError && (
                        <div className="text-[11px] text-rose-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {passwordUpdateError}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          placeholder="Enter new password (min 6 chars)"
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          className="flex-1 rounded border border-[#D5D9D3] bg-white px-2.5 py-1.5 text-xs text-[#102A27] focus:border-[#004741] focus:outline-none"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isPasswordUpdating || newPasswordInput.trim().length < 6}
                          onClick={() => handleResetPassword(selectedUser.id, selectedUser.email)}
                          className="h-7 text-xs bg-[#004741] text-white hover:bg-[#003833]"
                        >
                          {isPasswordUpdating ? "Saving..." : "Save Password"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsResettingPassword(false);
                            setPasswordUpdateError(null);
                          }}
                          className="h-7 text-xs text-[#5C6B68]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Account Metadata Details */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-[#E3E5E0]">
                <span className="text-[10px] uppercase font-bold text-[#899491] block">
                  Account ID
                </span>
                <span className="font-mono text-[11px] text-[#102A27] truncate block mt-0.5">
                  {selectedUser.id}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-[#E3E5E0]">
                <span className="text-[10px] uppercase font-bold text-[#899491] block">
                  Member Status
                </span>
                <span className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active Personnel
                </span>
              </div>
            </div>

            {/* Live Role Privilege Checklist */}
            <div className="rounded-lg border border-[#E3E5E0] bg-white p-3 space-y-2 text-xs">
              <div className="font-semibold text-[#102A27] flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#004741]" />
                Operational Clearances & Permissions:
              </div>

              <div className="space-y-1.5 pt-1 text-[11px]">
                {selectedUser.role === "admin" && (
                  <>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Full CRUD Authority:</strong> Vessels, Berths, Cranes, Yards, Disruptions</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Optimization Schedule Approval:</strong> Authority to approve & apply 72h plans</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Personnel Administration:</strong> Register users & modify security roles</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Bob Copilot Super-User:</strong> Live operational queries & optimization runs</span>
                    </div>
                  </>
                )}

                {selectedUser.role === "operations" && (
                  <>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Quayside Control:</strong> Update vessel turnaround & status in real-time</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>CP-SAT Solver Execution:</strong> Trigger optimization runs to generate proposed schedules</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Disruption Reporting:</strong> Log crane outages, maintenance & adverse weather</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#899491]">
                      <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span><strong>Schedule Approval Restricted:</strong> Final application requires Port Manager</span>
                    </div>
                  </>
                )}

                {selectedUser.role === "viewer" && (
                  <>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>Live Overview:</strong> Real-time Port Congestion Index and operational KPIs</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#102A27]">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span><strong>72h Timeline:</strong> Berth occupancy Gantt chart and vessel queue inspection</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#899491]">
                      <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span><strong>Read-Only Mode:</strong> Restricted from modifying port resources or schedules</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Role Change Inside Profile */}
            <div className="p-3 bg-[#F7F6F2] rounded-lg border border-[#E3E5E0] space-y-2">
              <label className="block text-xs font-semibold text-[#102A27]">
                Update Profile Role:
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedUser.role}
                  onChange={(e) => handleRoleUpdate(selectedUser.id, e.target.value)}
                  className="flex-1 rounded border border-[#D5D9D3] bg-white px-2.5 py-1.5 text-xs font-medium text-[#102A27] focus:border-[#004741] focus:outline-none"
                >
                  <option value="admin">Port Manager / Admin (Full Access)</option>
                  <option value="operations">Operations Staff (Quayside & Solver)</option>
                  <option value="viewer">Viewer / Executive (Read-Only)</option>
                </select>

                {updateStatus[selectedUser.id] === "saved" && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 shrink-0">
                    <CheckCircle2 className="h-4 w-4" /> Updated
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#5C6B68]">
                Changes take effect across the entire system immediately.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E3E5E0]">
              {currentRole === "admin" && selectedUser.id !== currentUserId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting[selectedUser.id]}
                  onClick={() => handleDeleteUser(selectedUser)}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete User Account
                </Button>
              ) : (
                <div />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUser(null)}
              >
                Close Profile
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}


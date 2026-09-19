"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AssetTabs } from "@/components/layout/asset-tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/design-system/table";
import { Badge } from "@/design-system/badge";
import { AddVesselModal } from "@/components/dialogs/add-vessel-modal";
import { UpdateResourceModal } from "@/components/dialogs/update-resource-modal";
import { api } from "@/lib/api";
import { Vessel, Berth } from "@/types";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { Ship, Plus, Edit2, Trash2, Anchor, Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/design-system/toast";
import { useConfirm } from "@/components/design-system/confirm-dialog";

export default function VesselsPage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("operations");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [updateModal, setUpdateModal] = useState<{ isOpen: boolean; vessel: Vessel | null }>({
    isOpen: false,
    vessel: null,
  });
  const toast = useToast();
  const confirm = useConfirm();

  const loadVessels = async () => {
    if (typeof window !== "undefined") {
      setCurrentRole(localStorage.getItem("naviops_role") || "operations");
    }
    try {
      const [vList, bList] = await Promise.all([api.getVessels(), api.getBerths()]);
      setVessels(vList);
      setBerths(bList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVessels();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Delete vessel?",
      description: `This will permanently remove ${name} from the fleet registry and queue. This action cannot be undone.`,
      confirmText: "Delete vessel",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      await api.deleteVessel(id);
      setVessels((prev) => prev.filter((v) => v.id !== id));
      loadVessels();
    } catch (err: any) {
      toast.error("Unable to delete vessel", err.message || "Action restricted.");
    }
  };

  const filtered = vessels.filter((v) => {
    const matchesFilter = filter === "all" || v.status.toLowerCase() === filter.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      v.vessel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vessel_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.shipping_line.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const toggleRow = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <AppShell
      title="Asset Directory: Vessels Fleet"
      description="Fleet registry, technical specifications, carrier lines, and arrival itineraries."
      onRefresh={loadVessels}
      allowedRoles={["admin", "operations", "viewer"]}
    >
      {/* Shared Asset Navigation Tabs */}
      <AssetTabs />

      {/* Action & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-[#E3E5E0] bg-white p-3.5 shadow-card mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#899491]" />
            <input
              type="text"
              placeholder="Search vessel or carrier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#D5D9D3] bg-[#F7F6F2] pl-8 pr-2.5 py-1.5 text-xs text-[#102A27] placeholder-[#899491] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#004741] focus:border-[#004741]"
            />
          </div>

          <select
            className="rounded-lg border border-[#D5D9D3] bg-[#F7F6F2] px-2.5 py-1.5 text-xs font-medium text-[#5C6B68] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#004741] cursor-pointer"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Statuses ({vessels.length})</option>
            <option value="Waiting">Waiting ({vessels.filter((v) => v.status === "Waiting").length})</option>
            <option value="Unloading">Unloading ({vessels.filter((v) => v.status === "Unloading").length})</option>
            <option value="Loading">Loading ({vessels.filter((v) => v.status === "Loading").length})</option>
            <option value="Scheduled">Scheduled ({vessels.filter((v) => v.status === "Scheduled").length})</option>
            <option value="Delayed">Delayed ({vessels.filter((v) => v.status === "Delayed").length})</option>
          </select>
        </div>

        {currentRole !== "viewer" && (
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#004741] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#003B36] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Vessel</span>
          </button>
        )}
      </div>

      {/* Vessel Fleet Table */}
      <div className="rounded-xl border border-[#E3E5E0] bg-white shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Vessel / IMO</TableHead>
              <TableHead>Carrier Line</TableHead>
              <TableHead>Cargo Type</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned Berth</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={10} message="No vessels found matching criteria." />
            ) : (
              filtered.map((v) => {
                const assignedBerth = berths.find((b) => b.id === v.assigned_berth_id);
                const isExpanded = expandedId === v.id;

                return (
                  <React.Fragment key={v.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-[#F7F9F8]",
                        isExpanded && "bg-[#F7F6F2]"
                      )}
                      onClick={() => toggleRow(v.id)}
                    >
                      <TableCell className="w-8 text-center text-[#899491]">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 mx-auto" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-[#102A27]">
                        <div>{v.vessel_name}</div>
                        <div className="text-[11px] font-mono font-normal text-[#899491]">
                          {v.vessel_code}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-[#102A27] text-xs">
                        {v.shipping_line}
                      </TableCell>
                      <TableCell className="text-[#5C6B68] text-xs">{v.cargo_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {(v.cargo_volume ?? 0).toLocaleString()} TEU
                      </TableCell>
                      <TableCell className="text-xs text-[#5C6B68]">
                        {v.eta ? formatDateTime(v.eta) : "Arrived"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="priority" priority={v.priority} size="sm" />
                      </TableCell>
                      <TableCell className="text-xs font-medium text-[#102A27]">
                        {assignedBerth ? (
                          <span className="inline-flex items-center gap-1 text-[#004741]">
                            <Anchor className="h-3 w-3 text-[#004741]" />
                            {assignedBerth.berth_code}
                          </span>
                        ) : (
                          <span className="text-[#899491] italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="status" status={v.status} context="vessel" size="sm">
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {currentRole !== "viewer" && (
                            <button
                              type="button"
                              onClick={() => setUpdateModal({ isOpen: true, vessel: v })}
                              className="rounded p-1 text-[#899491] hover:bg-[#F0EDE4] hover:text-[#5C6B68] transition-colors"
                              title="Edit vessel operational status"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {currentRole === "admin" && (
                            <button
                              type="button"
                              onClick={() => handleDelete(v.id, v.vessel_name)}
                              className="rounded p-1 text-[#899491] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete vessel (Admin Only)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {currentRole === "viewer" && (
                            <span className="text-[11px] text-[#899491] italic">Read-Only</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Specifications Row */}
                    {isExpanded && (
                      <TableRow className="bg-[#F7F6F2] border-t border-[#F0EDE4]">
                        <TableCell colSpan={10} className="py-3 px-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#899491] block">
                                Vessel Length
                              </span>
                              <span className="font-semibold text-[#102A27] mt-0.5 block">
                                {v.vessel_length} meters
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#899491] block">
                                Estimated Departure (ETD)
                              </span>
                              <span className="font-semibold text-[#102A27] mt-0.5 block">
                                {formatDateTime(v.etd)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#899491] block">
                                Expected Wait Time
                              </span>
                              <span className="font-semibold text-[#102A27] mt-0.5 block">
                                {v.expected_waiting_time > 0
                                  ? formatDuration(v.expected_waiting_time)
                                  : "0 hours"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#899491] block">
                                Actual Arrival Time
                              </span>
                              <span className="font-semibold text-[#102A27] mt-0.5 block">
                                {v.arrival_time ? formatDateTime(v.arrival_time) : "Pending Entry"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddVesselModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={loadVessels}
      />

      {updateModal.isOpen && updateModal.vessel && (
        <UpdateResourceModal
          isOpen={updateModal.isOpen}
          onClose={() => setUpdateModal({ isOpen: false, vessel: null })}
          onSuccess={loadVessels}
          resourceType="vessel"
          resource={updateModal.vessel}
        />
      )}
    </AppShell>
  );
}

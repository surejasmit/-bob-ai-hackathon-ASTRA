"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Ship,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Filter,
  FileSpreadsheet,
  ArrowRight,
  Anchor,
  Compass,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { CustomerVessel } from "@/types/customer";

export default function CustomerVesselsPage() {
  const [vessels, setVessels] = useState<CustomerVessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVessel, setEditingVessel] = useState<CustomerVessel | null>(null);
  const [formData, setFormData] = useState({
    vessel_name: "",
    imo_number: "",
    vessel_type: "Container",
    length_loa: 300.0,
    beam: 40.0,
    draft: 12.5,
    gross_tonnage: 85000,
    deadweight_tonnage: 105000,
    flag: "Singapore",
    operator_name: "",
    cargo_type: "Container",
    cargo_capacity: 7500,
    hazardous_cargo: false,
    special_handling_requirements: "",
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadVessels = async () => {
    try {
      setLoading(true);
      const list = await customerApi.getVessels();
      setVessels(list);
    } catch (err) {
      console.error("Failed to load vessels:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVessels();
  }, []);

  const openAddModal = () => {
    setEditingVessel(null);
    setFormData({
      vessel_name: "",
      imo_number: "",
      vessel_type: "Container",
      length_loa: 300.0,
      beam: 40.0,
      draft: 12.5,
      gross_tonnage: 85000,
      deadweight_tonnage: 105000,
      flag: "Singapore",
      operator_name: "",
      cargo_type: "Container",
      cargo_capacity: 7500,
      hazardous_cargo: false,
      special_handling_requirements: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (v: CustomerVessel) => {
    setEditingVessel(v);
    setFormData({
      vessel_name: v.vessel_name,
      imo_number: v.imo_number,
      vessel_type: v.vessel_type,
      length_loa: v.length_loa,
      beam: v.beam,
      draft: v.draft,
      gross_tonnage: v.gross_tonnage,
      deadweight_tonnage: v.deadweight_tonnage,
      flag: v.flag,
      operator_name: v.operator_name || "",
      cargo_type: v.cargo_type,
      cargo_capacity: v.cargo_capacity,
      hazardous_cargo: v.hazardous_cargo,
      special_handling_requirements: v.special_handling_requirements || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.vessel_name || !formData.imo_number || !formData.flag) {
      setFormError("Please fill out all required fields.");
      return;
    }
    if (formData.length_loa <= 0 || formData.beam <= 0 || formData.draft <= 0) {
      setFormError("Vessel dimensions must be positive numbers.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingVessel) {
        await customerApi.updateVessel(editingVessel.id, formData);
      } else {
        await customerApi.createVessel(formData);
      }
      setIsModalOpen(false);
      await loadVessels();
    } catch (err: any) {
      setFormError(err.message || "Failed to save vessel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vessel: CustomerVessel) => {
    if (!confirm(`Remove vessel '${vessel.vessel_name}' from company fleet?`)) return;
    try {
      await customerApi.deleteVessel(vessel.id);
      await loadVessels();
    } catch (err: any) {
      alert(err.message || "Failed to delete vessel.");
    }
  };

  const filteredVessels = vessels.filter((v) => {
    const matchesSearch =
      v.vessel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.imo_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.flag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || v.vessel_type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  const inputClass =
    "w-full rounded-xl border border-[#16364D] bg-[#071926] px-3.5 py-2.5 text-xs text-white placeholder:text-[#5E83A1] focus:bg-[#092233] focus:border-[#009688] focus:outline-none focus:ring-1 focus:ring-[#009688]";

  return (
    <CustomerShell
      title="Company Fleet (My Vessels)"
      subtitle="Manage authorized company vessels eligible for NaviOps port arrival requests."
      actions={
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white font-bold text-xs shadow-lg shadow-[#009688]/25 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Register New Vessel</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* ── Search & Filters Bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-[#091E2C] border border-[#13344A]">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vessel name, IMO, flag..."
              className="w-full rounded-xl border border-[#16364D] bg-[#061520] px-3.5 py-2 pl-9 text-xs text-white placeholder:text-[#5E83A1] focus:outline-none focus:border-[#009688]"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5E83A1]" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-[#5E83A1]" />
            <span className="text-xs text-[#7BA1BF]">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-[#16364D] bg-[#061520] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#009688]"
            >
              <option value="all">All Vessel Types</option>
              <option value="Container">Container</option>
              <option value="Bulk Carrier">Bulk Carrier</option>
              <option value="Tanker">Tanker</option>
              <option value="General Cargo">General Cargo</option>
              <option value="Ro-Ro">Ro-Ro</option>
            </select>
          </div>
        </div>

        {/* ── Fleet Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVessels.length === 0 ? (
            <div className="col-span-full py-16 text-center rounded-3xl bg-[#091E2C] border border-[#13344A] text-[#6D94B5]">
              <Ship className="h-10 w-10 mx-auto mb-3 text-[#224A66]" />
              <p className="font-semibold text-sm">No vessels match your criteria.</p>
              <p className="text-xs mt-1">Register a vessel to submit arrival requests.</p>
            </div>
          ) : (
            filteredVessels.map((v) => (
              <div
                key={v.id}
                className="rounded-3xl bg-[#091E2C] border border-[#143952] hover:border-[#009688]/60 transition-all p-5 shadow-lg flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-2xl bg-[#0F3550] flex items-center justify-center text-[#38BDF8] border border-[#1A4B70] group-hover:scale-105 transition-transform">
                        <Ship className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm group-hover:text-[#2DD4BF] transition-colors">
                          {v.vessel_name}
                        </h3>
                        <p className="text-[11px] font-mono text-[#6D94B5]">{v.imo_number}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#009688]/20 text-[#34D399] border border-[#009688]/30">
                      {v.vessel_type}
                    </span>
                  </div>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#13344A]/80 my-3 text-center">
                    <div className="bg-[#071926] p-2 rounded-xl border border-[#122E42]">
                      <span className="text-[10px] text-[#6D94B5] block uppercase font-semibold">LOA</span>
                      <span className="text-xs font-bold text-white">{v.length_loa}m</span>
                    </div>
                    <div className="bg-[#071926] p-2 rounded-xl border border-[#122E42]">
                      <span className="text-[10px] text-[#6D94B5] block uppercase font-semibold">Beam</span>
                      <span className="text-xs font-bold text-white">{v.beam}m</span>
                    </div>
                    <div className="bg-[#071926] p-2 rounded-xl border border-[#122E42]">
                      <span className="text-[10px] text-[#6D94B5] block uppercase font-semibold">Draft</span>
                      <span className="text-xs font-bold text-[#38BDF8]">{v.draft}m</span>
                    </div>
                  </div>

                  {/* Operational Details */}
                  <div className="space-y-1.5 text-xs text-[#8AB1D1]">
                    <div className="flex justify-between">
                      <span className="text-[#6D94B5]">Flag:</span>
                      <span className="font-semibold text-white">{v.flag}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6D94B5]">Deadweight:</span>
                      <span className="font-semibold text-white">
                        {v.deadweight_tonnage.toLocaleString()} DWT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6D94B5]">Cargo Capacity:</span>
                      <span className="font-semibold text-white">
                        {v.cargo_capacity.toLocaleString()} {v.vessel_type === "Container" ? "TEU" : "MT"}
                      </span>
                    </div>
                    {v.hazardous_cargo && (
                      <div className="pt-1 text-[11px] text-[#FBBF24] font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Hazardous Cargo Certified (IMDG)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-[#13344A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(v)}
                      className="p-1.5 rounded-lg text-[#6D94B5] hover:text-white hover:bg-[#0E2E44] transition-all"
                      title="Edit Vessel Specs"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(v)}
                      className="p-1.5 rounded-lg text-[#6D94B5] hover:text-[#EF4444] hover:bg-[#1A1A28] transition-all"
                      title="Delete Vessel"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Link
                    href={`/customer/arrival-requests/new?vessel_id=${v.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#009688] hover:bg-[#007F73] px-3 py-1.5 rounded-xl shadow-md transition-all"
                  >
                    <span>Request Arrival</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Vessel Add / Edit Modal Dialog ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-[#091E2C] border border-[#174666] shadow-2xl p-6 sm:p-7 relative animate-in fade-in-50 zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#13344A] mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  {editingVessel ? "Edit Registered Vessel" : "Register New Fleet Vessel"}
                </h3>
                <p className="text-xs text-[#7BA1BF] mt-0.5">
                  Vessel dimensions are used by the NaviOps Feasibility and CP-SAT scheduler.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6D94B5] hover:text-white hover:bg-[#0E2E44]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-[#7F1D1D]/30 border border-[#DC2626]/50 text-[#FCA5A5] text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Vessel Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vessel_name}
                    onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                    placeholder="e.g. MV Neptune"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    IMO Number *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingVessel}
                    value={formData.imo_number}
                    onChange={(e) => setFormData({ ...formData, imo_number: e.target.value })}
                    placeholder="IMO-9812345"
                    className={`${inputClass} ${editingVessel ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Vessel Type *
                  </label>
                  <select
                    value={formData.vessel_type}
                    onChange={(e) => setFormData({ ...formData, vessel_type: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Container">Container</option>
                    <option value="Bulk Carrier">Bulk Carrier</option>
                    <option value="Tanker">Tanker</option>
                    <option value="General Cargo">General Cargo</option>
                    <option value="Ro-Ro">Ro-Ro</option>
                    <option value="LPG/LNG">LPG/LNG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Flag State *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.flag}
                    onChange={(e) => setFormData({ ...formData, flag: e.target.value })}
                    placeholder="Singapore"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Physical Dimensions */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    LOA (m) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={formData.length_loa}
                    onChange={(e) => setFormData({ ...formData, length_loa: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Beam (m) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={formData.beam}
                    onChange={(e) => setFormData({ ...formData, beam: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Max Draft (m) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={formData.draft}
                    onChange={(e) => setFormData({ ...formData, draft: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Tonnage & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Deadweight (DWT) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.deadweight_tonnage}
                    onChange={(e) => setFormData({ ...formData, deadweight_tonnage: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Gross Tonnage (GT)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.gross_tonnage}
                    onChange={(e) => setFormData({ ...formData, gross_tonnage: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                    Capacity (TEU / MT)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.cargo_capacity}
                    onChange={(e) => setFormData({ ...formData, cargo_capacity: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Hazardous & Special Handling */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={formData.hazardous_cargo}
                    onChange={(e) => setFormData({ ...formData, hazardous_cargo: e.target.checked })}
                    className="h-4 w-4 rounded border-[#16364D] bg-[#071926] text-[#009688] focus:ring-0"
                  />
                  <span>Vessel carries hazardous materials / IMDG declared cargo</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8AB1D1] mb-1">
                  Special Handling Requirements
                </label>
                <textarea
                  rows={2}
                  value={formData.special_handling_requirements}
                  onChange={(e) => setFormData({ ...formData, special_handling_requirements: e.target.value })}
                  placeholder="e.g. Dual crane gang required, continuous belt unloader, bunkering needed..."
                  className={inputClass}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#13344A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#0E2E44] hover:bg-[#16476B] text-white text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white text-xs font-bold shadow-lg shadow-[#009688]/30 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? "Saving..." : editingVessel ? "Update Vessel" : "Register Vessel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

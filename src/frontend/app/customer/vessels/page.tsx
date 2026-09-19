"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Ship,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { CustomerVessel } from "@/types/customer";
import { Button } from "@/components/design-system/button";
import { Badge } from "@/components/design-system/badge";
import { Modal } from "@/components/design-system/modal";
import { FormField, Input, Select, Textarea } from "@/components/design-system/form-field";

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

  const handleDelete = async (v: CustomerVessel) => {
    if (!confirm(`Are you sure you want to delete vessel '${v.vessel_name}'?`)) return;
    try {
      await customerApi.deleteVessel(v.id);
      await loadVessels();
    } catch (err: any) {
      alert(err.message || "Failed to delete vessel.");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (editingVessel) {
        await customerApi.updateVessel(editingVessel.id, formData);
      } else {
        await customerApi.createVessel(formData);
      }
      setIsModalOpen(false);
      await loadVessels();
    } catch (err: any) {
      setFormError(err.message || "Failed to save vessel details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVessels = vessels.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      v.vessel_name.toLowerCase().includes(q) ||
      v.imo_number.toLowerCase().includes(q) ||
      v.flag.toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || v.vessel_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <CustomerShell
      title="Company Vessel Fleet"
      subtitle="Register, inspect physical dimensions, and manage carrier vessels eligible for port arrival requests."
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={openAddModal}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Register Vessel
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ── Toolbar: Search & Filter ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-xl border border-[#E3E5E0] bg-white shadow-card">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#899491]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vessel name, IMO, flag..."
              className="w-full rounded-lg border border-[#D5D9D3] bg-white px-3 py-1.5 pl-9 text-xs text-[#102A27] placeholder:text-[#899491] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-[#5C6B68]" />
            <span className="text-xs font-semibold text-[#5C6B68]">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[#D5D9D3] bg-white px-3 py-1.5 text-xs text-[#102A27] focus:border-[#004741] focus:outline-none focus:ring-1 focus:ring-[#004741]"
            >
              <option value="all">All Vessel Types</option>
              <option value="Container">Container</option>
              <option value="Bulk Carrier">Bulk Carrier</option>
              <option value="Tanker">Tanker</option>
              <option value="General Cargo">General Cargo</option>
              <option value="Ro-Ro">Ro-Ro</option>
              <option value="LPG/LNG">LPG/LNG</option>
            </select>
          </div>
        </div>

        {/* ── Fleet Cards Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-[#5C6B68]">
              Loading fleet vessels...
            </div>
          ) : filteredVessels.length === 0 ? (
            <div className="col-span-full py-16 text-center rounded-xl border border-dashed border-[#D5DCDA] bg-white p-8 text-[#5C6B68]">
              <Ship className="h-10 w-10 mx-auto mb-2 text-[#899491]" />
              <p className="font-semibold text-sm text-[#102A27]">No vessels match your criteria</p>
              <p className="text-xs text-[#899491] mt-1">Register a vessel to submit arrival requests.</p>
            </div>
          ) : (
            filteredVessels.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-[#E3E5E0] bg-white p-5 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-[#E1EFEC] flex items-center justify-center text-[#004741]">
                        <Ship className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#102A27] text-sm">
                          {v.vessel_name}
                        </h3>
                        <p className="text-[11px] font-mono text-[#899491]">{v.imo_number}</p>
                      </div>
                    </div>
                    <Badge variant="outline" size="sm">
                      {v.vessel_type}
                    </Badge>
                  </div>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#F0EDE4] my-3 text-center">
                    <div className="bg-[#F7F6F2] p-2 rounded-lg border border-[#E3E5E0]">
                      <span className="text-[10px] text-[#5C6B68] block uppercase font-semibold">LOA</span>
                      <span className="text-xs font-bold text-[#102A27]">{v.length_loa}m</span>
                    </div>
                    <div className="bg-[#F7F6F2] p-2 rounded-lg border border-[#E3E5E0]">
                      <span className="text-[10px] text-[#5C6B68] block uppercase font-semibold">Beam</span>
                      <span className="text-xs font-bold text-[#102A27]">{v.beam}m</span>
                    </div>
                    <div className="bg-[#F7F6F2] p-2 rounded-lg border border-[#E3E5E0]">
                      <span className="text-[10px] text-[#5C6B68] block uppercase font-semibold">Draft</span>
                      <span className="text-xs font-bold text-[#004741]">{v.draft}m</span>
                    </div>
                  </div>

                  {/* Operational Details */}
                  <div className="space-y-1.5 text-xs text-[#5C6B68]">
                    <div className="flex justify-between">
                      <span className="text-[#899491]">Flag State:</span>
                      <span className="font-semibold text-[#102A27]">{v.flag}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#899491]">Deadweight:</span>
                      <span className="font-semibold text-[#102A27]">
                        {v.deadweight_tonnage.toLocaleString()} DWT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#899491]">Capacity:</span>
                      <span className="font-semibold text-[#102A27]">
                        {v.cargo_capacity.toLocaleString()} {v.vessel_type === "Container" ? "TEU" : "MT"}
                      </span>
                    </div>
                    {v.hazardous_cargo && (
                      <div className="pt-1 text-[11px] text-[#C58A2B] font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Hazardous Cargo Certified (IMDG)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[#F0EDE4] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(v)}
                      className="p-1.5 rounded-lg text-[#899491] hover:text-[#004741] hover:bg-[#F7F6F2] transition-colors"
                      title="Edit Vessel Specs"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v)}
                      className="p-1.5 rounded-lg text-[#899491] hover:text-[#B94A48] hover:bg-[#FCE9E8] transition-colors"
                      title="Delete Vessel"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Link href={`/customer/arrival-requests/new?vessel_id=${v.id}`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ArrowRight className="h-3 w-3" />}
                    >
                      Request Arrival
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Vessel Add / Edit Modal Dialog ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVessel ? "Edit Registered Vessel" : "Register New Fleet Vessel"}
        description="Vessel dimensions are used by NaviOps Feasibility and CP-SAT scheduler."
        maxWidth="xl"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-[#FCE9E8] border border-[#F2C4C3] text-[#B94A48] text-xs font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Vessel Name" required>
              <Input
                type="text"
                required
                value={formData.vessel_name}
                onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                placeholder="e.g. MV Neptune"
              />
            </FormField>
            <FormField label="IMO Number" required>
              <Input
                type="text"
                required
                disabled={!!editingVessel}
                value={formData.imo_number}
                onChange={(e) => setFormData({ ...formData, imo_number: e.target.value })}
                placeholder="IMO-9812345"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Vessel Type" required>
              <Select
                value={formData.vessel_type}
                onChange={(e) => setFormData({ ...formData, vessel_type: e.target.value })}
              >
                <option value="Container">Container</option>
                <option value="Bulk Carrier">Bulk Carrier</option>
                <option value="Tanker">Tanker</option>
                <option value="General Cargo">General Cargo</option>
                <option value="Ro-Ro">Ro-Ro</option>
                <option value="LPG/LNG">LPG/LNG</option>
              </Select>
            </FormField>
            <FormField label="Flag State" required>
              <Input
                type="text"
                required
                value={formData.flag}
                onChange={(e) => setFormData({ ...formData, flag: e.target.value })}
                placeholder="Singapore"
              />
            </FormField>
          </div>

          {/* Physical Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="LOA (m)" required>
              <Input
                type="number"
                step="0.1"
                min="1"
                required
                value={formData.length_loa}
                onChange={(e) => setFormData({ ...formData, length_loa: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Beam (m)" required>
              <Input
                type="number"
                step="0.1"
                min="1"
                required
                value={formData.beam}
                onChange={(e) => setFormData({ ...formData, beam: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Max Draft (m)" required>
              <Input
                type="number"
                step="0.1"
                min="1"
                required
                value={formData.draft}
                onChange={(e) => setFormData({ ...formData, draft: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          {/* Tonnage & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Deadweight (DWT)" required>
              <Input
                type="number"
                min="1"
                required
                value={formData.deadweight_tonnage}
                onChange={(e) => setFormData({ ...formData, deadweight_tonnage: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Gross Tonnage (GT)">
              <Input
                type="number"
                min="1"
                value={formData.gross_tonnage}
                onChange={(e) => setFormData({ ...formData, gross_tonnage: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Capacity (TEU / MT)">
              <Input
                type="number"
                min="1"
                value={formData.cargo_capacity}
                onChange={(e) => setFormData({ ...formData, cargo_capacity: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          {/* Hazardous & Special Handling */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#102A27]">
              <input
                type="checkbox"
                checked={formData.hazardous_cargo}
                onChange={(e) => setFormData({ ...formData, hazardous_cargo: e.target.checked })}
                className="h-4 w-4 rounded border-[#D5D9D3] text-[#004741] focus:ring-[#004741]"
              />
              <span>Vessel carries hazardous materials / IMDG declared cargo</span>
            </label>
          </div>

          <FormField label="Special Handling Requirements">
            <Textarea
              rows={2}
              value={formData.special_handling_requirements}
              onChange={(e) => setFormData({ ...formData, special_handling_requirements: e.target.value })}
              placeholder="e.g. Dual crane gang required, continuous belt unloader, bunkering needed..."
            />
          </FormField>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#F0EDE4]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {editingVessel ? "Update Vessel" : "Register Vessel"}
            </Button>
          </div>
        </form>
      </Modal>
    </CustomerShell>
  );
}

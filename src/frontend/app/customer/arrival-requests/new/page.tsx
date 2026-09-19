"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ship,
  Calendar,
  Clock,
  Compass,
  Anchor,
  Cpu,
  Boxes,
  ArrowLeft,
  AlertCircle,
  FileText,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { api } from "@/lib/api";
import { CustomerVessel } from "@/types/customer";
import { Berth } from "@/types";
import { Button } from "@/components/design-system/button";
import { FormField, Input, Select, Textarea } from "@/components/design-system/form-field";

export default function NewArrivalRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [vessels, setVessels] = useState<CustomerVessel[]>([]);
  const [berths, setBerths] = useState<Berth[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedVesselId, setSelectedVesselId] = useState("");
  const [requestedEta, setRequestedEta] = useState("");
  const [expectedDeparture, setExpectedDeparture] = useState("");
  const [stayHours, setStayHours] = useState(24.0);
  const [origin, setOrigin] = useState("Rotterdam Port, NL");
  const [destination, setDestination] = useState("Singapore Port, SG");
  const [cargoType, setCargoType] = useState("Container");
  const [cargoQuantity, setCargoQuantity] = useState(1500);
  const [hazardousCargo, setHazardousCargo] = useState(false);
  const [specialCargoReqs, setSpecialCargoReqs] = useState("");
  const [preferredBerthId, setPreferredBerthId] = useState("");
  const [requiredCranes, setRequiredCranes] = useState(2);
  const [tugRequired, setTugRequired] = useState(true);
  const [pilotRequired, setPilotRequired] = useState(true);
  const [bunkeringRequired, setBunkeringRequired] = useState(false);
  const [otherServices, setOtherServices] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Set default dates: ETA tomorrow at 14:00, Departure 24h later
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const dep = new Date(tomorrow);
    dep.setHours(dep.getHours() + 24);

    const toLocalISO = (d: Date) => {
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    setRequestedEta(toLocalISO(tomorrow));
    setExpectedDeparture(toLocalISO(dep));

    // Fetch company fleet & port berths
    Promise.all([
      customerApi.getVessels().catch(() => []),
      api.getBerths().catch(() => []),
    ])
      .then(([vList, bList]) => {
        setVessels(vList);
        setBerths(bList);
        const preselect = searchParams.get("vessel_id");
        if (preselect && vList.some((v: any) => v.id === preselect)) {
          setSelectedVesselId(preselect);
        } else if (vList.length > 0) {
          setSelectedVesselId(vList[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  // Update stay hours when departure/eta change
  const handleEtaChange = (val: string) => {
    setRequestedEta(val);
    if (val && expectedDeparture) {
      const diffHours = (new Date(expectedDeparture).getTime() - new Date(val).getTime()) / 3600000;
      if (diffHours > 0) setStayHours(Math.round(diffHours * 10) / 10);
    }
  };

  const handleDepartureChange = (val: string) => {
    setExpectedDeparture(val);
    if (requestedEta && val) {
      const diffHours = (new Date(val).getTime() - new Date(requestedEta).getTime()) / 3600000;
      if (diffHours > 0) setStayHours(Math.round(diffHours * 10) / 10);
    }
  };

  const selectedVessel = vessels.find((v) => v.id === selectedVesselId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVesselId) {
      setFormError("Please select a registered vessel from your fleet.");
      return;
    }

    if (new Date(expectedDeparture) <= new Date(requestedEta)) {
      setFormError("Expected departure must be after the requested ETA.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await customerApi.createArrivalRequest({
        vessel_id: selectedVesselId,
        requested_eta: new Date(requestedEta).toISOString(),
        expected_departure: new Date(expectedDeparture).toISOString(),
        expected_port_stay_hours: stayHours,
        origin: origin.trim(),
        destination: destination.trim(),
        cargo_type: cargoType,
        cargo_quantity: cargoQuantity,
        hazardous_cargo: hazardousCargo,
        special_cargo_requirements: specialCargoReqs.trim() || undefined,
        preferred_berth_id: preferredBerthId || undefined,
        required_cranes: requiredCranes,
        tug_required: tugRequired,
        pilot_required: pilotRequired,
        bunkering_required: bunkeringRequired,
        other_services: otherServices.trim() || undefined,
        customer_notes: customerNotes.trim() || undefined,
        special_instructions: specialInstructions.trim() || undefined,
      });

      // Redirect immediately to live tracking view
      router.push(`/customer/arrival-requests/${created.id}`);
    } catch (err: any) {
      setFormError(err.message || "Failed to submit vessel arrival request.");
      setIsSubmitting(false);
    }
  };

  return (
    <CustomerShell
      title="Submit Vessel Arrival Request"
      subtitle="Request a berthing allocation slot. System will automatically run deterministic feasibility and CP-SAT optimization."
      actions={
        <Link href="/customer/arrival-requests">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Back to Requests
          </Button>
        </Link>
      }
    >
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="p-4 rounded-xl bg-[#FCE9E8] border border-[#F2C4C3] text-[#B94A48] text-xs font-medium flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* ── Section 1: Vessel Selection ── */}
          <div className="rounded-xl border border-[#E3E5E0] bg-white p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F0EDE4]">
              <Ship className="h-4 w-4 text-[#004741]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
                1. Select Vessel from Fleet
              </h3>
            </div>

            {vessels.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#F7F6F2] border border-[#E3E5E0] text-xs text-[#5C6B68]">
                No vessels registered in your fleet.{" "}
                <Link href="/customer/vessels" className="text-[#004741] font-semibold underline">
                  Register a vessel first
                </Link>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Vessel Name & IMO" required>
                  <Select
                    value={selectedVesselId}
                    onChange={(e) => setSelectedVesselId(e.target.value)}
                    required
                  >
                    {vessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vessel_name} ({v.imo_number}) &mdash; {v.length_loa}m LOA
                      </option>
                    ))}
                  </Select>
                </FormField>

                {selectedVessel && (
                  <div className="p-3 rounded-lg bg-[#F7F9F8] border border-[#E3E5E0] text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#899491] block">
                      Vessel Specifications
                    </span>
                    <div className="text-[#102A27] font-medium">
                      LOA: <strong>{selectedVessel.length_loa}m</strong> &bull; Beam:{" "}
                      <strong>{selectedVessel.beam}m</strong> &bull; Draft:{" "}
                      <strong className="text-[#004741]">{selectedVessel.draft}m</strong>
                    </div>
                    <div className="text-[11px] text-[#5C6B68]">
                      {selectedVessel.vessel_type} &bull; {selectedVessel.deadweight_tonnage.toLocaleString()} DWT &bull; Flag: {selectedVessel.flag}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 2: Voyage & Schedule ── */}
          <div className="rounded-xl border border-[#E3E5E0] bg-white p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F0EDE4]">
              <Clock className="h-4 w-4 text-[#004741]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
                2. Arrival Schedule & Voyage Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Requested ETA (Local) *" required>
                <Input
                  type="datetime-local"
                  required
                  value={requestedEta}
                  onChange={(e) => handleEtaChange(e.target.value)}
                />
              </FormField>

              <FormField label="Expected Departure *" required>
                <Input
                  type="datetime-local"
                  required
                  value={expectedDeparture}
                  onChange={(e) => handleDepartureChange(e.target.value)}
                />
              </FormField>

              <FormField label="Estimated Port Stay (Hours)" required>
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={stayHours}
                  onChange={(e) => setStayHours(parseFloat(e.target.value) || 0)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Last Port of Call (Origin) *" required>
                <Input
                  type="text"
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. Rotterdam Port, NL"
                />
              </FormField>

              <FormField label="Next Destination Port *" required>
                <Input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Singapore Port, SG"
                />
              </FormField>
            </div>
          </div>

          {/* ── Section 3: Cargo Manifest ── */}
          <div className="rounded-xl border border-[#E3E5E0] bg-white p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F0EDE4]">
              <Boxes className="h-4 w-4 text-[#004741]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
                3. Cargo Manifest & Handling Needs
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cargo Type *" required>
                <Select
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                >
                  <option value="Container">Container (TEU)</option>
                  <option value="Dry Bulk">Dry Bulk (MT)</option>
                  <option value="Liquid Bulk">Liquid Bulk / Crude (MT)</option>
                  <option value="General Cargo">General Cargo (Packages)</option>
                  <option value="Ro-Ro / Vehicles">Ro-Ro / Vehicles (Units)</option>
                  <option value="Reefer / Perishable">Reefer / Perishable</option>
                </Select>
              </FormField>

              <FormField label="Cargo Quantity (TEU / MT) *" required>
                <Input
                  type="number"
                  min="1"
                  required
                  value={cargoQuantity}
                  onChange={(e) => setCargoQuantity(parseInt(e.target.value) || 0)}
                />
              </FormField>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#102A27]">
                <input
                  type="checkbox"
                  checked={hazardousCargo}
                  onChange={(e) => setHazardousCargo(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D5D9D3] text-[#004741] focus:ring-[#004741]"
                />
                <span>Shipment contains IMDG declared hazardous cargo</span>
              </label>
            </div>

            <FormField label="Special Handling / Stowage Requirements">
              <Textarea
                rows={2}
                value={specialCargoReqs}
                onChange={(e) => setSpecialCargoReqs(e.target.value)}
                placeholder="e.g. Heavy lift equipment needed, cold-chain reefer plug-in on arrival..."
              />
            </FormField>
          </div>

          {/* ── Section 4: Port Services ── */}
          <div className="rounded-xl border border-[#E3E5E0] bg-white p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F0EDE4]">
              <Anchor className="h-4 w-4 text-[#004741]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#102A27]">
                4. Operational Resource Requirements
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Preferred Berth (Optional)">
                <Select
                  value={preferredBerthId}
                  onChange={(e) => setPreferredBerthId(e.target.value)}
                >
                  <option value="">No Preference / Optimizer Decides</option>
                  {berths.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.berth_code} ({b.berth_name}) &mdash; {b.max_vessel_length}m max length
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="STS Cranes Allocated">
                <Input
                  type="number"
                  min="0"
                  max="6"
                  value={requiredCranes}
                  onChange={(e) => setRequiredCranes(parseInt(e.target.value) || 0)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-[#E3E5E0] bg-[#F7F9F8] text-xs font-medium text-[#102A27]">
                <input
                  type="checkbox"
                  checked={tugRequired}
                  onChange={(e) => setTugRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D5D9D3] text-[#004741] focus:ring-[#004741]"
                />
                <span>Tugboat Assistance</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-[#E3E5E0] bg-[#F7F9F8] text-xs font-medium text-[#102A27]">
                <input
                  type="checkbox"
                  checked={pilotRequired}
                  onChange={(e) => setPilotRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D5D9D3] text-[#004741] focus:ring-[#004741]"
                />
                <span>Pilotage Service</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-[#E3E5E0] bg-[#F7F9F8] text-xs font-medium text-[#102A27]">
                <input
                  type="checkbox"
                  checked={bunkeringRequired}
                  onChange={(e) => setBunkeringRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D5D9D3] text-[#004741] focus:ring-[#004741]"
                />
                <span>Bunkering / Fueling</span>
              </label>
            </div>

            <FormField label="Customer Remarks / Special Instructions">
              <Textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Additional notes for port authority coordinators and shift managers..."
              />
            </FormField>
          </div>

          {/* ── Submit Controls ── */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/customer/arrival-requests">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              Submit Arrival Request
            </Button>
          </div>
        </form>
      </div>
    </CustomerShell>
  );
}

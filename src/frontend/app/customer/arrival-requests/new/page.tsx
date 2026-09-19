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
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { customerApi } from "@/lib/customer-api";
import { api } from "@/lib/api";
import { CustomerVessel } from "@/types/customer";
import { Berth } from "@/types";

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
    setFormError(null);

    if (!selectedVesselId) {
      setFormError("Please select a registered vessel from your fleet.");
      return;
    }
    if (!requestedEta || !expectedDeparture) {
      setFormError("Please specify both requested ETA and expected departure.");
      return;
    }
    if (new Date(expectedDeparture) <= new Date(requestedEta)) {
      setFormError("Expected departure must be after the requested ETA.");
      return;
    }

    try {
      setIsSubmitting(true);
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

  const inputClass =
    "w-full rounded-xl border border-[#16364D] bg-[#071926] px-3.5 py-2.5 text-xs text-white placeholder:text-[#5E83A1] focus:bg-[#092233] focus:border-[#009688] focus:outline-none focus:ring-1 focus:ring-[#009688] transition-all";

  return (
    <CustomerShell
      title="Submit Vessel Arrival Request"
      subtitle="Request a berthing allocation slot. System will automatically run deterministic feasibility and CP-SAT optimization."
      actions={
        <Link
          href="/customer/arrival-requests"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#8CB4D2] hover:text-white px-3 py-2 rounded-xl bg-[#0E2E44] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Requests</span>
        </Link>
      }
    >
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="p-4 rounded-2xl bg-[#7F1D1D]/30 border border-[#DC2626]/50 text-[#FCA5A5] text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* ── Section 1: Vessel Selection ── */}
          <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#13344A]">
              <Ship className="h-4 w-4 text-[#38BDF8]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                1. Select Vessel from Fleet
              </h3>
            </div>

            {vessels.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#0E2C42] text-xs text-[#8CB4D2]">
                No vessels registered in your fleet.{" "}
                <Link href="/customer/vessels" className="text-[#38BDF8] font-bold underline">
                  Register a vessel first
                </Link>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                    Vessel Name & IMO *
                  </label>
                  <select
                    value={selectedVesselId}
                    onChange={(e) => setSelectedVesselId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    {vessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vessel_name} ({v.imo_number}) &mdash; {v.length_loa}m LOA
                      </option>
                    ))}
                  </select>
                </div>

                {selectedVessel && (
                  <div className="p-3 rounded-xl bg-[#061520] border border-[#122E42] text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#6D94B5] block">
                      Vessel Specifications
                    </span>
                    <div className="text-white font-medium">
                      LOA: <strong>{selectedVessel.length_loa}m</strong> &bull; Beam:{" "}
                      <strong>{selectedVessel.beam}m</strong> &bull; Draft:{" "}
                      <strong className="text-[#38BDF8]">{selectedVessel.draft}m</strong>
                    </div>
                    <div className="text-[11px] text-[#8AB1D1]">
                      {selectedVessel.vessel_type} &bull; {selectedVessel.deadweight_tonnage.toLocaleString()} DWT &bull; Flag: {selectedVessel.flag}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 2: Arrival & Voyage Schedule ── */}
          <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#13344A]">
              <Calendar className="h-4 w-4 text-[#2DD4BF]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                2. Arrival & Voyage Schedule
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Requested ETA (Date & Time) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={requestedEta}
                  onChange={(e) => handleEtaChange(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Expected Departure *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={expectedDeparture}
                  onChange={(e) => handleDepartureChange(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Expected Port Stay (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={stayHours}
                  onChange={(e) => setStayHours(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Port of Origin (Last Port of Call) *
                </label>
                <input
                  type="text"
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. Rotterdam, Netherlands"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Next Destination Port *
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Singapore Main Terminal"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ── Section 3: Cargo Manifest & Dangerous Goods ── */}
          <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#13344A]">
              <Boxes className="h-4 w-4 text-[#FBBF24]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                3. Cargo Manifest & Declaration
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Cargo Type *
                </label>
                <select
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  className={inputClass}
                >
                  <option value="Container">Containerized Freight (TEU)</option>
                  <option value="Bulk">Dry Bulk (Metric Tons)</option>
                  <option value="Liquid">Liquid Bulk / Tanker (MT)</option>
                  <option value="Ro-Ro">Roll-on/Roll-off Vehicles</option>
                  <option value="General Cargo">Breakbulk / Project Cargo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Cargo Quantity (TEU / MT) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cargoQuantity}
                  onChange={(e) => setCargoQuantity(parseInt(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                <input
                  type="checkbox"
                  checked={hazardousCargo}
                  onChange={(e) => setHazardousCargo(e.target.checked)}
                  className="h-4 w-4 rounded border-[#16364D] bg-[#071926] text-[#009688]"
                />
                <span>Consignment includes IMDG Class Hazardous Cargo</span>
              </label>
            </div>

            {hazardousCargo && (
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Dangerous Goods Declaration / IMDG Class Details
                </label>
                <input
                  type="text"
                  value={specialCargoReqs}
                  onChange={(e) => setSpecialCargoReqs(e.target.value)}
                  placeholder="e.g. IMDG Class 3 (Flammable Liquids), UN 1993, segregated stowage required"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* ── Section 4: Operational Services & Berth Preferences ── */}
          <div className="rounded-3xl bg-[#091E2C] border border-[#13344A] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#13344A]">
              <Anchor className="h-4 w-4 text-[#A78BFA]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                4. Operational Requirements & Preferred Quayside
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Preferred Berth (Optional)
                </label>
                <select
                  value={preferredBerthId}
                  onChange={(e) => setPreferredBerthId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No Preference (Let Optimizer Choose Optimal Slot)</option>
                  {berths.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.berth_code} &mdash; {b.berth_name} (Max LOA: {b.max_vessel_length}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                  Required STS Quayside Cranes
                </label>
                <select
                  value={requiredCranes}
                  onChange={(e) => setRequiredCranes(parseInt(e.target.value) || 2)}
                  className={inputClass}
                >
                  <option value={1}>1 STS Crane (Standard)</option>
                  <option value={2}>2 STS Cranes (Recommended for fast turnaround)</option>
                  <option value={3}>3 STS Cranes (Heavy Container Line)</option>
                  <option value={4}>4 STS Cranes (Ultra-Large Container Vessel)</option>
                </select>
              </div>
            </div>

            {/* Marine Escort Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white p-3 rounded-xl bg-[#071926] border border-[#16364D]">
                <input
                  type="checkbox"
                  checked={tugRequired}
                  onChange={(e) => setTugRequired(e.target.checked)}
                  className="h-4 w-4 text-[#009688]"
                />
                <span>Harbor Tug Escort</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white p-3 rounded-xl bg-[#071926] border border-[#16364D]">
                <input
                  type="checkbox"
                  checked={pilotRequired}
                  onChange={(e) => setPilotRequired(e.target.checked)}
                  className="h-4 w-4 text-[#009688]"
                />
                <span>Maritime Pilot Escort</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white p-3 rounded-xl bg-[#071926] border border-[#16364D]">
                <input
                  type="checkbox"
                  checked={bunkeringRequired}
                  onChange={(e) => setBunkeringRequired(e.target.checked)}
                  className="h-4 w-4 text-[#009688]"
                />
                <span>Bunkering Services</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8AB1D1] mb-1.5">
                Special Instructions or Customer Notes
              </label>
              <textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="e.g. Early discharge requested, urgent transit cargo, priority berth gang needed..."
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Submit Pipeline Notice & Button ── */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-[#0C324D] to-[#082030] border border-[#1B527A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-[#9AC2E2]">
              <div className="font-bold text-white mb-0.5">Automated Pre-Evaluation Notice:</div>
              Submission automatically evaluates physical constraints and runs the 72-hour CP-SAT optimizer before queuing for Operation Manager approval.
            </div>

            <button
              type="submit"
              disabled={isSubmitting || vessels.length === 0}
              className="px-6 py-3.5 rounded-xl bg-[#009688] hover:bg-[#007F73] text-white font-bold text-xs shadow-xl shadow-[#009688]/30 transition-all flex items-center justify-center gap-2 shrink-0 hover:scale-105"
            >
              {isSubmitting ? (
                <span>Evaluating Pipeline...</span>
              ) : (
                <>
                  <span>Submit Arrival Request</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </CustomerShell>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, memo } from "react";
import { LandDispute, LandParcel } from "../types";
import { ShieldAlert, Gavel, Calendar, FileText, User, Plus, Clock, CheckCircle, Scale } from "lucide-react";

interface DisputeCenterProps {
  disputes: LandDispute[];
  parcels: LandParcel[];
  onAddDispute: (dispute: LandDispute) => void;
  onResolveDispute: (disputeId: string, resolutionDetails: string) => void;
  onScheduleHearing: (disputeId: string, date: string, officer: string) => void;
  onSelectParcel: (p: LandParcel) => void;
}

const DisputeCenter = memo(function DisputeCenter({
  disputes,
  parcels,
  onAddDispute,
  onResolveDispute,
  onScheduleHearing,
  onSelectParcel,
}: DisputeCenterProps) {
  const [activeTab, setActiveTab] = useState<"disputes" | "file">("disputes");
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(disputes[0]?.id || "");
  
  // New Dispute Form State
  const [disputeParcelUpi, setDisputeParcelUpi] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [claimantId, setClaimantId] = useState("");
  const [claimantPhone, setClaimantPhone] = useState("");
  const [disputeType, setDisputeType] = useState<LandDispute["disputeType"]>("Boundary Encroachment");
  const [description, setDescription] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState<{ name: string; url: string }[]>([]);

  // Resolution Form State
  const [resolutionDetails, setResolutionDetails] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [assignedOfficer, setAssignedOfficer] = useState("");

  const selectedDispute = disputes.find(d => d.id === selectedDisputeId);

  const handleFileDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeParcelUpi) return;

    const parcel = parcels.find(p => p.upi === disputeParcelUpi);
    if (!parcel) {
      alert("Invalid UPI! This parcel does not exist in the LAIS Registry.");
      return;
    }

    const newDispute: LandDispute = {
      id: `dsp-${Math.floor(100000 + Math.random() * 900000)}`,
      parcelId: parcel.id,
      upi: parcel.upi,
      claimantName,
      claimantId,
      claimantPhone,
      disputeType,
      description,
      status: "Filed",
      filedDate: new Date().toISOString().split("T")[0],
      assignedOfficer: "Pending Assignment",
      evidenceDocs: uploadedEvidence.length > 0 ? uploadedEvidence : [{ name: "Civil Land Statement.pdf", url: "#" }]
    };

    onAddDispute(newDispute);
    setSelectedDisputeId(newDispute.id);
    
    // Reset Form
    setDisputeParcelUpi("");
    setClaimantName("");
    setClaimantId("");
    setClaimantPhone("");
    setDescription("");
    setUploadedEvidence([]);
    
    setActiveTab("disputes");
  };

  const handleUpdateHearing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeId || !hearingDate || !assignedOfficer) return;
    onScheduleHearing(selectedDisputeId, hearingDate, assignedOfficer);
    setHearingDate("");
    setAssignedOfficer("");
  };

  const handleResolveDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeId || !resolutionDetails) return;
    onResolveDispute(selectedDisputeId, resolutionDetails);
    setResolutionDetails("");
  };

  const getStatusColor = (status: LandDispute["status"]) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Hearing Scheduled":
        return "bg-violet-50 text-violet-750 border-violet-200";
      case "Investigation":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Dispute Header */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-rose-50 border border-rose-150 flex items-center justify-center text-rose-600 font-bold text-base">
            ⚖️
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-xs">Dispute & Arbitration Registry</h2>
            <p className="font-mono text-[9px] text-slate-500">Total Disputes Logged: {disputes.length} cases active</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex bg-white border border-slate-200 p-0.5 rounded text-xs">
          <button
            id="tab_dispute_list"
            onClick={() => setActiveTab("disputes")}
            className={`px-2.5 py-1 rounded text-[10.5px] font-bold cursor-pointer transition ${activeTab === "disputes" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
          >
            Cases Docket
          </button>
          <button
            id="tab_dispute_file"
            onClick={() => setActiveTab("file")}
            className={`px-2.5 py-1 rounded text-[10.5px] font-bold cursor-pointer transition flex items-center gap-1 ${activeTab === "file" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Plus className="w-3 h-3" />
            File Dispute
          </button>
        </div>
      </div>

      {/* Main split view case files */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[460px] bg-slate-50/40">
        {activeTab === "disputes" && (
          <div className="space-y-3">
            {/* STEP 1: Case Selection */}
            <div className="bg-white rounded border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[9px] font-bold">1</span>
                <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Case Docket ({disputes.length})
                </h3>
              </div>
              <div className="p-3">
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {disputes.map((d) => (
                    <div key={d.id} id={`case_item_${d.id}`}
                      onClick={() => { setSelectedDisputeId(d.id); const parcel = parcels.find(p => p.id === d.parcelId); if (parcel) onSelectParcel(parcel); }}
                      className={`p-2.5 rounded border cursor-pointer text-xs transition ${
                        selectedDisputeId === d.id ? "bg-rose-50/40 border-rose-350 shadow-xs" : "bg-white border-slate-200 hover:border-slate-300"
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-slate-400 font-medium text-[10px]">UPI: {d.upi}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold border ${getStatusColor(d.status)}`}>{d.status}</span>
                      </div>
                      <h4 className="font-sans font-bold text-slate-800 text-[10px] mt-1">{d.disputeType}</h4>
                      <p className="font-sans text-[9px] text-slate-500 mt-0.5">Claimant: {d.claimantName}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 2: Case Detail & Arbitration */}
            <div className="bg-white rounded border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[9px] font-bold">2</span>
                <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-violet-600" />
                  Case Detail & Arbitration
                </h3>
              </div>
              <div className="p-3">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  id={`case_item_${d.id}`}
                  onClick={() => {
                    setSelectedDisputeId(d.id);
                    const parcel = parcels.find(p => p.id === d.parcelId);
                    if (parcel) onSelectParcel(parcel);
                  }}
                  className={`p-2.5 rounded border cursor-pointer text-xs transition ${
                    selectedDisputeId === d.id ? "bg-rose-50/40 border-rose-350 shadow-xs" : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-slate-400 font-medium">UPI: {d.upi}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${getStatusColor(d.status)}`}>
                      {d.status}
                    </span>
                  </div>
                  <h4 className="font-sans font-bold text-slate-800 mt-1.5">{d.disputeType}</h4>
                  <p className="font-sans text-[10px] text-slate-500 mt-0.5">Claimant: {d.claimantName}</p>
                </div>
              ))}
            </div>

            {/* Case detail pane (cols-3) */}
            <div className="md:col-span-3 space-y-3.5">
              {selectedDispute ? (
                <div className="p-3.5 bg-white rounded border border-slate-200 space-y-3.5 text-xs shadow-xs">
                  
                  {/* Title block */}
                  <div className="flex justify-between items-start border-b border-slate-150 pb-3 gap-3">
                    <div>
                      <span className="font-mono text-[9px] text-rose-750 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 uppercase">
                        Case ID: {selectedDispute.id}
                      </span>
                      <h3 className="font-sans font-bold text-slate-850 text-xs mt-1.5">{selectedDispute.disputeType}</h3>
                      <span className="font-sans text-[9.5px] text-slate-500 block mt-0.5">Filed: {selectedDispute.filedDate}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded font-bold border ${getStatusColor(selectedDispute.status)} text-[9px]`}>
                      {selectedDispute.status}
                    </span>
                  </div>

                  {/* Claimant Details */}
                  <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-400 text-[8.5px] uppercase font-bold tracking-wider">Claimant Name</span>
                      <span className="block font-bold text-slate-800 mt-0.5">{selectedDispute.claimantName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[8.5px] uppercase font-bold tracking-wider">Claimant Phone</span>
                      <span className="block font-bold text-slate-800 mt-0.5">{selectedDispute.claimantPhone}</span>
                    </div>
                  </div>

                  {/* Narrative details */}
                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold text-[10.5px]">Dispute Claim Narrative:</span>
                    <p className="text-slate-750 leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                      {selectedDispute.description}
                    </p>
                  </div>

                  {/* Evidence docs */}
                  {selectedDispute.evidenceDocs.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold text-[10.5px]">Submitted Legal Evidence:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDispute.evidenceDocs.map((doc, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[9px] text-slate-700 flex items-center gap-1 shadow-xs">
                            📎 {doc.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Milestones timeline */}
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <span className="text-slate-500 font-bold block text-[10.5px]">Adjudication Progress Tracker:</span>
                    <div className="grid grid-cols-4 gap-1 text-[8.5px] text-center text-slate-500 relative">
                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold">1</div>
                        <span className="mt-1 font-bold">Filed</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold border ${
                          selectedDispute.status !== "Filed" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>2</div>
                        <span className="mt-1 font-bold">Investigation</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold border ${
                          selectedDispute.status === "Hearing Scheduled" || selectedDispute.status === "Resolved" ? "bg-violet-50 text-violet-750 border-violet-200" : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>3</div>
                        <span className="mt-1 font-bold">Hearing</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold border ${
                          selectedDispute.status === "Resolved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>4</div>
                        <span className="mt-1 font-bold">Resolved</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION SECTION FOR ARBITRATION AND LAND OFFICERS */}
                  <div className="border-t border-slate-200 pt-3.5 space-y-2.5">
                    <div className="font-bold text-slate-800">Arbitration Government Controls:</div>

                    {selectedDispute.status !== "Resolved" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Schedule Hearing form */}
                        <form onSubmit={handleUpdateHearing} className="space-y-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="font-bold text-[9px] text-slate-400 block uppercase tracking-wider">Schedule Tribunal Hearing:</span>
                          <input
                            id="input_hearing_date"
                            type="date"
                            required
                            value={hearingDate}
                            onChange={(e) => setHearingDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1 text-[10.5px] text-slate-850 outline-none focus:border-rose-350"
                          />
                          <input
                            id="input_assigned_officer"
                            type="text"
                            required
                            placeholder="E.g., Registrar Muganzi"
                            value={assignedOfficer}
                            onChange={(e) => setAssignedOfficer(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1 text-[10.5px] text-slate-850 outline-none focus:border-rose-350"
                          />
                          <button
                            id="btn_save_hearing"
                            type="submit"
                            className="w-full py-1 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded text-[10.5px] transition cursor-pointer"
                          >
                            Set Hearing
                          </button>
                        </form>

                        {/* Resolve dispute form */}
                        <form onSubmit={handleResolveDisputeSubmit} className="space-y-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="font-bold text-[9px] text-slate-400 block uppercase tracking-wider">Record Case Resolution:</span>
                          <textarea
                            id="textarea_resolution"
                            required
                            rows={2}
                            placeholder="Detail final land court boundary decision..."
                            value={resolutionDetails}
                            onChange={(e) => setResolutionDetails(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1 text-[10.5px] text-slate-850 outline-none resize-none focus:border-rose-350"
                          ></textarea>
                          <button
                            id="btn_resolve_case"
                            type="submit"
                            className="w-full py-1 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded text-[10.5px] transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Scale className="w-3 h-3" />
                            Resolve Case
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">
                        <span className="font-bold block uppercase text-[8.5px] tracking-wider text-emerald-600">Case Settlement Agreement Decree:</span>
                        <p className="mt-1 italic leading-relaxed text-[11px]">
                          "{selectedDispute.resolutionDetails}"
                        </p>
                        <span className="block mt-2 font-bold text-slate-500 text-[8.5px]">Authorized by: {selectedDispute.assignedOfficer}</span>
                      </div>
                    )}
                  </div>

                  {/* Parcel Dispute History Ledger */}
                  <div className="border-t border-slate-200 pt-3.5 space-y-2">
                    <span className="text-slate-500 font-bold block text-[10.5px]">Parcel Dispute History Ledger ({disputes.filter(d => d.parcelId === selectedDispute.parcelId).length}):</span>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {disputes.filter(d => d.parcelId === selectedDispute.parcelId).map(pd => (
                        <div key={pd.id} className="p-2 bg-slate-50 border border-slate-200 rounded text-[10px] flex justify-between items-start gap-1.5">
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="font-mono text-slate-400">Case {pd.id}</span>
                              <span className="text-slate-600 font-medium">{pd.disputeType}</span>
                            </div>
                            <p className="text-slate-500 text-[9px] mt-0.5 font-medium">Filed by {pd.claimantName} on {pd.filedDate}</p>
                            {pd.resolutionDetails && (
                              <p className="text-emerald-700 text-[9px] mt-1 italic font-semibold">Decree: "{pd.resolutionDetails}"</p>
                            )}
                          </div>
                          <span className={`px-1 py-0.5 rounded font-black text-[7.5px] border ${getStatusColor(pd.status)}`}>
                            {pd.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-10 bg-white border border-dashed border-slate-250 rounded-lg">
                  <ShieldAlert className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs font-bold">No dispute selected.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FILE NEW DISPUTE FORM */}
        {activeTab === "file" && (
          <div className="bg-white rounded border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[9px] font-bold">+</span>
              <h3 className="font-sans font-bold text-slate-700 text-[11px]">Register Civil Land Dispute Docket</h3>
            </div>
          <form onSubmit={handleFileDispute} className="p-3 space-y-3 text-xs">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8.5px]">Target Property (UPI):</label>
                <select
                  id="select_dispute_upi"
                  required
                  value={disputeParcelUpi}
                  onChange={(e) => setDisputeParcelUpi(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-rose-450 focus:bg-white transition"
                >
                  <option value="">-- Choose UPI in Conflict --</option>
                  {parcels.map(p => (
                    <option key={p.id} value={p.upi}>
                      UPI: {p.upi} (Owner: {p.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8.5px]">Dispute Conflict Classification:</label>
                <select
                  id="select_dispute_type"
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value as LandDispute["disputeType"])}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-rose-450 focus:bg-white transition"
                >
                  <option value="Boundary Encroachment">Boundary Encroachment / Fence Shift</option>
                  <option value="Inheritance / Family Claim">Inheritance Succession Conflict</option>
                  <option value="Double Allocation">Double Allocation Error</option>
                  <option value="Land Use Breach">Illegal Land Use Zoning Breach</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8.5px]">Claimant Full Name:</label>
                <input
                  id="claimant_name"
                  type="text"
                  required
                  placeholder="E.g., Solange Uwera"
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-rose-450 focus:bg-white transition font-sans"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8.5px]">Claimant National ID:</label>
                <input
                  id="claimant_id"
                  type="text"
                  required
                  maxLength={16}
                  placeholder="E.g., 2199580..."
                  value={claimantId}
                  onChange={(e) => setClaimantId(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-rose-450 focus:bg-white transition font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8.5px]">Claimant Phone:</label>
                <input
                  id="claimant_phone"
                  type="text"
                  required
                  placeholder="E.g., +250 78..."
                  value={claimantPhone}
                  onChange={(e) => setClaimantPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-rose-450 focus:bg-white transition font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8.5px]">Filing Narrative Claim Description:</label>
              <textarea
                id="dispute_description"
                required
                rows={3}
                placeholder="Detail exactly the encroachment distances, historical inheritance timelines, or boundary discrepancies..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-rose-450 focus:bg-white transition resize-none font-sans"
              ></textarea>
            </div>

            {/* EVIDENCE UPLOADER WITH DRAG & DROP */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[8.5px]">Upload Legal Evidence (Documents & Photos):</label>
              
              <div
                id="evidence_drag_zone"
                onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    setUploadedEvidence([...uploadedEvidence, { name: file.name, url: "#" }]);
                  }
                }}
                onClick={() => {
                  document.getElementById("file_input_evidence")?.click();
                }}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
                  isDragActive ? "border-rose-500 bg-rose-50" : "border-slate-300 bg-slate-50 hover:border-rose-400 hover:bg-rose-50"
                }`}
              >
                <input
                  id="file_input_evidence"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const filesArray = Array.from(e.target.files) as File[];
                      setUploadedEvidence([...uploadedEvidence, ...filesArray.map(f => ({ name: f.name, url: "#" }))]);
                    }
                  }}
                />
                <span className="text-xl">📁</span>
                <span className="font-sans font-bold text-slate-750 text-[10.5px]">Drag & Drop or Click to Upload Evidence</span>
                <span className="font-sans text-slate-400 text-[8.5px]">Supports PDFs, JPGs, and PNG deeds</span>
              </div>

              {uploadedEvidence.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-slate-500 text-[9.5px] font-bold block">Attached Files ({uploadedEvidence.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {uploadedEvidence.map((file, idx) => (
                      <div key={idx} className="bg-rose-50 text-rose-950 border border-rose-200 rounded px-2 py-1 flex items-center gap-1.5 font-mono text-[9.5px]">
                        <span>📄 {file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedEvidence(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-rose-600 hover:text-rose-850 font-bold ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              id="btn_file_case"
              type="submit"
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-slate-50 font-bold rounded transition cursor-pointer"
            >
              Log Case to Arbitration Ledger
            </button>
          </form>
          </div>
        )}
      </div>
    </div>
  );
});

export default DisputeCenter;

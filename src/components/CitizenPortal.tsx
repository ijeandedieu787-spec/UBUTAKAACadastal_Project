/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, memo } from "react";
import { LandParcel, LandApplication } from "../types";
import { Landmark, FileText, CheckCircle2, AlertTriangle, Send, ArrowRight, ShieldCheck, Download } from "lucide-react";
import IremboPaymentGateway from "./IremboPaymentGateway";

interface CitizenPortalProps {
  currentCitizen: {
    name: string;
    nationalId: string;
    phone: string;
    email: string;
    province: string;
    district: string;
    sector: string;
  };
  parcels: LandParcel[];
  applications: LandApplication[];
  onAddApplication: (app: LandApplication) => void;
  onPayApplication: (appId: string, receipt: string) => void;
  onSelectParcel: (p: LandParcel) => void;
  onPayParcelTax: (parcelId: string) => void;
}

const CitizenPortal = memo(function CitizenPortal({
  currentCitizen,
  parcels,
  applications,
  onAddApplication,
  onPayApplication,
  onSelectParcel,
  onPayParcelTax,
}: CitizenPortalProps) {
  const [activeTab, setActiveTab] = useState<"parcels" | "applications" | "transfer">("parcels");
  
  // New Transfer form state
  const [transferParcelId, setTransferParcelId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [transferPrice, setTransferPrice] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Payment popup state
  const [activePaymentApp, setActivePaymentApp] = useState<LandApplication | null>(null);
  const [activePaymentParcel, setActivePaymentParcel] = useState<LandParcel | null>(null);


  // Certificate modal state
  const [certParcel, setCertParcel] = useState<LandParcel | null>(null);

  const citizenParcels = parcels.filter(p => p.ownerId === currentCitizen.nationalId);
  const citizenApplications = applications.filter(a => a.applicantId === currentCitizen.nationalId);

  const handleStartTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!transferParcelId) {
      setErrorMsg("Please select a parcel to transfer.");
      return;
    }

    const parcel = parcels.find(p => p.id === transferParcelId);
    if (!parcel) return;

    if (!parcel.taxPaid) {
      setErrorMsg("Cannot transfer: Annual property tax must be cleared first.");
      return;
    }

    if (parcel.status === "Disputed") {
      setErrorMsg("Cannot transfer: This parcel has an active land dispute file.");
      return;
    }

    if (buyerId.length !== 16) {
      setErrorMsg("Buyer National ID must be exactly 16 digits.");
      return;
    }

    setIsSubmittingTransfer(true);

    setTimeout(() => {
      const newApp: LandApplication = {
        id: `app-${Math.floor(100000 + Math.random() * 900000)}`,
        type: "Transfer",
        upi: parcel.upi,
        applicantName: currentCitizen.name,
        applicantId: currentCitizen.nationalId,
        status: "Pending Notary",
        submittedDate: new Date().toISOString().split("T")[0],
        targetBuyerName: buyerName,
        targetBuyerId: buyerId,
        transferPrice: Number(transferPrice),
        documents: [
          { name: "Digital_Sales_Agreement.pdf", status: "Verified" },
          { name: "Buyer_NationalID_Extract.pdf", status: "Verified" },
          { name: "Tax_Clearance_Certificate.pdf", status: "Verified" }
        ],
        paymentStatus: "Unpaid"
      };

      onAddApplication(newApp);
      setIsSubmittingTransfer(false);
      setSuccessMsg(`Transfer application filed successfully for UPI ${parcel.upi}! Paid status is currently Unpaid.`);
      
      // Reset fields
      setTransferParcelId("");
      setBuyerName("");
      setBuyerId("");
      setTransferPrice("");
      
      // Navigate to applications tab
      setTimeout(() => {
        setActiveTab("applications");
        setSuccessMsg("");
      }, 2000);
    }, 1200);
  };

  const handlePaymentConfirm = (receipt: string) => {
    if (activePaymentApp) {
      onPayApplication(activePaymentApp.id, receipt);
    } else if (activePaymentParcel) {
      onPayParcelTax(activePaymentParcel.id);
    }
    setActivePaymentApp(null);
    setActivePaymentParcel(null);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header Profile Summary */}
      <div id="citizen_header" className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-750 font-bold text-base shadow-xs">
            {currentCitizen.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-sans font-bold text-slate-800 text-xs">{currentCitizen.name}</h2>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold rounded-full border border-emerald-200">Citizen Account</span>
            </div>
            <p className="font-mono text-[9px] text-slate-500 mt-0.5">NID: {currentCitizen.nationalId}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px]">
          <div className="text-right">
            <span className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider">Registered Land</span>
            <span className="font-mono text-[11px] font-bold text-emerald-600 mt-0.5">{citizenParcels.length} Parcels</span>
          </div>
          <div className="text-right">
            <span className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider">Service Requests</span>
            <span className="font-mono text-[11px] font-bold text-blue-600 mt-0.5">{citizenApplications.length} Active</span>
          </div>
        </div>
      </div>

      {/* Main Content Area - Task Flow */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[460px] space-y-3 bg-slate-50/40">
        {/* STEP 1: My Land Titles */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold">1</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-emerald-600" />
              My Land Titles ({citizenParcels.length})
            </h3>
          </div>
          <div className="p-3 space-y-2">
            {citizenParcels.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded">
                <AlertTriangle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="font-sans text-slate-500 text-[10px] font-semibold">No registered properties linked to your National ID.</p>
                <p className="font-sans text-slate-400 text-[9px] mt-0.5">Please apply for First Land Adjudication.</p>
              </div>
            ) : (
              citizenParcels.map(parcel => (
                <div
                  key={parcel.id}
                  onClick={() => onSelectParcel(parcel)}
                  className="p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 transition cursor-pointer group flex items-start justify-between gap-2 shadow-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-emerald-700 text-[9px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">UPI: {parcel.upi}</span>
                      <span className="text-[8px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold uppercase">{parcel.landUse.split(" ")[0]}</span>
                    </div>
                    <p className="font-sans font-medium text-slate-700 text-[10px]">
                      {parcel.village}, {parcel.cell}, {parcel.sector} Sector
                    </p>
                    <div className="flex items-center gap-2 text-[8.5px] font-mono text-slate-500">
                      <span>Area: <strong className="text-slate-700">{parcel.area.toLocaleString()} m²</strong></span>
                      <span>Value: <strong className="text-slate-700">{parcel.marketValue.toLocaleString()} RWF</strong></span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {parcel.taxPaid ? (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[7.5px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2 h-2" /> Tax Cleared
                      </span>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setActivePaymentParcel(parcel); }}
                        className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-[7.5px] font-bold transition cursor-pointer">
                        <AlertTriangle className="w-2 h-2 inline" /> Pay Tax: {parcel.annualTax.toLocaleString()} RWF
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setCertParcel(parcel); }}
                      className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded border border-slate-200 text-[8px] transition cursor-pointer">
                      <FileText className="w-2.5 h-2.5 inline" /> View Certificate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* STEP 2: Active Applications */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">2</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Applications Log ({citizenApplications.length})
            </h3>
          </div>
          <div className="p-3 space-y-2">
            {citizenApplications.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded">
                <FileText className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="font-sans text-slate-500 text-[10px] font-semibold">No active applications found.</p>
                <p className="font-sans text-slate-400 text-[9px] mt-0.5">Submit a transfer, mutation or division request.</p>
              </div>
            ) : (
              citizenApplications.map(app => (
                <div key={app.id} className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-sans font-bold text-slate-750 text-[10px]">{app.type} Request</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[7.5px] font-bold border ${
                          app.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          app.status === "Pending Notary" ? "bg-violet-50 text-violet-700 border-violet-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>{app.status}</span>
                      </div>
                      <p className="font-mono text-[8px] text-slate-400 mt-0.5">ID: {app.id} | {app.submittedDate}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {app.paymentStatus === "Paid" ? (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[7.5px] font-bold">
                          Paid: {app.paymentReceipt?.substring(0, 12)}...
                        </span>
                      ) : (
                        <button onClick={() => setActivePaymentApp(app)}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[8.5px] font-bold rounded transition cursor-pointer">
                          Pay Fee (50K RWF)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[9px] space-y-0.5">
                    <div className="flex justify-between"><span className="text-slate-500">UPI:</span><span className="font-mono text-slate-700 font-semibold">{app.upi || "N/A"}</span></div>
                    {app.targetBuyerName && <div className="flex justify-between"><span className="text-slate-500">Buyer:</span><span className="text-slate-700">{app.targetBuyerName}</span></div>}
                    {app.transferPrice && <div className="flex justify-between"><span className="text-slate-500">Value:</span><span className="font-mono text-slate-700">{app.transferPrice.toLocaleString()} RWF</span></div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* STEP 3: Initiate Land Transfer */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold">3</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-amber-600" />
              Initiate Land Transfer
            </h3>
          </div>
          <form onSubmit={handleStartTransfer} className="p-3 space-y-2.5">
            {errorMsg && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[9.5px] rounded flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] rounded flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            <div className="space-y-2 text-[10px]">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Select Property to Transfer:</label>
                <select id="select_transfer_parcel" value={transferParcelId} onChange={(e) => setTransferParcelId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-850 outline-none focus:border-blue-500 focus:bg-white">
                  <option value="">-- Choose Parcel (UPI) --</option>
                  {citizenParcels.map(p => (
                    <option key={p.id} value={p.id}>UPI {p.upi} ({p.village}, {p.area.toLocaleString()} m²)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Buyer's Full Name:</label>
                  <input id="input_buyer_name" type="text" required placeholder="E.g., Patrick Mugenzi"
                    value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-850 outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Buyer's National ID:</label>
                  <input id="input_buyer_nid" type="text" required maxLength={16} placeholder="E.g., 11992800..."
                    value={buyerId} onChange={(e) => setBuyerId(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-850 outline-none focus:border-blue-500 focus:bg-white font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Contract Transfer Price (RWF):</label>
                <input id="input_transfer_price" type="number" required placeholder="E.g., 35000000"
                  value={transferPrice} onChange={(e) => setTransferPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-850 outline-none focus:border-blue-500 focus:bg-white font-mono" />
              </div>
              <button id="btn_submit_transfer" type="submit" disabled={isSubmittingTransfer}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-slate-50 font-bold rounded transition flex items-center justify-center gap-1.5 cursor-pointer">
                {isSubmittingTransfer ? "Registering Application..." : "Submit to Notary Public"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* POPUP: SECURE IREMBO PAYMENT GATEWAY */}
      {(activePaymentApp || activePaymentParcel) && (
        <IremboPaymentGateway
          app={activePaymentApp}
          parcel={activePaymentParcel}
          citizenName={currentCitizen.name}
          citizenPhone={currentCitizen.phone}
          onConfirm={handlePaymentConfirm}
          onCancel={() => {
            setActivePaymentApp(null);
            setActivePaymentParcel(null);
          }}
        />
      )}

      {/* MODAL: OFFICIAL LAND TITLE CERTIFICATE VIEWER */}
      {certParcel && (
        <div id="certificate_modal" className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-slate-800 rounded-lg max-w-2xl w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 my-10 text-slate-850">
            {/* Stamp logo absolute background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <Landmark className="w-80 h-80 text-slate-800" />
            </div>

            {/* Certificate Header */}
            <div className="text-center border-b-2 border-slate-200 pb-4 space-y-0.5 relative z-10">
              <h2 className="font-sans font-bold text-base tracking-widest text-emerald-800 uppercase">Republic of Rwanda</h2>
              <p className="font-sans text-[9px] tracking-widest text-slate-500 font-bold uppercase">Ministry of Environment & Land Administration</p>
              <p className="font-sans text-[9px] tracking-widest text-slate-500 font-bold uppercase">Land Administration Information System (LAIS)</p>
              <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-600 to-transparent w-2/3 mx-auto mt-1.5"></div>
              <h1 className="font-sans font-bold text-xs tracking-tight text-slate-800 mt-3 uppercase">Certificate of Land Registration (Ubutaka Title)</h1>
            </div>

            {/* Certificate Core Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 text-[10.5px] font-sans">
              <div className="space-y-2">
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Unique Parcel Identifier (UPI)</span>
                  <span className="font-mono text-emerald-700 font-bold text-xs">{certParcel.upi}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Current Proprietor Name</span>
                  <span className="font-bold text-slate-800 text-[11px]">{certParcel.ownerName}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">National ID / Registry Number</span>
                  <span className="font-mono text-slate-600">{certParcel.ownerId}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Ownership Structure Type</span>
                  <span className="text-slate-750 font-bold">{certParcel.ownerType} Tenure</span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Geographic Boundary Location</span>
                  <span className="text-slate-700 font-medium block">Cell: {certParcel.cell} | Village: {certParcel.village}</span>
                  <span className="text-slate-500 block text-[10px]">{certParcel.sector} Sector, {certParcel.district} District</span>
                </div>
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Planimetric Measured Area</span>
                  <span className="font-mono text-slate-700 font-bold text-[11px]">{certParcel.area.toLocaleString()} m² ({(certParcel.area/10000).toFixed(4)} Hectares)</span>
                </div>
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Authorised Zoning Land Use</span>
                  <span className="text-slate-700 font-semibold">{certParcel.landUse}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Registry Certification Status</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Authentic & Approved
                  </span>
                </div>
              </div>
            </div>

            {/* Boundary Node coordinates */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md relative z-10">
              <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider mb-1.5">Adjudicated Boundary Coordinates (UTM Zone 36S)</span>
              <div className="grid grid-cols-4 gap-1.5 text-[9px] font-mono text-slate-750">
                {certParcel.polygon.map((pt, idx) => (
                  <div key={idx} className="bg-white p-1 rounded border border-slate-250 text-center">
                    <span className="text-slate-400 font-sans block text-[8px]">Beacon B{idx + 1}</span>
                    <span className="text-emerald-700 font-bold block">{Math.round(300000 + pt[0] * 12.5)}m E</span>
                    <span className="text-slate-500 block">{Math.round(9784000 - pt[1] * 12.5)}m N</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Audit History Ledger */}
            <div className="relative z-10 border-t border-slate-200 pt-3 space-y-1.5">
              <span className="block text-[8.5px] text-slate-500 font-mono uppercase tracking-wider">Official Title Audit Ledger History</span>
              <div className="space-y-1 text-[9.5px] font-sans text-slate-600">
                {certParcel.history.map((hist, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 bg-slate-50 border border-slate-100 px-1.5 rounded">
                    <span>📅 {hist.date} - <strong className="text-slate-800">{hist.type}</strong>: {hist.details}</span>
                    <span className="text-slate-400 font-mono shrink-0">{hist.actor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature Stamped Verification block */}
            <div className="flex flex-wrap items-center justify-between border-t-2 border-slate-250 pt-4 gap-4 relative z-10 text-[9px]">
              <div className="flex items-center gap-2.5">
                {/* Simulated Verification QR Code */}
                <div className="w-12 h-12 bg-white p-0.5 rounded border border-slate-800 flex flex-col justify-between shrink-0">
                  <div className="grid grid-cols-4 gap-0.5 h-full w-full">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((num) => (
                      <div key={num} className={`w-full h-full ${Math.random() > 0.45 ? "bg-slate-900" : "bg-white"}`}></div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-bold text-slate-800 block uppercase">Verify Certificate Security</span>
                  <p className="text-slate-500 max-w-xs leading-normal text-[8px]">
                    Scan QR to verify registry authenticity directly on the Public Land Portal.
                  </p>
                  <span className="font-mono text-[8px] text-emerald-700 block mt-0.5">LAIS-SEC-{certParcel.id.toUpperCase()}-VERIFIED</span>
                </div>
              </div>

              <div className="text-center">
                <span className="block text-[7.5px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Signed Digital Seal</span>
                <div className="font-sans text-emerald-800 italic font-semibold text-[10.5px] mt-0.5 border border-dashed border-emerald-400/35 px-2 py-0.5 bg-emerald-50 rounded">
                  Emmanuel Nkurunziza
                </div>
                <span className="block text-[7.5px] text-slate-400 font-mono mt-0.5">Director General of Land Registry</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3.5 relative z-10">
              <button
                id="btn_dl_cert"
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-slate-50 font-bold rounded transition text-[10px] flex items-center gap-1 cursor-pointer"
                onClick={() => alert("Downloading secure PDF Title Certificate...")}
              >
                <Download className="w-3 h-3" />
                Download PDF
              </button>
              <button
                id="btn_close_cert"
                onClick={() => setCertParcel(null)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded transition text-[10px] cursor-pointer"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CitizenPortal;

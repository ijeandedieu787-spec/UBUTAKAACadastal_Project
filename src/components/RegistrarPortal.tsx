import { useState } from "react";
import { LandParcel, LandApplication } from "../types";
import { CheckCircle, XCircle, ArrowLeftRight, FileText, Search, Stamp, Send, AlertTriangle } from "lucide-react";

interface RegistrarPortalProps {
  applications: LandApplication[];
  parcels: LandParcel[];
  onRegistrarApprove: (appId: string) => void;
  onSendBackToNotary: (appId: string, reason: string) => void;
  onSelectParcel: (parcel: LandParcel | null) => void;
}

export default function RegistrarPortal({
  applications,
  parcels,
  onRegistrarApprove,
  onSendBackToNotary,
  onSelectParcel,
}: RegistrarPortalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [sendBackAppId, setSendBackAppId] = useState<string>("");
  const [sendBackReason, setSendBackReason] = useState("");

  const filteredApps = applications.filter((a) => {
    if (selectedStatus !== "all" && a.status !== selectedStatus) return false;
    if (
      searchQuery &&
      !a.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const handleSendBack = () => {
    if (sendBackReason.trim()) {
      onSendBackToNotary(sendBackAppId, sendBackReason);
      setShowSendBackModal(false);
      setSendBackReason("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Stamp className="w-4 h-4 text-indigo-500" />
          <h3 className="font-sans font-bold text-slate-800 text-xs">District Registrar Portal</h3>
        </div>
        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider">
          {filteredApps.length} Pending
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 max-h-[460px] space-y-3 bg-slate-50/40">
        {/* STEP 1: Review & Filter */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">1</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px]">Review Applications</h3>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or ID..."
                  className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1.5 text-[9.5px] outline-none focus:border-indigo-400" />
              </div>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[9px] font-mono outline-none focus:border-indigo-400">
                <option value="all">All Status</option>
                <option value="Pending District Approval">Pending Approval</option>
                <option value="Pending Notary">With Notary</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* STEP 2: Application Cards */}
        <div className="space-y-2">
        {filteredApps.length === 0 ? (
          <div className="text-center py-8 text-slate-400 italic text-[11px]">
            No applications match your filters.
          </div>
        ) : (
          filteredApps.map((app) => {
            const associatedParcel = parcels.find((p) => p.upi === app.upi);
            return (
              <div
                key={app.id}
                className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-sm"
              >
                {/* App Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                      {app.applicantName.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-[11px] block">{app.applicantName}</span>
                      <span className="text-[9px] font-mono text-slate-400">{app.type} — {app.id}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider ${
                      app.status === "Pending District Approval"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : app.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : app.status === "Rejected"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-slate-50 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                {/* Parcel & Buyer Info */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-50 rounded p-1.5">
                    <span className="text-slate-400 font-semibold block text-[8.5px] uppercase tracking-wider">UPI</span>
                    <span className="font-mono font-bold text-slate-700">{app.upi || "—"}</span>
                  </div>
                  <div className="bg-slate-50 rounded p-1.5">
                    <span className="text-slate-400 font-semibold block text-[8.5px] uppercase tracking-wider">Target Buyer</span>
                    <span className="font-bold text-slate-700">{app.targetBuyerName || "—"}</span>
                  </div>
                  <div className="bg-slate-50 rounded p-1.5">
                    <span className="text-slate-400 font-semibold block text-[8.5px] uppercase tracking-wider">Submitted</span>
                    <span className="font-mono text-slate-600">{app.submittedDate}</span>
                  </div>
                  <div className="bg-slate-50 rounded p-1.5">
                    <span className="text-slate-400 font-semibold block text-[8.5px] uppercase tracking-wider">Payment</span>
                    <span
                      className={`font-mono font-bold ${
                        app.paymentStatus === "Paid" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {app.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-1">
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Documents ({app.documents.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {app.documents.map((doc: { name: string; status: string }, idx: number) => (
                      <span
                        key={idx}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border ${
                          doc.status === "Verified"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        {doc.name.substring(0, 18)}... {doc.status === "Verified" ? "✓" : "⏳"}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Associated Parcel Quick View */}
                {associatedParcel && (
                  <button
                    onClick={() => onSelectParcel(associatedParcel)}
                    className="w-full text-left bg-indigo-50/50 border border-indigo-100 rounded p-1.5 hover:bg-indigo-50 transition cursor-pointer"
                  >
                    <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider">Linked Parcel</span>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-indigo-700">{associatedParcel.upi}</span>
                      <span className="text-indigo-500">Current: {associatedParcel.ownerName}</span>
                    </div>
                  </button>
                )}

                {/* Actions */}
                {app.status === "Pending District Approval" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                      onClick={() => onRegistrarApprove(app.id)}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve Transfer
                    </button>
                    <button
                      className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                      onClick={() => {
                        setSendBackAppId(app.id);
                        setShowSendBackModal(true);
                      }}
                    >
                      <Send className="w-3.5 h-3.5" /> Send Back
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Send Back Modal */}
      {showSendBackModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSendBackModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-slate-800 text-sm">Return to Notary</h4>
            </div>
            <p className="text-[11px] text-slate-600">
              Provide a reason for returning application <strong>{sendBackAppId}</strong> to the Notary for revision:
            </p>
            <textarea
              value={sendBackReason}
              onChange={(e) => setSendBackReason(e.target.value)}
              placeholder="Describe required corrections..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10.5px] outline-none focus:border-amber-400 text-slate-800"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSendBackModal(false)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300 text-[10px] cursor-pointer">Cancel</button>
              <button onClick={handleSendBack} disabled={!sendBackReason.trim()} className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold rounded text-[10px] cursor-pointer">Send Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

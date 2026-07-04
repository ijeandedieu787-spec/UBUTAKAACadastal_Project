import React, { useState, memo } from "react";
import { LandApplication, LandParcel } from "../types";
import {
  ShieldCheck, Fingerprint, FileSignature, CheckCircle2, AlertTriangle,
  XCircle, User, FileText, Search, ArrowRight, CreditCard, Clock,
  Eye, EyeOff, Lock, Unlock, Download
} from "lucide-react";
import { getStatusColor } from "../utils/helpers";

interface NotaryPortalProps {
  applications: LandApplication[];
  parcels: LandParcel[];
  onVerifyIdentity: (appId: string) => void;
  onSignAndForward: (appId: string) => void;
  onReject: (appId: string, reason: string) => void;
  onSelectParcel: (p: LandParcel) => void;
}

const NotaryPortal = memo(function NotaryPortal({
  applications,
  parcels,
  onVerifyIdentity,
  onSignAndForward,
  onReject,
  onSelectParcel,
}: NotaryPortalProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedApp, setSelectedApp] = useState<LandApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [pkiSigned, setPkiSigned] = useState(false);
  const [showPkiModal, setShowPkiModal] = useState(false);
  const [pkiPassword, setPkiPassword] = useState("");
  const [pkiError, setPkiError] = useState("");

  const pendingApps = applications.filter(a => a.status === "Pending Notary" || a.status === "Pending District Approval");
  const historyApps = applications.filter(a => a.status === "Approved" || a.status === "Rejected");
  const displayedApps = activeTab === "pending" ? pendingApps : historyApps;

  const selectedParcel = selectedApp?.upi ? parcels.find(p => p.upi === selectedApp.upi) : null;

  const handleSelect = (app: LandApplication) => {
    setSelectedApp(app);
    setIdentityVerified(false);
    setPkiSigned(false);
    if (app.upi) {
      const parcel = parcels.find(p => p.upi === app.upi);
      if (parcel) onSelectParcel(parcel);
    }
  };

  const handleVerify = () => {
    if (!selectedApp) return;
    onVerifyIdentity(selectedApp.id);
    setIdentityVerified(true);
  };

  const handlePkiSign = () => {
    if (pkiPassword === "notarypki") {
      setPkiSigned(true);
      setPkiError("");
      setShowPkiModal(false);
      setPkiPassword("");
    } else {
      setPkiError("Invalid PKI signing certificate password. Hint: notarypki");
    }
  };

  const handleForward = () => {
    if (!selectedApp) return;
    onSignAndForward(selectedApp.id);
    setPkiSigned(false);
    setIdentityVerified(false);
    setSelectedApp(null);
  };

  const handleReject = () => {
    if (!selectedApp || !rejectReason.trim()) return;
    onReject(selectedApp.id, rejectReason.trim());
    setShowRejectModal(false);
    setRejectReason("");
    setSelectedApp(null);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-900 p-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider">Notary Public Portal</h3>
            <p className="text-[8.5px] text-slate-400">PKI digital signature & identity verification</p>
          </div>
        </div>
        <span className="text-[8px] font-mono bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700/40">
          {pendingApps.filter(a => a.status === "Pending Notary").length} pending
        </span>
      </div>

      {/* Main Content - Task Flow */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[460px] space-y-3 bg-slate-50/40">
        {/* STEP 1: Application Queue */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">1</span>
              <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                <FileSignature className="w-3.5 h-3.5 text-indigo-600" />
                Application Queue
              </h3>
            </div>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded text-[8.5px] font-bold">
              <button onClick={() => setActiveTab("pending")}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${activeTab === "pending" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
                Pending ({pendingApps.length})
              </button>
              <button onClick={() => setActiveTab("history")}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${activeTab === "history" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
                History ({historyApps.length})
              </button>
            </div>
          </div>
          <div className="p-3 space-y-1.5 max-h-[180px] overflow-y-auto">
            {displayedApps.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded">
                <FileSignature className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                <p className="text-[9px] text-slate-400 italic">No applications in this stage</p>
              </div>
            ) : (
              displayedApps.map((app) => (
                <div key={app.id} onClick={() => handleSelect(app)}
                  className={`p-2 rounded-lg border cursor-pointer transition ${
                    selectedApp?.id === app.id ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200 hover:border-slate-300"
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-[10px] text-slate-800">{app.type}</span>
                        <span className={`text-[7px] px-1 py-0.5 rounded font-bold border ${getStatusColor(app.status)}`}>{app.status}</span>
                      </div>
                      <div className="text-[8.5px] text-slate-500 mt-0.5">
                        <User className="w-2 h-2 inline mr-0.5" />{app.applicantName} • UPI: {app.upi || "—"}
                      </div>
                      {app.targetBuyerName && <div className="text-[8px] text-slate-400">Buyer: {app.targetBuyerName}</div>}
                      {app.paymentReceipt && <div className="text-[7.5px] text-emerald-600"><CreditCard className="w-2 h-2 inline mr-0.5" />Receipt: {app.paymentReceipt}</div>}
                    </div>
                    <span className="text-[7.5px] font-mono text-slate-400 shrink-0">{app.submittedDate}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* STEP 2: Document Verification & Actions */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold">2</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              Verification & Sign-off
            </h3>
          </div>
          <div className="p-3 space-y-2.5">
            {selectedApp ? (
              <>
                <div className="space-y-1">
                  <h4 className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Document Verification</h4>
                  <div className="space-y-1">
                    {selectedApp.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px]">
                        <span className="text-slate-700">{doc.name}</span>
                        <span className={`text-[7.5px] font-bold px-1.5 py-0.5 rounded ${doc.status === "Verified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {doc.status === "Verified" ? "✓ Verified" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedApp.status === "Pending Notary" && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    {!identityVerified ? (
                      <button onClick={handleVerify}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[9px] flex items-center justify-center gap-1.5 cursor-pointer transition">
                        <Search className="w-3 h-3" /> Verify Identity via NIDA
                      </button>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded text-[9px] text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" /> Identity verified against NIDA
                      </div>
                    )}
                    {identityVerified && !pkiSigned && (
                      <button onClick={() => setShowPkiModal(true)}
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[9px] flex items-center justify-center gap-1.5 cursor-pointer transition">
                        <Fingerprint className="w-3 h-3" /> Apply PKI Digital Signature
                      </button>
                    )}
                    {pkiSigned && (
                      <button onClick={handleForward}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[9px] flex items-center justify-center gap-1.5 cursor-pointer transition">
                        <ArrowRight className="w-3 h-3" /> Forward to District Registrar
                      </button>
                    )}
                    <button onClick={() => setShowRejectModal(true)}
                      className="w-full py-1 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold rounded text-[9px] flex items-center justify-center gap-1.5 cursor-pointer transition">
                      <XCircle className="w-3 h-3" /> Reject Application
                    </button>
                  </div>
                )}
                {selectedApp.status === "Pending District Approval" && (
                  <div className="bg-blue-50 border border-blue-200 p-2 rounded text-[9px] text-blue-700 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Awaiting District Registrar final approval
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded">
                <ShieldCheck className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                <p className="text-[9px] text-slate-400 italic">Select an application from the queue above</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PKI Signature Modal */}
      {showPkiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-sm w-full p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-amber-500" />
                PKI Digital Signature
              </h4>
              <button onClick={() => setShowPkiModal(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-[9.5px] text-amber-800 space-y-1">
              <p className="font-bold">Notary Public Certificate</p>
              <p className="text-[8.5px] text-amber-600 break-all font-mono">Issuer: Rwanda Notariat Authority • Serial: PKI-RWA-{selectedApp?.id}-{Date.now().toString().slice(-6)}</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handlePkiSign(); }} className="space-y-2">
              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">PKI Certificate Password</label>
                <input
                  type="password"
                  value={pkiPassword}
                  onChange={(e) => setPkiPassword(e.target.value)}
                  placeholder="Enter your PKI signing password"
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10.5px] outline-none focus:border-amber-400 text-slate-800"
                  autoFocus
                />
                {pkiError && <p className="text-[8.5px] text-rose-500 mt-1">{pkiError}</p>}
              </div>
              <button
                type="submit"
                disabled={!pkiPassword.trim()}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold rounded text-[10px] cursor-pointer"
              >
                <Lock className="w-3 h-3 inline mr-1" />
                Sign with PKI Certificate
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-sm w-full p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Reject Application
              </h4>
              <button onClick={() => setShowRejectModal(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <p className="text-[10px] text-slate-600">Provide a reason for rejecting <strong>{selectedApp.type}</strong> by <strong>{selectedApp.applicantName}</strong>.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Discrepancy in boundary documents, missing signature..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10.5px] outline-none focus:border-rose-400 text-slate-800"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300 text-[10px] cursor-pointer">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded text-[10px] cursor-pointer">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default NotaryPortal;

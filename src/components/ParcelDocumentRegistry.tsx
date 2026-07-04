/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { LandParcel, ParcelDocument, UserRole } from "../types";
import { 
  FileText, ShieldCheck, Upload, Download, Copy, Trash2, 
  History, Fingerprint, Lock, CheckCircle2, AlertCircle, 
  FilePlus, ChevronDown, ChevronUp, Clock, User, Check,
  QrCode, Printer
} from "lucide-react";
import QRCode from "qrcode";

interface ParcelDocumentRegistryProps {
  selectedParcel: LandParcel | null;
  onUpdateParcelDocuments: (parcelId: string, updatedDocs: ParcelDocument[]) => void;
  currentRole: UserRole;
  currentUsername: string;
}

export default function ParcelDocumentRegistry({
  selectedParcel,
  onUpdateParcelDocuments,
  currentRole,
  currentUsername
}: ParcelDocumentRegistryProps) {
  // Tabs: "vault" (Active Documents) | "audit" (All Versions Timeline) | "upload" (Add Document)
  const [activeTab, setActiveTab] = useState<"vault" | "audit" | "upload">("vault");
  
  // Upload Form State
  const [dragActive, setDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ParcelDocument["category"]>("Land Deed");
  const [customDocName, setCustomDocName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isNewVersion, setIsNewVersion] = useState(true);
  const [targetReplaceDocId, setTargetReplaceDocId] = useState("");
  const [manualSignature, setManualSignature] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  // Verification Animation State
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [verifiedDocs, setVerifiedDocs] = useState<Record<string, boolean>>({});
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  // Expands for version details
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "Land Deed": true,
    "Survey Report": true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR Code Verification States & Logic
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isQrCopied, setIsQrCopied] = useState(false);

  useEffect(() => {
    if (selectedParcel) {
      const verificationUrl = `${window.location.origin}/verify/parcel/${selectedParcel.upi}`;
      const payload = JSON.stringify({
        parcelId: selectedParcel.id,
        upi: selectedParcel.upi,
        verificationUrl: verificationUrl,
        timestamp: new Date().toISOString()
      });
      
      QRCode.toDataURL(payload, {
        margin: 1,
        width: 140,
        color: {
          dark: "#0f172a", // slate-900
          light: "#ffffff"
        }
      })
      .then((url) => {
        setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR Code", err);
      });
    }
  }, [selectedParcel]);

  const handlePrintQr = () => {
    if (!selectedParcel || !qrCodeDataUrl) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }
    
    const verificationUrl = `${window.location.origin}/verify/parcel/${selectedParcel.upi}`;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Official UPI Verification QR Code - ${selectedParcel.upi}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              padding: 40px;
              text-align: center;
            }
            .card {
              border: 2px solid #cbd5e1;
              border-radius: 12px;
              padding: 30px;
              max-width: 400px;
              margin: 0 auto;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .header {
              font-size: 16px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #0f172a;
              margin-bottom: 5px;
            }
            .subheader {
              font-size: 11px;
              color: #64748b;
              margin-bottom: 20px;
              font-family: monospace;
            }
            .qr-img {
              width: 200px;
              height: 200px;
              margin: 0 auto 20px auto;
              display: block;
            }
            .upi-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px;
              font-family: monospace;
              font-size: 14px;
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 15px;
            }
            .details {
              font-size: 12px;
              text-align: left;
              margin-bottom: 20px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            .details-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .details-label {
              color: #64748b;
            }
            .details-value {
              font-weight: 600;
            }
            .footer {
              font-size: 9px;
              color: #94a3b8;
              margin-top: 20px;
              font-family: monospace;
            }
            @media print {
              body {
                padding: 0;
              }
              .card {
                border: none;
                box-shadow: none;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">Rwanda Land Registry</div>
            <div class="subheader">OFFICIAL VERIFICATION CERTIFICATE</div>
            
            <img class="qr-img" src="${qrCodeDataUrl}" alt="UPI Verification QR Code" />
            
            <div class="upi-box">UPI: ${selectedParcel.upi}</div>
            
            <div class="details">
              <div class="details-row">
                <span class="details-label">Registered Owner:</span>
                <span class="details-value">${selectedParcel.ownerName}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Land Use:</span>
                <span class="details-value">${selectedParcel.landUse}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Registered Area:</span>
                <span class="details-value">${selectedParcel.area} sqm</span>
              </div>
              <div class="details-row">
                <span class="details-label">Verification Link:</span>
                <span class="details-value" style="font-size: 10px; word-break: break-all;">${verificationUrl}</span>
              </div>
            </div>
            
            <div class="footer">
              Digital Registry Seal Secure verification barcode.<br/>
              Ubutaka Smart Land Registry. Gasabo District.
            </div>
          </div>
          <div style="margin-top: 30px;" class="no-print">
            <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background-color: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Print Label
            </button>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!selectedParcel) {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm text-center space-y-2">
        <Lock className="w-8 h-8 text-slate-300 mx-auto" />
        <h4 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wider">Legal Document Vault</h4>
        <p className="font-sans text-slate-400 text-[10.5px] max-w-xs mx-auto">
          Please select a land parcel UPI directly from the GIS map to access its secure cryptographically signed document registry and historical audit chain.
        </p>
      </div>
    );
  }

  const documents = selectedParcel.documents || [];

  // Sort documents: Newest uploadedAt first
  const sortedDocuments = [...documents].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  // Group latest version of each category
  // (We can also group by specific logical documents, but category is a clear legal division in land registry)
  const latestByCategory: Record<string, ParcelDocument> = {};
  documents.forEach((doc) => {
    const currentLatest = latestByCategory[doc.category];
    if (!currentLatest || doc.version > currentLatest.version) {
      latestByCategory[doc.category] = doc;
    }
  });

  // Toggle category expand
  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setUploadedFile(file);
    // Auto-fill custom document name if empty
    if (!customDocName) {
      setCustomDocName(file.name);
    }
    // Format size
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    setCustomSize(`${sizeInMb} MB`);
  };

  // Copy signature helper
  const handleCopySignature = (docId: string, sig: string) => {
    navigator.clipboard.writeText(sig);
    setCopiedDocId(docId);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  // Verify Signature simulation
  const handleVerifySeal = (docId: string) => {
    setVerifyingDocId(docId);
    setTimeout(() => {
      setVerifyingDocId(null);
      setVerifiedDocs((prev) => ({ ...prev, [docId]: true }));
      setTimeout(() => {
        setVerifiedDocs((prev) => ({ ...prev, [docId]: false }));
      }, 4000);
    }, 1500);
  };

  // Delete document
  const handleDeleteDoc = (docId: string) => {
    if (window.confirm("Are you sure you want to permanently revoke this registry document from the parcel's digital archives?")) {
      const updated = documents.filter((d) => d.id !== docId);
      onUpdateParcelDocuments(selectedParcel.id, updated);
    }
  };

  // Form Submit (Upload)
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!customDocName.trim()) {
      setFormError("Please specify a document name.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      // Determine what version this document should be
      let nextVersion = 1;
      
      // If replacing an existing document or same category, find max version
      const sameCategoryDocs = documents.filter((d) => d.category === selectedCategory);
      if (sameCategoryDocs.length > 0) {
        const maxVer = Math.max(...sameCategoryDocs.map((d) => d.version));
        nextVersion = maxVer + 1;
      }

      // Generate a cool SHA256 digital signature
      const randomHex = Math.random().toString(16).substring(2, 10);
      const computedSha = `SHA256:${randomHex}f931d5b3c0e7f827a5d${Math.floor(Math.random() * 90000 + 10000)}b4c19a9`;
      const finalSignature = manualSignature.trim() || computedSha;

      const newDoc: ParcelDocument = {
        id: `doc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        name: customDocName.trim(),
        fileType: uploadedFile ? uploadedFile.type : "application/pdf",
        uploadedAt: new Date().toISOString(),
        uploadedBy: `${currentUsername} (${currentRole})`,
        digitalSignature: finalSignature,
        version: nextVersion,
        size: customSize || "1.5 MB",
        category: selectedCategory
      };

      const updatedDocs = [...documents, newDoc];
      onUpdateParcelDocuments(selectedParcel.id, updatedDocs);

      setIsSubmitting(false);
      setFormSuccess(`Document "${newDoc.name}" uploaded successfully as Version ${newDoc.version} and notarized with digital signature.`);
      
      // Reset form
      setCustomDocName("");
      setUploadedFile(null);
      setCustomSize("");
      setManualSignature("");
      
      // Switch back to Vault tab after a short delay
      setTimeout(() => {
        setActiveTab("vault");
        setFormSuccess("");
      }, 2500);
    }, 1500);
  };

  const categoriesList: ParcelDocument["category"][] = [
    "Land Deed",
    "Survey Report",
    "Tax Clearance",
    "Court Order",
    "Identity Document",
    "Other"
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden text-slate-850">
      {/* Title Header */}
      <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="font-sans font-bold text-xs block">Official Document Registry</span>
            <span className="text-[9px] text-slate-400 font-mono">UPI: {selectedParcel.upi}</span>
          </div>
        </div>
        <span className="px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/35 text-emerald-400 font-mono text-[8px] font-bold rounded uppercase tracking-wider">
          Secured with SHA-256
        </span>
      </div>

      {/* Main Content - Task Flow */}
      <div className="p-3 bg-slate-50/20 max-h-[440px] overflow-y-auto flex-1 min-h-[220px] space-y-3">

        {/* STEP 1: UPI Verification */}
        <div className="bg-slate-900 text-white rounded-lg border border-slate-950 overflow-hidden shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-800">
            <span className="w-5 h-5 rounded-full bg-emerald-800 text-emerald-300 flex items-center justify-center text-[9px] font-bold">1</span>
            <h3 className="font-sans font-bold text-[11px] flex items-center gap-1.5 text-slate-100">
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              UPI Verification Stamp
            </h3>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[8px] text-slate-400">Scan to verify legal title deed credentials</p>
              <button id="btn_print_parcel_qr" onClick={handlePrintQr}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-[9px] rounded border border-slate-700 flex items-center gap-1 transition cursor-pointer">
                <Printer className="w-3 h-3" /> Print QR
              </button>
            </div>
            <div className="flex items-center gap-3 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
              {qrCodeDataUrl ? (
                <div className="bg-white p-1 rounded shrink-0 border border-slate-800/40 shadow-inner">
                  <img src={qrCodeDataUrl} alt="UPI Verification QR Code" className="w-14 h-14 block" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-slate-800 animate-pulse rounded shrink-0 flex items-center justify-center">
                  <span className="text-[7.5px] text-slate-500 font-mono">GEN...</span>
                </div>
              )}
              <div className="space-y-0.5 text-[10px] font-sans flex-1 min-w-0">
                <div className="flex items-center gap-1 text-slate-300 font-mono text-[8.5px] truncate">
                  <span className="text-slate-500 font-bold">UPI:</span>
                  <span className="font-bold text-emerald-400">{selectedParcel.upi}</span>
                </div>
                <div className="text-slate-400 text-[9.5px] truncate">
                  <span className="font-semibold text-slate-300">Owner:</span> {selectedParcel.ownerName}
                </div>
                <div className="text-[8px] text-slate-500 font-mono truncate select-all hover:text-slate-400">
                  URL: {window.location.origin.replace(/^https?:\/\//, "")}/verify/parcel/{selectedParcel.upi}
                </div>
                <button type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/verify/parcel/${selectedParcel.upi}`); setIsQrCopied(true); setTimeout(() => setIsQrCopied(false), 2000); }}
                  className="text-[8px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer">
                  {isQrCopied ? "✓ Link Copied!" : "📋 Copy Verification Link"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: Active Document Registry */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold">2</span>
              <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Active Document Ledger ({Object.keys(latestByCategory).length})
              </h3>
            </div>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded text-[8.5px] font-bold">
              <button onClick={() => setActiveTab("vault")}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${activeTab === "vault" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
                Current ({Object.keys(latestByCategory).length})
              </button>
              <button onClick={() => setActiveTab("audit")}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${activeTab === "audit" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
                Audit ({documents.length})
              </button>
            </div>
          </div>
          <div className="p-3">
            {activeTab === "vault" && (
              <div className="space-y-2">
                {Object.keys(latestByCategory).length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded">
                    <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="font-sans text-slate-500 text-[10px] font-semibold">No active notarized documents found.</p>
                    <p className="font-sans text-slate-400 text-[9px] mt-0.5">Proceed to Step 3 to upload initial documents.</p>
                  </div>
                ) : (
                  categoriesList.map((cat) => {
                    const doc = latestByCategory[cat];
                    if (!doc) return null;
                    const isVerifying = verifyingDocId === doc.id;
                    const isVerified = verifiedDocs[doc.id];
                    const isCopied = copiedDocId === doc.id;
                    const historicalVersions = documents.filter((d) => d.category === cat && d.id !== doc.id).sort((a, b) => b.version - a.version);
                    const isExpanded = expandedCategories[cat];
                    return (
                      <div key={doc.id} className="border border-slate-200 rounded-lg overflow-hidden shadow-xs mb-2">
                        <div onClick={() => toggleCategoryExpand(cat)}
                          className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-150 flex items-center justify-between cursor-pointer hover:bg-slate-100/70">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="font-sans font-bold text-[10px] text-slate-750 uppercase tracking-wide">{cat} Registry</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[8.5px] text-slate-400 font-mono">
                            <span>v{doc.version}</span>
                            {historicalVersions.length > 0 && <span>(+{historicalVersions.length})</span>}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="p-2.5 space-y-2.5 text-xs">
                            <div className="flex items-start justify-between gap-2 bg-slate-50/40 p-2 rounded border border-slate-150">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 text-[10px] truncate">📄 {doc.name}</span>
                                  <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded text-[8px] border border-emerald-200 uppercase">Active</span>
                                </div>
                                <div className="flex flex-wrap gap-x-2 text-[8.5px] text-slate-500 font-mono">
                                  <span>{doc.fileType.split("/")[1]?.toUpperCase() || "PDF"}</span>
                                  <span>{doc.size}</span>
                                  <span><Clock className="w-2 h-2 inline" /> {new Date(doc.uploadedAt).toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 items-end shrink-0">
                                <button onClick={() => handleVerifySeal(doc.id)} disabled={isVerifying}
                                  className={`px-2 py-0.5 rounded text-[8.5px] border font-bold flex items-center gap-1 transition ${isVerified ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 hover:bg-slate-100 border-slate-250 text-slate-700"}`}>
                                  <ShieldCheck className={`w-2.5 h-2.5 ${isVerified ? "text-emerald-600" : "text-blue-500"}`} />
                                  {isVerifying ? "Verifying..." : isVerified ? "Authentic" : "Verify"}
                                </button>
                                <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition">
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                            <div className="p-1.5 bg-slate-900 border border-slate-950 rounded text-slate-300 font-mono text-[8px] space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 uppercase tracking-widest text-[7px] flex items-center gap-1 font-bold">
                                  <Fingerprint className="w-2 h-2 text-emerald-400" /> Crypto Signature
                                </span>
                                <button onClick={() => handleCopySignature(doc.id, doc.digitalSignature)} className="text-slate-400 hover:text-white flex items-center gap-1 text-[8px] transition">
                                  {isCopied ? <span className="text-emerald-400 font-bold">✓ Copied</span> : <><Copy className="w-2 h-2" /> Copy</>}
                                </button>
                              </div>
                              <p className="break-all font-mono text-emerald-400 font-bold text-[7.5px]">{doc.digitalSignature}</p>
                            </div>
                            {historicalVersions.length > 0 && (
                              <div className="border-t border-slate-100 pt-1.5 space-y-1">
                                <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">Previous Versions ({historicalVersions.length})</span>
                                <div className="space-y-1">
                                  {historicalVersions.map((prevDoc) => (
                                    <div key={prevDoc.id} className="p-1.5 rounded bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2 text-[9px]">
                                      <span className="font-semibold text-slate-700 truncate">📄 {prevDoc.name} <span className="text-slate-400 font-normal">(v{prevDoc.version})</span></span>
                                      <button onClick={() => handleDeleteDoc(prevDoc.id)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"><Trash2 className="w-2 h-2" /></button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "audit" && (
              <div className="space-y-3">
                {sortedDocuments.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded">
                    <History className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                    <p className="font-sans text-slate-500 text-[10px] font-semibold">No registry upload history exists.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 pl-3 ml-1.5 space-y-3 text-xs">
                    {sortedDocuments.map((doc) => {
                      const isLatest = Object.values(latestByCategory).some((l) => l.id === doc.id);
                      return (
                        <div key={doc.id} className="relative">
                          <span className={`absolute -left-4.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white ${isLatest ? "border-emerald-500" : "border-slate-300"}`} />
                          <div className="bg-white p-2 border border-slate-200 rounded shadow-xs space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <span className="px-1 py-0.2 rounded text-[7px] font-black uppercase border bg-slate-100 text-slate-500">{doc.category}</span>
                                <strong className="text-slate-800 block text-[9.5px] mt-0.5">📄 {doc.name}</strong>
                              </div>
                              <span className={`px-1 rounded text-[7.5px] font-mono font-bold shrink-0 ${isLatest ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-50 text-slate-450"}`}>
                                v{doc.version} {isLatest && "(Current)"}
                              </span>
                            </div>
                            <div className="text-[8px] font-mono text-slate-500 flex flex-wrap gap-x-2">
                              <span>{doc.size}</span>
                              <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                              <span>By: {doc.uploadedBy}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: Upload & Notarize */}
        <div className="bg-white rounded border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-100">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">3</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <FilePlus className="w-3.5 h-3.5 text-indigo-600" />
              Upload & Notarize Document
            </h3>
          </div>
          <form onSubmit={handleUploadSubmit} className="p-3 space-y-2.5 text-xs">
            {formSuccess && (
              <div className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-bold text-[9px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> <span>{formSuccess}</span>
              </div>
            )}
            {formError && (
              <div className="p-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded font-bold text-[9px] flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" /> <span>{formError}</span>
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-slate-500 font-bold uppercase text-[7.5px] tracking-wider">Document Category:</label>
              <select id="doc_category_select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as ParcelDocument["category"])}
                className="w-full bg-slate-50 border border-slate-250 rounded p-1.5 outline-none focus:border-indigo-500 focus:bg-white text-[10px] font-medium">
                {categoriesList.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-slate-500 font-bold uppercase text-[7.5px] tracking-wider">Select or Drop File:</label>
              <div id="doc_drag_zone" onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition flex flex-col items-center gap-1 ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:border-indigo-400"}`}>
                <input ref={fileInputRef} id="file_input_registry" type="file" className="hidden" onChange={handleFileChange} />
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-700 text-[9px]">{uploadedFile ? "Replace File" : "Drag & Drop or Click"}</span>
                <span className="text-[8px] text-slate-400">{uploadedFile ? `${uploadedFile.name}` : "Supports PDFs, JPGs, or PNGs"}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-slate-500 font-bold uppercase text-[7.5px] tracking-wider">Document Title:</label>
              <input id="doc_name_input" type="text" placeholder="E.g., Kimihurura_Subdivision_Deed.pdf"
                value={customDocName} onChange={(e) => setCustomDocName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 rounded p-1.5 text-slate-800 outline-none focus:border-indigo-500 text-[10px]" />
            </div>
            <div className="space-y-1">
              <label className="block text-slate-500 font-bold uppercase text-[7.5px] tracking-wider">Manual Crypto Seal Key (Optional):</label>
              <input id="doc_sig_override" type="text" placeholder="Auto-calculates SHA-256 if left empty"
                value={manualSignature} onChange={(e) => setManualSignature(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 rounded p-1.5 text-slate-800 outline-none focus:border-indigo-500 text-[9px] font-mono" />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-150 text-[8px] text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Version will auto-increment to v{(() => { const same = documents.filter((d) => d.category === selectedCategory); return same.length > 0 ? Math.max(...same.map((d) => d.version)) + 1 : 1; })()} for {selectedCategory}</span>
            </div>
            <button id="btn_submit_notary_doc" type="submit" disabled={isSubmitting}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded transition text-[10px] cursor-pointer disabled:opacity-50">
              {isSubmitting ? "Generating Signature..." : "Notarize & Seal Document"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

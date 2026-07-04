/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, memo } from "react";
import { SurveyAssignment, NeighborNotification, LandParcel, ParcelStatus } from "../types";
import { Radio, MapPin, Compass, ShieldAlert, Bell, Volume2, Image, FileSignature, CheckCircle, Printer, Wrench } from "lucide-react";
import { generateId } from "../utils/helpers";
import AssetManagement from "./AssetManagement";

interface SurveyorToolkitProps {
  surveyors: { id: string; name: string };
  assignments: SurveyAssignment[];
  notifications: NeighborNotification[];
  parcels: LandParcel[];
  onUpdateAssignmentStatus: (assignmentId: string, status: SurveyAssignment["status"], measuredPolygon?: [number, number][], measuredArea?: number) => void;
  onConfirmBeacon: (assignmentId: string) => void;
  onSetGeofenceRadius: (assignmentId: string, radius: number) => void;
  onAddVoiceNote: (assignmentId: string) => void;
  onSelectParcel: (p: LandParcel) => void;
  onAddNotificationResponse: (notifId: string, response: "Attending" | "Reschedule_Requested" | "Objecting", notes: string) => void;
  onGPSUpdate?: (gps: { x: number; y: number; lat: number; lon: number }) => void;
}

const SurveyorToolkit = memo(function SurveyorToolkit({
  surveyors,
  assignments,
  notifications,
  parcels,
  onUpdateAssignmentStatus,
  onConfirmBeacon,
  onSetGeofenceRadius,
  onAddVoiceNote,
  onSelectParcel,
  onAddNotificationResponse,
  onGPSUpdate,
}: SurveyorToolkitProps) {
  const [selectedSrvId, setSelectedSrvId] = useState<string>(assignments[0]?.id || "");
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [gpsProgress, setGpsProgress] = useState(0);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);
  const [signatureName, setSignatureName] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeNeighborTab, setActiveNeighborTab] = useState<string>("");
  const [surveyTab, setSurveyTab] = useState<"operations" | "assets">("operations");
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    };
  }, []);

  const activeAssignment = assignments.find(a => a.id === selectedSrvId);
  const activeParcel = parcels.find(p => p.upi === activeAssignment?.upi);
  const activeNotifications = notifications.filter(n => n.surveyId === selectedSrvId);

  // Start simulated GPS boundary walking
  const handleSimulateGPSWalking = () => {
    if (!activeAssignment || !activeParcel) return;
    setIsSimulatingGps(true);
    setGpsProgress(0);
    
    let currentProgress = 0;
    gpsIntervalRef.current = setInterval(() => {
      currentProgress += 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setGpsProgress(100);
        if (gpsIntervalRef.current) {
          clearInterval(gpsIntervalRef.current);
          gpsIntervalRef.current = null;
        }
        setIsSimulatingGps(false);
        // Auto confirm beacons
        for (let i = 0; i < activeParcel.polygon.length; i++) {
          onConfirmBeacon(activeAssignment.id);
        }
      } else {
        setGpsProgress(currentProgress);
      }

      // Calculate current position along the boundary
      const poly = activeParcel.polygon;
      const numPoints = poly.length;
      if (numPoints >= 3) {
        const totalSegs = numPoints;
        const progressFraction = currentProgress / 100;
        const rawSeg = progressFraction * totalSegs;
        const segIndex = Math.min(Math.floor(rawSeg), numPoints - 1);
        const segProgress = rawSeg - segIndex;

        const pStart = poly[segIndex];
        const pEnd = poly[(segIndex + 1) % numPoints];

        const currentX = Math.round(pStart[0] + (pEnd[0] - pStart[0]) * segProgress);
        const currentY = Math.round(pStart[1] + (pEnd[1] - pStart[1]) * segProgress);

        // Convert to simulated coordinates
        const currentLat = -1.95420 + (currentY - 250) * 0.000012;
        const currentLon = 30.08940 + (currentX - 400) * 0.000012;

        if (onGPSUpdate) {
          onGPSUpdate({
            x: currentX,
            y: currentY,
            lat: currentLat,
            lon: currentLon
          });
        }
      }
    }, 250);
  };

  const handleUploadMockPhoto = () => {
    const photos = [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80"
    ];
    const newPhoto = photos[Math.floor(Math.random() * photos.length)];
    setUploadedPhotos(prev => [...prev, newPhoto]);
  };

  const handleRecordVoiceNote = () => {
    if (!activeAssignment) return;
    onAddVoiceNote(activeAssignment.id);
    setVoiceNotes(prev => [...prev, `Voice memo logged at beacon #${activeAssignment.beaconsConfirmed + 1}`]);
  };

  const handleSignAndComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment || !activeParcel) return;
    
    // Surveyor signs and updates coordinates to map
    onUpdateAssignmentStatus(
      activeAssignment.id,
      "Completed",
      activeParcel.polygon, // Use mapped vector coordinates
      activeParcel.area
    );
    setIsCompleted(true);
    setTimeout(() => {
      setIsCompleted(false);
      setSignatureName("");
    }, 3000);
  };

  const handleGenerateSurveyReport = () => {
    if (!activeAssignment || !activeParcel) return;
    
    // Create hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    // Convert local grid coordinates to simulated GPS values
    const boundaryPoints = activeParcel.polygon.map((point, idx) => {
      const x = point[0];
      const y = point[1];
      const lat = -1.95420 + (y - 250) * 0.000012;
      const lon = 30.08940 + (x - 400) * 0.000012;
      return {
        id: idx + 1,
        x,
        y,
        lat: lat.toFixed(6),
        lon: lon.toFixed(6)
      };
    });

    const reportDateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const activeSurveyor = signatureName.trim() || surveyors.name;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Survey Boundary Report - ${activeParcel.upi}</title>
          <style>
            @media print {
              body {
                margin: 0;
                padding: 20px;
                color: #0f172a;
              }
              .no-print {
                display: none;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.6;
            }
            .border-box {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 24px;
              background-color: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .header h1 {
              font-size: 20px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0;
              letter-spacing: 0.05em;
            }
            .header p {
              font-size: 10px;
              color: #64748b;
              margin: 4px 0 0 0;
              font-family: monospace;
              text-transform: uppercase;
            }
            .stamp {
              border: 2px solid #15803d;
              color: #15803d;
              padding: 4px 10px;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 10px;
              border-radius: 4px;
              transform: rotate(-2deg);
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 24px;
            }
            .grid-item {
              background-color: #f8fafc;
              border: 1px solid #f1f5f9;
              padding: 12px;
              border-radius: 6px;
            }
            .label {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: bold;
              color: #64748b;
              margin-bottom: 4px;
            }
            .value {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
            }
            .mono {
              font-family: monospace;
            }
            .section-title {
              font-size: 13px;
              font-weight: bold;
              text-transform: uppercase;
              color: #0f172a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
              margin-bottom: 12px;
              margin-top: 24px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              font-weight: bold;
              color: #334155;
              text-transform: uppercase;
            }
            .sign-row {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              page-break-inside: avoid;
            }
            .sign-col {
              width: 45%;
              border-top: 1px dashed #cbd5e1;
              padding-top: 12px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              border-top: 1px solid #f1f5f9;
              padding-top: 12px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="border-box">
            <div class="header">
              <div>
                <h1>Official Survey & Boundary Report</h1>
                <p>Ubutaka Smart Land Registry • Republic of Rwanda</p>
              </div>
              <div class="stamp">Verified Field Data</div>
            </div>

            <div class="grid">
              <div class="grid-item">
                <div class="label">Parcel UPI Number</div>
                <div class="value mono">${activeParcel.upi}</div>
              </div>
              <div class="grid-item">
                <div class="label">Measured Land Area</div>
                <div class="value">${activeParcel.area} sqm (CORS Verified)</div>
              </div>
              <div class="grid-item">
                <div class="label">Licensed Field Surveyor</div>
                <div class="value">${activeSurveyor} (License #RP0421)</div>
              </div>
              <div class="grid-item">
                <div class="label">Survey Timestamp</div>
                <div class="value">${reportDateStr}</div>
              </div>
              <div class="grid-item">
                <div class="label">Registered Owner</div>
                <div class="value">${activeParcel.ownerName} (${activeParcel.ownerType})</div>
              </div>
              <div class="grid-item">
                <div class="label">Adjudication Status</div>
                <div class="value">${activeParcel.status}</div>
              </div>
            </div>

            <div class="section-title">Differential GNSS Coordinate Registry</div>
            <p style="font-size: 11px; color: #64748b; margin-top: -6px; margin-bottom: 12px;">
              These verified boundary vertices coordinate markers are logged through RTK/CORS networks with sub-centimeter geospatial precision limits.
            </p>

            <table>
              <thead>
                <tr>
                  <th>Beacon ID</th>
                  <th>Local grid coordinate (px)</th>
                  <th>Latitude (WGS84)</th>
                  <th>Longitude (WGS84)</th>
                  <th>Precision status</th>
                </tr>
              </thead>
              <tbody>
                ${boundaryPoints.map(p => `
                  <tr>
                    <td class="mono" style="font-weight: bold;">Vertex #${p.id}</td>
                    <td class="mono">X: ${p.x}, Y: ${p.y}</td>
                    <td class="mono">${p.lat}° S</td>
                    <td class="mono">${p.lon}° E</td>
                    <td style="color: #15803d; font-weight: bold;">± 0.006m (Locked)</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <div class="sign-row">
              <div class="sign-col">
                <div style="font-size: 9px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-bottom: 16px;">Registered Field Surveyor</div>
                <div style="font-size: 12px; font-weight: bold; font-family: monospace;">${activeSurveyor}</div>
                <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Verified CORS Digital Stamp Active</div>
              </div>
              <div class="sign-col">
                <div style="font-size: 9px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-bottom: 16px;">District Land Registrar</div>
                <div style="font-size: 11px; font-style: italic; color: #94a3b8; margin-top: 15px;">Pending Notarization & Ledger Registry</div>
              </div>
            </div>

            <div class="footer">
              Certificate Security Hash: SC-SHA256-${activeParcel.id.substring(0, 6)}-${Date.now().toString().substring(7)}<br/>
              Ministry of Environment (MoE) • Rwanda Land Management and Use Authority (RLMUA)
            </div>
          </div>

          <div style="margin-top: 20px; text-align: center;" class="no-print">
            <button onclick="window.print()" style="padding: 8px 20px; font-weight: bold; background-color: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
              Print Survey Report
            </button>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(printContent);
    iframeDoc.close();

    // Trigger iframe printing and remove afterwards
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  // Simulate neighbor response update
  const triggerMockNeighborUpdate = (notifId: string, response: "Attending" | "Reschedule_Requested" | "Objecting") => {
    let notes = "";
    if (response === "Attending") {
      notes = "I will attend. Please make sure the total station does not cross my maize crops.";
    } else if (response === "Reschedule_Requested") {
      notes = "I am traveling to Gisenyi today. Can we reschedule to Saturday morning?";
    } else {
      notes = "Objecting! The southwest beacon encroaches on my legal title registered in 2018!";
    }
    onAddNotificationResponse(notifId, response, notes);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolkit Header */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-base">
            S
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-xs">Surveyor Field Toolkit</h2>
            <p className="font-mono text-[9px] text-slate-500">Registered Surveyor: {surveyors.name} (License #RP0421)</p>
          </div>
        </div>
        
        {/* Assignment Selector */}
        <div className="flex items-center gap-2">
          <label className="font-sans text-slate-500 text-[10.5px] font-bold uppercase tracking-wider">Active Assignment:</label>
          <select
            id="surveyor_assignment_select"
            value={selectedSrvId}
            onChange={(e) => setSelectedSrvId(e.target.value)}
            className="bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-800 font-sans outline-none focus:border-blue-500 cursor-pointer"
          >
            {assignments.map(a => (
              <option key={a.id} value={a.id}>
                {a.id} - {a.requestorName} ({a.sector})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex bg-slate-100 border-b border-slate-200 p-1 text-[10.5px] font-bold shrink-0">
        <button
          id="surveyor_tab_operations"
          type="button"
          onClick={() => setSurveyTab("operations")}
          className={`flex-1 py-1.5 rounded text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            surveyTab === "operations" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-blue-500" />
          Field Operations
        </button>
        <button
          id="surveyor_tab_assets"
          type="button"
          onClick={() => setSurveyTab("assets")}
          className={`flex-1 py-1.5 rounded text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            surveyTab === "assets" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wrench className="w-3.5 h-3.5 text-emerald-500" />
          Equipment Vault & Assets
        </button>
      </div>

      {surveyTab === "assets" ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <AssetManagement />
        </div>
      ) : (
        /* Task-flow layout - top to bottom workflow */
        <div className="flex-1 overflow-y-auto p-3.5 max-h-[460px] space-y-3 bg-slate-50/40">
          {activeAssignment ? (
          <>
            {/* STEP 1: GNSS & Boundary Surveying */}
            <div className="p-3 bg-white rounded border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-sans font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                  GNSS RTK / CORS Integration
                </h3>
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8.5px] rounded font-bold uppercase tracking-wider">
                  Fixed Precision
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left: GNSS stats + Beacon */}
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-400 text-[7px] font-sans font-bold uppercase tracking-wider">Satellites</span>
                      <span className="block font-mono text-[11px] font-bold text-slate-800 mt-0.5">26 Locked</span>
                    </div>
                    <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-400 text-[7px] font-sans font-bold uppercase tracking-wider">PDOP Ratio</span>
                      <span className="block font-mono text-[11px] font-bold text-slate-800 mt-0.5">1.08 (Ideal)</span>
                    </div>
                    <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-400 text-[7px] font-sans font-bold uppercase tracking-wider">Precision Acc.</span>
                      <span className="block font-mono text-[11px] font-bold text-emerald-700 mt-0.5">±0.006m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Confirmed Beacons</span>
                      <span className="font-mono font-bold text-slate-800 text-[11px]">
                        {activeAssignment.beaconsConfirmed} / {activeParcel?.polygon.length || 4}
                      </span>
                    </div>
                    <button
                      id="btn_confirm_beacon"
                      onClick={() => onConfirmBeacon(activeAssignment.id)}
                      disabled={activeAssignment.beaconsConfirmed >= (activeParcel?.polygon.length || 4)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-50 font-bold rounded text-[9px] transition cursor-pointer"
                    >
                      + Place Beacon
                    </button>
                  </div>
                </div>

                {/* Right: GPS Walk Simulator */}
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium">Boundary Walk Simulator:</span>
                    {activeParcel && (
                      <span className="font-mono text-slate-600 font-bold">UPI: {activeParcel.upi}</span>
                    )}
                  </div>
                  
                  {isSimulatingGps ? (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${gpsProgress}%` }}></div>
                      </div>
                      <div className="flex justify-between font-mono text-[8px] text-slate-500">
                        <span>Traversing boundary vectors...</span>
                        <span className="font-bold">{gpsProgress}%</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      id="btn_gps_walk"
                      onClick={handleSimulateGPSWalking}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-slate-50 font-bold rounded transition flex items-center justify-center gap-1.5 cursor-pointer text-[10px]"
                    >
                      <MapPin className="w-3 h-3 text-slate-200 animate-bounce" />
                      Run Automatic Boundary Tracing
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 2: Geofence + Neighbors | Media - 2-column sub-grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left: GeoFence & Neighbor Logs */}
              <div className="p-3 bg-white rounded border border-slate-200 space-y-2 shadow-xs">
                <div className="flex justify-between items-center">
                  <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                    Geofence & Neighbors
                  </h3>
                  <span className="font-mono font-bold text-amber-700 text-[10px]">{activeAssignment.geofenceRadius}m</span>
                </div>

                <input
                  id="geofence_slider"
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={activeAssignment.geofenceRadius}
                  onChange={(e) => onSetGeofenceRadius(activeAssignment.id, Number(e.target.value))}
                  className="w-full accent-amber-600 bg-slate-200 rounded appearance-none h-1 cursor-pointer"
                />
                <div className="flex justify-between font-mono text-[7px] text-slate-400 -mt-1">
                  <span>100m</span>
                  <span>1000m</span>
                </div>

                <div className="border-t border-slate-200 pt-2 space-y-1.5">
                  <span className="block font-bold text-[8px] text-slate-400 uppercase tracking-wider">Neighbour Responses:</span>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {activeNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onSelectParcel(parcels.find(p => p.upi === n.neighborUpi)!);
                          setActiveNeighborTab(n.id);
                        }}
                        className={`p-1.5 rounded border text-[9px] cursor-pointer transition ${
                          activeNeighborTab === n.id ? "bg-amber-50/40 border-amber-300 shadow-xs" : "bg-white border-slate-250 hover:border-slate-350"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-sans font-bold text-slate-800">{n.neighborName}</span>
                          <span className={`px-1 py-0.5 rounded text-[7px] font-bold border ${
                            n.response === "Attending" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            n.response === "Reschedule_Requested" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            n.response === "Objecting" ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" :
                            "bg-slate-50 text-slate-400 border-slate-200"
                          }`}>
                            {n.response ? n.response.replace("_", " ") : "Pending PIN"}
                          </span>
                        </div>
                        <p className="font-mono text-[7.5px] text-slate-500">UPI: {n.neighborUpi} | {n.distance}m</p>
                        
                        {!n.response && (
                          <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                            <button
                              id={`btn_sim_attend_${n.id}`}
                              onClick={() => triggerMockNeighborUpdate(n.id, "Attending")}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-750 text-[7px] border border-emerald-200 font-bold rounded cursor-pointer"
                            >Accept</button>
                            <button
                              id={`btn_sim_object_${n.id}`}
                              onClick={() => triggerMockNeighborUpdate(n.id, "Objecting")}
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-750 text-[7px] border border-rose-200 font-bold rounded cursor-pointer"
                            >Objection</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Field Media */}
              <div className="p-3 bg-white rounded border border-slate-200 space-y-2 shadow-xs">
                <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-pink-600" />
                  Field Media Records
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn_record_voice"
                    onClick={handleRecordVoiceNote}
                    className="p-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold flex flex-col items-center gap-1 transition text-center cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <span className="text-[9px]">Voice Notes</span>
                    <span className="font-mono text-[7px] text-slate-500 font-normal">{activeAssignment.voiceNotesCount} logged</span>
                  </button>
                  <button
                    id="btn_upload_photo"
                    onClick={handleUploadMockPhoto}
                    className="p-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold flex flex-col items-center gap-1 transition text-center cursor-pointer"
                  >
                    <Image className="w-4 h-4 text-pink-600" />
                    <span className="text-[9px]">Photos</span>
                    <span className="font-mono text-[7px] text-slate-500 font-normal">{uploadedPhotos.length} captured</span>
                  </button>
                </div>

                {uploadedPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 border-t border-slate-200 pt-2">
                    {uploadedPhotos.map((p, idx) => (
                      <div key={idx} className="relative aspect-square rounded overflow-hidden border border-slate-200 shadow-xs">
                        <img src={p} alt="beacon" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                )}

                {voiceNotes.length > 0 && (
                  <div className="space-y-0.5 max-h-[60px] overflow-y-auto text-[8px] font-mono text-slate-650 bg-slate-50 p-1.5 rounded border border-slate-200">
                    {voiceNotes.map((vn, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-blue-600">🎤</span>
                        <span>{vn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* STEP 3: Digital Sign-off & Completion */}
            <div className="p-3 bg-white rounded border border-slate-200 shadow-xs">
              <h3 className="font-sans font-bold text-slate-700 text-xs flex items-center gap-1 mb-2">
                <FileSignature className="w-4 h-4 text-violet-600" />
                Digital Sign-off & Completion
              </h3>

              {isCompleted ? (
                <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-850 text-xs rounded flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold block">Survey Certified!</span>
                      <p className="text-[9px] text-emerald-700 mt-0.5 font-medium">
                        Title coordinate report generated and submitted to District Registrar.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn_print_certified_survey"
                    onClick={handleGenerateSurveyReport}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Certified Survey Report
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSignAndComplete} className="space-y-2 text-xs">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[8px]">Electronic Signature:</label>
                    <input
                      id="input_surveyor_signature"
                      type="text"
                      required
                      placeholder="E.g., Pierre Claver Mugisha"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:bg-white focus:border-violet-400 font-sans"
                    />
                  </div>

                  <button
                    id="btn_complete_survey"
                    type="submit"
                    disabled={activeAssignment.beaconsConfirmed < (activeParcel?.polygon.length || 4)}
                    className="w-full py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-slate-50 font-bold rounded transition cursor-pointer text-[11px]"
                  >
                    {activeAssignment.beaconsConfirmed < (activeParcel?.polygon.length || 4)
                      ? `Awaiting ${activeAssignment.beaconsConfirmed}/${activeParcel?.polygon.length || 4} Beacons`
                      : "Sign & Submit Survey Report"}
                  </button>

                  <button
                    type="button"
                    id="btn_generate_survey_report_draft"
                    onClick={handleGenerateSurveyReport}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded text-[10px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    Generate Survey Report
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-white border border-dashed border-slate-250 rounded shadow-xs">
            <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-xs font-bold">No active surveyor assignments selected.</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
});

export default SurveyorToolkit;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, memo } from "react";
import { LandParcel, SurveyAssignment, LandDispute, IoTSensorFeed, DroneMission } from "../types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Landmark, FileSpreadsheet, ShieldAlert, BadgeCent, Drone, Radio, Download, Activity, Wrench, BarChart2, RefreshCw } from "lucide-react";
import { exportFile } from "../utils/exportFile";
import AssetManagement from "./AssetManagement";

interface AnalyticsDashboardProps {
  parcels: LandParcel[];
  assignments: SurveyAssignment[];
  disputes: LandDispute[];
  iotSensors: IoTSensorFeed[];
  droneMissions: DroneMission[];
}

const AnalyticsDashboard = memo(function AnalyticsDashboard({
  parcels,
  assignments,
  disputes,
  iotSensors,
  droneMissions,
}: AnalyticsDashboardProps) {
  const [selectedReportDistrict, setSelectedReportDistrict] = useState("Gasabo");
  const [exportFormat, setExportFormat] = useState<"PDF" | "CSV" | "XLS">("PDF");
  const [isExporting, setIsExporting] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"analytics" | "assets">("analytics");

  // Bulk Export States
  const [includeParcels, setIncludeParcels] = useState(true);
  const [includeDisputes, setIncludeDisputes] = useState(true);
  const [includeTaxes, setIncludeTaxes] = useState(true);
  const [bulkExportFormat, setBulkExportFormat] = useState<"PDF" | "CSV" | "XLS">("CSV");
  const [bulkDistrict, setBulkDistrict] = useState<"All" | "Gasabo" | "Kicukiro" | "Nyarugenge" | "Musanze">("All");
  const [bulkExporting, setBulkExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<{ id: string; name: string; timestamp: string; format: string; size: string }[]>([
    { id: "exp-001", name: "Parcels, Disputes", timestamp: "08:04 AM", format: "CSV", size: "3.2 KB" }
  ]);

  // 1. Calculate metrics
  const totalParcelsCount = parcels.length;
  const activeSurveysCount = assignments.filter(a => a.status === "Active").length;
  const unresolvedDisputesCount = disputes.filter(d => d.status !== "Resolved").length;
  
  // Calculate total property tax collected
  const totalTaxRevenueCollected = parcels
    .filter(p => p.taxPaid)
    .reduce((sum, p) => sum + p.annualTax, 0);

  // 2. Prepare chart data: Land use distribution
  const landUseCounts: Record<string, number> = {};
  parcels.forEach((p) => {
    const label = p.landUse.split(" ")[0]; // Take first word e.g., "Residential", "Agricultural"
    landUseCounts[label] = (landUseCounts[label] || 0) + p.area;
  });

  const landUseChartData = Object.keys(landUseCounts).map((key) => ({
    name: key,
    value: Math.round(landUseCounts[key] / 1000) // in thousand sqm
  }));

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#06b6d4", "#a855f7", "#ec4899"];

  // 3. Prepare monthly transaction trend data
  const monthlyTransactionsData = [
    { month: "Jan", registrations: 45, transfers: 120, disputes: 8 },
    { month: "Feb", registrations: 52, transfers: 145, disputes: 12 },
    { month: "Mar", registrations: 60, transfers: 130, disputes: 5 },
    { month: "Apr", registrations: 68, transfers: 160, disputes: 10 },
    { month: "May", registrations: 75, transfers: 185, disputes: 15 },
    { month: "Jun", registrations: 88, transfers: 195, disputes: 7 }
  ];

  const triggerMockReportDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      // Let's do a real download for the single district!
      const filteredParcels = parcels.filter(p => p.district === selectedReportDistrict);
      const headers = ["UPI", "Owner Name", "National ID", "District", "Area (sqm)", "Land Use", "Status"];
      const rows = filteredParcels.map(p => [
        p.upi, p.ownerName, p.ownerId, p.district, p.area, p.landUse, p.status
      ]);
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LAIS_${selectedReportDistrict}_District_Report_${exportFormat}.${exportFormat.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleBulkExport = () => {
    if (!includeParcels && !includeDisputes && !includeTaxes) {
      alert("Please select at least one report type to export.");
      return;
    }
    setBulkExporting(true);
    
    setTimeout(() => {
      // Filter data based on district
      const filteredParcels = bulkDistrict === "All" 
        ? parcels 
        : parcels.filter(p => p.district === bulkDistrict);
        
      const filteredDisputes = bulkDistrict === "All" 
        ? disputes 
        : disputes.filter(d => {
            const parcel = parcels.find(p => p.upi === d.upi);
            return parcel ? parcel.district === bulkDistrict : true;
          });

      const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
      


      const convertToCSV = (headers: string[], rows: any[][]): string => {
        const bom = bulkExportFormat === "XLS" ? "\uFEFF" : "";
        const csvContent = [
          headers.join(","),
          ...rows.map(row => 
            row.map(val => {
              const strVal = val === null || val === undefined ? "" : String(val);
              if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n") || strVal.includes("\r")) {
                return `"${strVal.replace(/"/g, '""')}"`;
              }
              return strVal;
            }).join(",")
          )
        ].join("\n");
        return bom + csvContent;
      };

      const generateReportText = (title: string, headers: string[], rows: any[][], summaryStats: string[]) => {
        const line = "====================================================================================================";
        const dLine = "----------------------------------------------------------------------------------------------------";
        let out = "";
        out += `${line}\n`;
        out += `                MINISTRY OF LANDS AND FORESTS - REVENUE & REGISTRY SECTORS\n`;
        out += `                      LAND ADMINISTRATION INFORMATION SYSTEM (LAIS)\n`;
        out += `                       OFFICIAL BULK LAND ADMINISTRATION AUDIT REPORT\n`;
        out += `${line}\n\n`;
        out += `REPORT TYPE  : ${title.toUpperCase()}\n`;
        out += `DISTRICT SCOPE: ${bulkDistrict.toUpperCase()}\n`;
        out += `GENERATED AT : ${new Date().toLocaleString()}\n`;
        out += `FILE STATUS  : CRYPTOGRAPHICALLY SIGNED & SECURE\n\n`;
        
        out += `[SUMMARY STATISTICS]\n`;
        summaryStats.forEach(stat => {
          out += ` • ${stat}\n`;
        });
        out += `\n${dLine}\n`;
        
        // Print table headers
        out += headers.map((h, i) => h.padEnd(i === 0 ? 15 : i === 1 ? 25 : 15)).join(" | ") + "\n";
        out += `${dLine}\n`;
        
        rows.forEach(row => {
          out += row.map((v, i) => String(v).substring(0, i === 0 ? 14 : i === 1 ? 24 : 14).padEnd(i === 0 ? 15 : i === 1 ? 25 : 15)).join(" | ") + "\n";
        });
        out += `${dLine}\n`;
        out += `\n                  [END OF OFFICIAL ADMINISTRATIVE LEDGER EXTRACT]\n`;
        out += `                     VERIFICATION CERTIFICATE REF: LAIS-${Math.floor(100000 + Math.random() * 900000)}\n`;
        return out;
      };

      const ext = bulkExportFormat === "PDF" ? "pdf" : bulkExportFormat === "XLS" ? "xls" : "csv";
      const mime = bulkExportFormat === "PDF" ? "text/plain" : bulkExportFormat === "XLS" ? "application/vnd.ms-excel" : "text/csv";

      let downloadsCount = 0;

      // PARCELS REPORT
      if (includeParcels) {
        const headers = ["UPI", "Owner Name", "National ID", "District", "Area (sqm)", "Land Use", "Status"];
        const rows = filteredParcels.map(p => [
          p.upi, p.ownerName, p.ownerId, p.district, p.area, p.landUse, p.status
        ]);
        
        let content = "";
        if (bulkExportFormat === "PDF") {
          const totalArea = filteredParcels.reduce((sum, p) => sum + p.area, 0);
          const stats = [
            `Total Parcels Listed: ${filteredParcels.length}`,
            `Sum of Planimetric Area: ${totalArea.toLocaleString()} sqm`,
            `Main District Node: ${bulkDistrict}`
          ];
          content = generateReportText("Parcel Registry Audit Ledger", headers, rows, stats);
        } else {
          content = convertToCSV(headers, rows);
        }
        
        exportFile(content, `LAIS_Parcel_Report_${bulkDistrict}_${timestampStr}.${ext}`, mime);
        downloadsCount++;
      }

      // DISPUTES REPORT
      if (includeDisputes) {
        const headers = ["Dispute ID", "UPI Node", "Claimant Name", "Claimant ID", "Nature of Dispute", "Assigned Officer", "Status"];
        const rows = filteredDisputes.map(d => [
          d.id, d.upi, d.claimantName, d.claimantId, d.disputeType, d.assignedOfficer, d.status
        ]);

        let content = "";
        if (bulkExportFormat === "PDF") {
          const openDisputes = filteredDisputes.filter(d => d.status !== "Resolved").length;
          const stats = [
            `Total Disputes Logged: ${filteredDisputes.length}`,
            `Active/Unresolved Cases: ${openDisputes}`,
            `Conflict Resolution Rate: ${(filteredDisputes.length ? ((filteredDisputes.length - openDisputes) / filteredDisputes.length * 100).toFixed(1) : 100)}%`
          ];
          content = generateReportText("Land Disputes and Conflict Register", headers, rows, stats);
        } else {
          content = convertToCSV(headers, rows);
        }

        exportFile(content, `LAIS_Disputes_Report_${bulkDistrict}_${timestampStr}.${ext}`, mime);
        downloadsCount++;
      }

      // TAXES REPORT
      if (includeTaxes) {
        const headers = ["UPI", "Owner Name", "Annual Tax (RWF)", "Tax Paid Status", "District", "Area (sqm)"];
        const rows = filteredParcels.map(p => [
          p.upi, p.ownerName, p.annualTax, p.taxPaid ? "PAID" : "OUTSTANDING", p.district, p.area
        ]);

        let content = "";
        if (bulkExportFormat === "PDF") {
          const totalTaxCollected = filteredParcels.filter(p => p.taxPaid).reduce((sum, p) => sum + p.annualTax, 0);
          const outstandingTax = filteredParcels.filter(p => !p.taxPaid).reduce((sum, p) => sum + p.annualTax, 0);
          const stats = [
            `Total Registered Tax Payers: ${filteredParcels.length}`,
            `Aggregated Revenue Collected: ${totalTaxCollected.toLocaleString()} RWF`,
            `Estimated Outstanding Deficit: ${outstandingTax.toLocaleString()} RWF`
          ];
          content = generateReportText("Municipal Land Tax & Revenue Ledger", headers, rows, stats);
        } else {
          content = convertToCSV(headers, rows);
        }

        exportFile(content, `LAIS_Revenue_Report_${bulkDistrict}_${timestampStr}.${ext}`, mime);
        downloadsCount++;
      }

      // Add to Export History log
      if (downloadsCount > 0) {
        const newHistory = {
          id: `exp-${Date.now().toString().substring(8)}`,
          name: `${includeParcels ? "Parcels " : ""}${includeDisputes ? "Disputes " : ""}${includeTaxes ? "Taxes " : ""}`.trim().replace(/ /g, ", "),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          format: bulkExportFormat,
          size: `${(downloadsCount * 1.5).toFixed(1)} KB`
        };
        setExportHistory(prev => [newHistory, ...prev]);
      }

      setBulkExporting(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Dashboard Executive Header */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="font-sans font-bold text-slate-850 text-xs">National Land Administration Command Center</h2>
          <p className="font-mono text-[9px] text-slate-500 mt-0.5">LAIS Core Services Analytics Hub | Country Focus: Rwanda</p>
        </div>
        
        {/* Trigger manual backup / sync */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="font-mono text-[8px] text-emerald-700 font-bold uppercase tracking-wider">PostgreSQL Spatial DB: ONLINE</span>
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex bg-slate-100 border-b border-slate-200 p-1 text-[10.5px] font-bold shrink-0">
        <button
          id="admin_tab_analytics"
          type="button"
          onClick={() => setActiveDashboardTab("analytics")}
          className={`flex-1 py-1.5 rounded text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeDashboardTab === "analytics" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
          System Analytics
        </button>
        <button
          id="admin_tab_assets"
          type="button"
          onClick={() => setActiveDashboardTab("assets")}
          className={`flex-1 py-1.5 rounded text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeDashboardTab === "assets" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wrench className="w-3.5 h-3.5 text-emerald-500" />
          Hardware & Survey Assets Registry
        </button>
      </div>

      {activeDashboardTab === "assets" ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <AssetManagement />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 max-h-[460px] space-y-3 bg-slate-50/40">
        
        {/* KPI Stats Grid */}
        <div className="bg-white rounded border border-slate-200 shadow-xs p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">1</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px]">System Overview KPIs</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-slate-400 font-sans font-bold text-[8.5px] uppercase tracking-wider">Registered Plots</span>
              <span className="block font-mono text-sm font-bold text-slate-800 mt-1">{totalParcelsCount} Plots</span>
            </div>
            <Landmark className="w-6 h-6 text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200" />
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-slate-400 font-sans font-bold text-[8.5px] uppercase tracking-wider">Active Surveys</span>
              <span className="block font-mono text-sm font-bold text-slate-800 mt-1">{activeSurveysCount} Active</span>
            </div>
            <Activity className="w-6 h-6 text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-200" />
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-slate-400 font-sans font-bold text-[8.5px] uppercase tracking-wider">Dispute Rate</span>
              <span className="block font-mono text-sm font-bold text-slate-800 mt-1">{unresolvedDisputesCount} Open</span>
            </div>
            <ShieldAlert className="w-6 h-6 text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200" />
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-slate-400 font-sans font-bold text-[8.5px] uppercase tracking-wider">Tax revenue</span>
              <span className="block font-mono text-xs font-bold text-emerald-700 mt-1.5">{(totalTaxRevenueCollected).toLocaleString()} RWF</span>
            </div>
            <BadgeCent className="w-6 h-6 text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200" />
          </div>
        </div>

        {/* Recharts Analytics Charts Section */}
        <div className="bg-white rounded border border-slate-200 shadow-xs p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold">2</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px]">Analytics & Land Use</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          
          {/* Chart 1: Transaction Trends */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5 shadow-xs">
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Monthly Transaction Volumes (Registrations & Mutative Transfers)
            </h3>
            
            <div className="h-40 w-full text-[9px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTransactionsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" tickLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#0f172a" }} />
                  <Legend wrapperStyle={{ fontSize: "9px" }} />
                  <Line type="monotone" dataKey="transfers" name="Transfers (Irembo)" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="registrations" name="First-time Reg" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Land Use Area Distribution */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5 shadow-xs">
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-blue-600" />
              Planimetric Land Use Allocation (Area in '000 sqm)
            </h3>

            <div className="h-40 w-full text-[9px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={landUseChartData}
                    cx="50%"
                    cy="40%"
                    innerRadius={42}
                    outerRadius={56}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {landUseChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#0f172a" }} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: "8px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
        </div>

        {/* Drone & IoT Sentinel Oversight panel */}
        <div className="bg-white rounded border border-slate-200 shadow-xs p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[9px] font-bold">3</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px]">Drone & IoT Oversight</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          
          {/* Drone Mission Board */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5 shadow-xs">
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <Drone className="w-4 h-4 text-violet-600" />
              National Drone Sentinel Photogrammetry Flight Missions
            </h3>

            <div className="space-y-2">
              {droneMissions.map((mission) => (
                <div key={mission.id} className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 text-[11px]">{mission.flightArea}</span>
                      <p className="font-mono text-[8.5px] text-slate-500 mt-0.5">Pilot: {mission.pilotName} | Mission: {mission.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                      mission.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-violet-50 text-violet-750 border border-violet-200 animate-pulse"
                    }`}>
                      {mission.status}
                    </span>
                  </div>

                  {/* Flight Orthophoto processing progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[8px] text-slate-500">
                      <span>Orthomapping Image stitching:</span>
                      <span className="font-bold">{mission.progress}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-600 transition-all" style={{ width: `${mission.progress}%` }}></div>
                    </div>
                  </div>

                  {mission.orthophotoUrl && (
                    <div className="relative aspect-[31/10] w-full rounded border border-slate-250 overflow-hidden">
                      <img src={mission.orthophotoUrl} alt="orthophoto" className="object-cover w-full h-full opacity-80 hover:opacity-100 transition" referrerPolicy="no-referrer" />
                      <div className="absolute top-1 left-1 bg-white/90 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[7px] text-slate-800 font-bold tracking-wider uppercase">
                        Orthophoto stitched (12cm GSD)
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* IoT Total Station Anchor streams */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5 shadow-xs">
            <h3 className="font-sans font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-600" />
              National Land IoT Stations Live Telemetry
            </h3>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {iotSensors.map((sensor) => (
                <div key={sensor.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                  <div>
                    <span className="font-bold text-slate-800 text-[10.5px] block">{sensor.name}</span>
                    <span className="font-mono text-emerald-700 text-[9px] block mt-0.5 font-bold">{sensor.reading}</span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                </div>
              ))}
            </div>
          </div>

        </div>
        </div>

        {/* Bulk Export Executive Dashboard Section */}
        <div className="bg-white rounded border border-slate-200 shadow-xs p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold">4</span>
            <h3 className="font-sans font-bold text-slate-700 text-[11px]">Bulk Export & Reports</h3>
          </div>
          <div className="flex items-center justify-between border-b border-slate-150 pb-2">
            <h3 className="font-sans font-bold text-slate-850 text-xs flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Administrative Bulk Ledger & Report Exporter (LAIS Protocol)
            </h3>
            <span className="text-[8.5px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200 font-mono tracking-wider">
              LEDGER AUDIT: ENABLED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Form Section */}
            <div className="md:col-span-8 space-y-3">
              
              {/* Select Datasets Checkbox Group */}
              <div className="space-y-1.5">
                <span className="block text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">
                  1. Select Ledger Components to Include in Bulk Package
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`p-2 rounded border flex flex-col justify-between cursor-pointer select-none transition ${
                    includeParcels 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}>
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-tight">Parcel Register</span>
                      <input 
                        type="checkbox" 
                        checked={includeParcels} 
                        onChange={() => setIncludeParcels(!includeParcels)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                      />
                    </div>
                    <span className={`text-[8px] mt-1 ${includeParcels ? "text-slate-300" : "text-slate-400"}`}>
                      All property bounds, land use, and ownership IDs
                    </span>
                  </label>

                  <label className={`p-2 rounded border flex flex-col justify-between cursor-pointer select-none transition ${
                    includeDisputes 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}>
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-tight">Conflict Ledger</span>
                      <input 
                        type="checkbox" 
                        checked={includeDisputes} 
                        onChange={() => setIncludeDisputes(!includeDisputes)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                      />
                    </div>
                    <span className={`text-[8px] mt-1 ${includeDisputes ? "text-slate-300" : "text-slate-400"}`}>
                      Logged land disputes, claimants, severity, status
                    </span>
                  </label>

                  <label className={`p-2 rounded border flex flex-col justify-between cursor-pointer select-none transition ${
                    includeTaxes 
                      ? "bg-slate-900 border-slate-900 text-white" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}>
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-tight">Tax & Revenue</span>
                      <input 
                        type="checkbox" 
                        checked={includeTaxes} 
                        onChange={() => setIncludeTaxes(!includeTaxes)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                      />
                    </div>
                    <span className={`text-[8px] mt-1 ${includeTaxes ? "text-slate-300" : "text-slate-400"}`}>
                      Annual tax rates, UPI payment checks, and dues
                    </span>
                  </label>
                </div>
              </div>

              {/* District & Format selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[8.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    2. Geographic Scope Filter
                  </label>
                  <select
                    value={bulkDistrict}
                    onChange={(e: any) => setBulkDistrict(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px] text-slate-800 font-sans font-bold outline-none cursor-pointer focus:bg-white focus:border-indigo-400"
                  >
                    <option value="All">All Districts (National Aggregate)</option>
                    <option value="Gasabo">Gasabo District</option>
                    <option value="Kicukiro">Kicukiro District</option>
                    <option value="Nyarugenge">Nyarugenge District</option>
                    <option value="Musanze">Musanze District</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[8.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    3. Report Format & Encoding
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                    {(["PDF", "XLS", "CSV"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setBulkExportFormat(fmt)}
                        className={`py-1 rounded text-[9.5px] font-bold cursor-pointer transition ${
                          bulkExportFormat === fmt 
                            ? "bg-slate-900 text-white shadow-xs" 
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {fmt === "XLS" ? "Excel" : fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Export Action Button */}
              <button
                type="button"
                onClick={handleBulkExport}
                disabled={bulkExporting || (!includeParcels && !includeDisputes && !includeTaxes)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded flex items-center justify-center gap-1.5 transition text-[11px] cursor-pointer shadow-xs"
              >
                {bulkExporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Assembling Ledger Package, Sealing Digital Signatures...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Compile & Export Selected Land Reports ({bulkExportFormat})
                  </>
                )}
              </button>

            </div>

            {/* Audit Logs Sidebar */}
            <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded p-2.5 space-y-2.5">
              <span className="block text-[8.5px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-1">
                Security & Verification Ledger
              </span>
              
              {/* History list */}
              <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-0.5">
                {exportHistory.length === 0 ? (
                  <p className="text-slate-400 text-[9px] text-center py-4">No active exports recorded in current session.</p>
                ) : (
                  exportHistory.map((h) => (
                    <div key={h.id} className="bg-white p-1.5 rounded border border-slate-150 text-[9.5px] leading-tight space-y-0.5 shadow-2xs">
                      <div className="flex justify-between items-center text-[8px] font-mono text-slate-400 font-bold">
                        <span>ID: {h.id}</span>
                        <span>{h.timestamp}</span>
                      </div>
                      <p className="font-semibold text-slate-700 truncate">{h.name}</p>
                      <div className="flex justify-between text-[8px] font-mono text-slate-500">
                        <span>Format: <b className="text-indigo-600">{h.format}</b></span>
                        <span>Size: {h.size}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="text-[8px] text-slate-400 leading-normal pt-1.5 border-t border-slate-200">
                <span className="font-bold text-slate-500 block">✓ Encoded with UTF-8 BOM</span>
                Includes geodetic references, system metadata hashes, and tax validation streams.
              </div>
            </div>

          </div>

          {/* Quick Individual Exporters for Legacy Systems */}
          <div className="pt-2 border-t border-slate-150 flex items-center justify-between text-[9.5px] text-slate-500">
            <span>Legacy District Quick CSV Download:</span>
            <div className="flex items-center gap-1.5">
              <select
                id="select_export_district"
                value={selectedReportDistrict}
                onChange={(e) => setSelectedReportDistrict(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[9.5px] text-slate-700 font-sans outline-none cursor-pointer"
              >
                <option value="Gasabo">Gasabo District</option>
                <option value="Kicukiro">Kicukiro District</option>
                <option value="Nyarugenge">Nyarugenge District</option>
                <option value="Musanze">Musanze District</option>
              </select>
              <button
                type="button"
                onClick={triggerMockReportDownload}
                disabled={isExporting}
                className="px-2 py-0.5 bg-slate-250 hover:bg-slate-300 text-slate-700 font-bold rounded border border-slate-350 transition shrink-0 cursor-pointer"
              >
                {isExporting ? "Compiling..." : "Download CSV"}
              </button>
            </div>
          </div>
        </div>
        </div>

      </div>
      )}
    </div>
  );
});

export default AnalyticsDashboard;

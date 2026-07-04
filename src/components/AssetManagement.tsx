/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, memo } from "react";
import { SurveyEquipment, EquipmentLog } from "../types";
import { 
  Wrench, Battery, Shield, CheckCircle2, AlertTriangle, XCircle, 
  User, ClipboardList, Plus, Search, Calendar, Tag, RefreshCw, 
  MapPin, Radio, Compass, ArrowRightLeft, Download,
  Clock, BarChart3, Activity, Gauge, Map as MapIcon
} from "lucide-react";

// Calibration thresholds (in days)
const CALIBRATION_DUE_DAYS = 180;
const CALIBRATION_WARN_DAYS = 30;

function getCalibrationStatus(lastCal: string): { status: "ok" | "due" | "overdue"; daysUntilDue: number } {
  const last = new Date(lastCal);
  const due = new Date(last);
  due.setDate(due.getDate() + CALIBRATION_DUE_DAYS);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysUntilDue < 0) return { status: "overdue", daysUntilDue };
  if (daysUntilDue <= CALIBRATION_WARN_DAYS) return { status: "due", daysUntilDue };
  return { status: "ok", daysUntilDue };
}

// Initial mock equipment data
const INITIAL_EQUIPMENT: SurveyEquipment[] = [
  {
    id: "eq-101",
    name: "RTK GNSS Receiver Alpha",
    category: "RTK GNSS Receiver",
    model: "Trimble R12i",
    serialNumber: "TR-998822-X",
    status: "Available",
    batteryLevel: 94,
    lastCalibrated: "2026-05-10",
    calibrationDue: "2026-11-06",
    location: "Gasabo District Office - Vault A",
    coordinates: [225, 197],
    logs: [
      {
        id: "log-1",
        timestamp: "2026-07-01T09:00:00Z",
        surveyorId: "sv-101",
        surveyorName: "Pierre Claver Mugisha",
        action: "Returned",
        details: "Returned GNSS receiver after boundary survey at Gasasa village. Cleaned and fully charged."
      },
      {
        id: "log-2",
        timestamp: "2026-06-30T07:15:00Z",
        surveyorId: "sv-101",
        surveyorName: "Pierre Claver Mugisha",
        action: "Checked Out",
        details: "Field adjudication for UPI 1/02/11/04/1844."
      }
    ]
  },
  {
    id: "eq-102",
    name: "CORS Differential Base Node 04",
    category: "CORS Base Station",
    model: "Leica GR50 Reference Receiver",
    serialNumber: "LE-884411-C",
    status: "In Use",
    batteryLevel: 100,
    lastCalibrated: "2026-01-15",
    calibrationDue: "2026-07-14",
    location: "Kacyiru Sector - RLMUA Base Station Tower",
    coordinates: [450, 120],
    assignedSurveyorId: "sv-102",
    assignedSurveyorName: "Dative Uwase",
    logs: [
      {
        id: "log-3",
        timestamp: "2026-06-28T06:00:00Z",
        surveyorId: "sv-102",
        surveyorName: "Dative Uwase",
        action: "Checked Out",
        details: "Assigned as primary RTK base correction stream for Kacyiru Sector mapping."
      }
    ]
  },
  {
    id: "eq-103",
    name: "Multispectral Surveying Drone",
    category: "Survey Drone",
    model: "DJI Matrice 300 RTK",
    serialNumber: "DJI-M300-44910",
    status: "Maintenance",
    batteryLevel: 45,
    lastCalibrated: "2026-06-20",
    calibrationDue: "2026-12-17",
    location: "Drone Hangar - Kigali International Airport",
    coordinates: [280, 140],
    logs: [
      {
        id: "log-4",
        timestamp: "2026-07-02T08:15:00Z",
        surveyorId: "sv-103",
        surveyorName: "Jean de Dieu Turatsinze",
        action: "Reported Issue",
        details: "Left rear rotor hub exhibits minor vibration. Grounded for diagnostics."
      },
      {
        id: "log-5",
        timestamp: "2026-06-12T14:30:00Z",
        surveyorId: "sv-101",
        surveyorName: "Pierre Claver Mugisha",
        action: "Returned",
        details: "Completed 4K aerial photogrammetry sweep of Gasabo valley."
      }
    ]
  },
  {
    id: "eq-104",
    name: "Precision Total Station 3000",
    category: "Total Station",
    model: "Topcon GT-1200",
    serialNumber: "TP-552211-P",
    status: "Available",
    batteryLevel: 82,
    lastCalibrated: "2026-04-18",
    calibrationDue: "2026-10-15",
    location: "Gasabo District Office - Vault B",
    coordinates: [300, 240],
    logs: [
      {
        id: "log-6",
        timestamp: "2026-06-25T11:00:00Z",
        surveyorId: "sv-104",
        surveyorName: "Marie Claire Nyinawumuntu",
        action: "Returned",
        details: "Prism and base tribrach calibrated. Stored in secondary vault."
      }
    ]
  },
  {
    id: "eq-105",
    name: "RTK GNSS Receiver Beta",
    category: "RTK GNSS Receiver",
    model: "Trimble R12i",
    serialNumber: "TR-998822-Y",
    status: "In Use",
    batteryLevel: 28,
    lastCalibrated: "2026-05-15",
    calibrationDue: "2026-11-11",
    location: "Field - Kimihurura Sector (UPI 1/02/11/04/1844)",
    coordinates: [340, 310],
    assignedSurveyorId: "sv-101",
    assignedSurveyorName: "Pierre Claver Mugisha",
    logs: [
      {
        id: "log-7",
        timestamp: "2026-07-02T07:30:00Z",
        surveyorId: "sv-101",
        surveyorName: "Pierre Claver Mugisha",
        action: "Checked Out",
        details: "Taking to Kimihurura sector for boundary dispute stakeout."
      }
    ]
  }
];

const REGISTERED_SURVEYORS = [
  { id: "sv-101", name: "Pierre Claver Mugisha" },
  { id: "sv-102", name: "Dative Uwase" },
  { id: "sv-103", name: "Jean de Dieu Turatsinze" },
  { id: "sv-104", name: "Marie Claire Nyinawumuntu" }
];

const AssetManagement = memo(function AssetManagement() {
  const [equipment, setEquipment] = useState<SurveyEquipment[]>(() => {
    const saved = localStorage.getItem("lais_survey_assets");
    return saved ? JSON.parse(saved) : INITIAL_EQUIPMENT;
  });

  const saveToLocalStorage = (data: SurveyEquipment[]) => {
    localStorage.setItem("lais_survey_assets", JSON.stringify(data));
  };

  const [activeTab, setActiveTab] = useState<"All" | "RTK GNSS Receiver" | "Total Station" | "Survey Drone" | "CORS Base Station">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Available" | "In Use" | "Maintenance" | "Retired">("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Transaction States
  const [selectedAsset, setSelectedAsset] = useState<SurveyEquipment | null>(null);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Form Fields for Check-Out/Return
  const [targetSurveyorId, setTargetSurveyorId] = useState(REGISTERED_SURVEYORS[0].id);
  const [logDetails, setLogDetails] = useState("");
  const [customAction, setCustomAction] = useState<"Checked Out" | "Returned" | "Status Changed" | "Reported Issue">("Checked Out");

  // Form Fields for Adding New Equipment
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<SurveyEquipment["category"]>("RTK GNSS Receiver");
  const [newModel, setNewModel] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newBattery, setNewBattery] = useState(100);

  // Status Style Helpers
  // Calibration badge helper
  const getCalibrationBadge = (item: SurveyEquipment) => {
    if (!item.lastCalibrated) return null;
    const { status, daysUntilDue } = getCalibrationStatus(item.lastCalibrated);
    switch (status) {
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-2.5 h-2.5" />
            Overdue {Math.abs(daysUntilDue)}d
          </span>
        );
      case "due":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Calendar className="w-2.5 h-2.5" />
            Due in {daysUntilDue}d
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {daysUntilDue}d remaining
          </span>
        );
    }
  };

  const getStatusBadge = (status: SurveyEquipment["status"]) => {
    switch (status) {
      case "Available":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Available
          </span>
        );
      case "In Use":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Radio className="w-3 h-3 text-blue-600 animate-pulse" />
            In Use
          </span>
        );
      case "Maintenance":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Wrench className="w-3 h-3 text-amber-600" />
            Maintenance
          </span>
        );
      case "Retired":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Retired
          </span>
        );
      default:
        return null;
    }
  };

  // Toggle quick availability (Available vs Maintenance)
  const handleToggleAvailability = (assetId: string) => {
    const updated = equipment.map((asset) => {
      if (asset.id === assetId) {
        const nextStatus: SurveyEquipment["status"] = asset.status === "Available" ? "Maintenance" : "Available";
        const detailsStr = `Equipment availability toggled. Status changed from ${asset.status} to ${nextStatus}.`;
        
        const newLog: EquipmentLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          surveyorId: "admin",
          surveyorName: "District Administrator",
          action: "Status Changed",
          details: detailsStr
        };

        return {
          ...asset,
          status: nextStatus,
          assignedSurveyorId: undefined,
          assignedSurveyorName: undefined,
          logs: [newLog, ...asset.logs]
        };
      }
      return asset;
    });

    setEquipment(updated);
    saveToLocalStorage(updated);
    
    // update current selected if open
    if (selectedAsset && selectedAsset.id === assetId) {
      setSelectedAsset(updated.find(a => a.id === assetId) || null);
    }
  };

  // Check out equipment to a surveyor
  const handleCheckOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    const surveyor = REGISTERED_SURVEYORS.find(s => s.id === targetSurveyorId);
    if (!surveyor) return;

    const updated = equipment.map((asset) => {
      if (asset.id === selectedAsset.id) {
        const newLog: EquipmentLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          surveyorId: surveyor.id,
          surveyorName: surveyor.name,
          action: "Checked Out",
          details: logDetails.trim() || `Checked out for fieldwork by ${surveyor.name}.`
        };

        return {
          ...asset,
          status: "In Use" as const,
          assignedSurveyorId: surveyor.id,
          assignedSurveyorName: surveyor.name,
          logs: [newLog, ...asset.logs]
        };
      }
      return asset;
    });

    setEquipment(updated);
    saveToLocalStorage(updated);
    setSelectedAsset(updated.find(a => a.id === selectedAsset.id) || null);
    setIsCheckOutModalOpen(false);
    setLogDetails("");
  };

  // Return equipment
  const handleReturn = (assetId: string) => {
    const asset = equipment.find(a => a.id === assetId);
    if (!asset || !asset.assignedSurveyorId) return;

    const updated = equipment.map((item) => {
      if (item.id === assetId) {
        const newLog: EquipmentLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          surveyorId: item.assignedSurveyorId || "unknown",
          surveyorName: item.assignedSurveyorName || "Surveyor",
          action: "Returned",
          details: "Returned to the District Office equipment vault. Checked and ready for use."
        };

        return {
          ...item,
          status: "Available" as const,
          assignedSurveyorId: undefined,
          assignedSurveyorName: undefined,
          logs: [newLog, ...item.logs]
        };
      }
      return item;
    });

    setEquipment(updated);
    saveToLocalStorage(updated);
    if (selectedAsset && selectedAsset.id === assetId) {
      setSelectedAsset(updated.find(a => a.id === assetId) || null);
    }
  };

  // Record a general issue or status log
  const handleRecordLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    const updated = equipment.map((asset) => {
      if (asset.id === selectedAsset.id) {
        const newLog: EquipmentLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          surveyorId: "admin",
          surveyorName: "District Administrator",
          action: customAction,
          details: logDetails.trim() || `Recorded action: ${customAction}.`
        };

        let updatedStatus = asset.status;
        if (customAction === "Reported Issue") {
          updatedStatus = "Maintenance";
        }

        return {
          ...asset,
          status: updatedStatus,
          logs: [newLog, ...asset.logs]
        };
      }
      return asset;
    });

    setEquipment(updated);
    saveToLocalStorage(updated);
    setSelectedAsset(updated.find(a => a.id === selectedAsset.id) || null);
    setIsLogModalOpen(false);
    setLogDetails("");
  };

  // Add a brand new device
  const handleAddNewEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSerial) return;

    const newDevice: SurveyEquipment = {
      id: `eq-${Date.now().toString().substring(8)}`,
      name: newName,
      category: newCategory,
      model: newModel || "Generic Standard",
      serialNumber: newSerial,
      status: "Available",
      batteryLevel: Number(newBattery) || 100,
      lastCalibrated: new Date().toISOString().split("T")[0],
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          surveyorId: "admin",
          surveyorName: "District Administrator",
          action: "Status Changed",
          details: `Registered new ${newCategory} device on the blockchain ledger.`
        }
      ]
    };

    const updated = [newDevice, ...equipment];
    setEquipment(updated);
    saveToLocalStorage(updated);

    setIsAddNewOpen(false);
    setNewName("");
    setNewModel("");
    setNewSerial("");
    setNewBattery(100);
  };

  // Dashboard view toggle
  const [showDashboard, setShowDashboard] = useState(false);

  // Utilization metrics
  const metrics = useMemo(() => {
    const total = equipment.length;
    const checkedOut = equipment.filter(e => e.status === "In Use").length;
    const available = equipment.filter(e => e.status === "Available").length;
    const maintenance = equipment.filter(e => e.status === "Maintenance").length;
    const retired = equipment.filter(e => e.status === "Retired").length;

    const utilizationRate = total > 0 ? Math.round((checkedOut / total) * 100) : 0;
    const availabilityRate = total > 0 ? Math.round((available / total) * 100) : 0;

    const overdueCal = equipment.filter(e => {
      if (!e.lastCalibrated) return false;
      return getCalibrationStatus(e.lastCalibrated).status === "overdue";
    }).length;
    const dueCal = equipment.filter(e => {
      if (!e.lastCalibrated) return false;
      return getCalibrationStatus(e.lastCalibrated).status === "due";
    }).length;

    const lowBattery = equipment.filter(e => e.batteryLevel !== undefined && e.batteryLevel < 30).length;

    const categoryBreakdown: Record<string, number> = {};
    equipment.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
    });

    return { total, checkedOut, available, maintenance, retired, utilizationRate, availabilityRate, overdueCal, dueCal, lowBattery, categoryBreakdown };
  }, [equipment]);

  // Export Inventory as CSV
  const handleExportCSV = () => {
    const headers = ["Name", "Category", "Model", "Serial", "Status", "Battery", "Location", "Assigned To", "Last Calibrated", "Calibration Status"];
    const rows = equipment.map(item => {
      const calStatus = item.lastCalibrated ? getCalibrationStatus(item.lastCalibrated).status : "unknown";
      return [
        item.name,
        item.category,
        item.model,
        item.serialNumber,
        item.status,
        item.batteryLevel !== undefined ? `${item.batteryLevel}%` : "N/A",
        item.location || "N/A",
        item.assignedSurveyorName || "—",
        item.lastCalibrated,
        calStatus
      ];
    });

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `survey_equipment_inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filters calculation
  const filteredEquipment = equipment.filter((item) => {
    const matchesCategory = activeTab === "All" || item.category === activeTab;
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.model.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.assignedSurveyorName && item.assignedSurveyorName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      
      {/* HEADER SECTION */}
      <div className="bg-slate-900 p-3.5 text-white flex items-center justify-between border-b border-slate-950">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-emerald-400" />
          <div>
            <h3 className="font-sans font-bold text-xs uppercase tracking-wider">Survey Asset Registry</h3>
            <p className="text-[9px] text-slate-400">Manage CORS receivers, drones & geodetic hardware</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsAddNewOpen(!isAddNewOpen)}
          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Asset
        </button>
      </div>

      {/* SUMMARY STATS & SEARCH ROW */}
      <div className="p-2.5 bg-white border-b border-slate-200 space-y-2">
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
            <span className="text-[8px] font-sans text-slate-400 font-bold uppercase block">Total</span>
            <span className="text-xs font-mono font-bold text-slate-800">{metrics.total}</span>
          </div>
          <div className="bg-emerald-50/50 p-1.5 rounded border border-emerald-100">
            <span className="text-[8px] font-sans text-emerald-600 font-bold uppercase block">Ready</span>
            <span className="text-xs font-mono font-bold text-emerald-700">{metrics.available}</span>
          </div>
          <div className="bg-blue-50/50 p-1.5 rounded border border-blue-100">
            <span className="text-[8px] font-sans text-blue-600 font-bold uppercase block">In Field</span>
            <span className="text-xs font-mono font-bold text-blue-700">{metrics.checkedOut}</span>
          </div>
          <div className="bg-amber-50/50 p-1.5 rounded border border-amber-100">
            <span className="text-[8px] font-sans text-amber-600 font-bold uppercase block">Service</span>
            <span className="text-xs font-mono font-bold text-amber-700">{metrics.maintenance}</span>
          </div>
        </div>

        {/* SEARCH AND FILTER FORM */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
            <input
              type="text"
              placeholder="Search serial, model, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1.5 text-[10.5px] font-sans outline-none focus:bg-white focus:border-indigo-400 text-slate-800"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded px-1.5 outline-none cursor-pointer hover:bg-slate-100"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="In Use">In Use</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Retired">Retired</option>
          </select>

          <button
            onClick={handleExportCSV}
            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
            title="Export Inventory CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className={`px-2 py-1.5 border rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
              showDashboard ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Toggle Equipment Dashboard"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* QUICK ADD NEW ASSET PANE */}
      {isAddNewOpen && (
        <form onSubmit={handleAddNewEquipment} className="p-3 bg-indigo-50 border-b border-indigo-150 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-indigo-900 text-[10.5px] uppercase">Register New Field Hardware</h4>
            <button type="button" onClick={() => setIsAddNewOpen(false)} className="text-[9.5px] font-bold text-indigo-500 hover:text-indigo-800">Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] font-bold text-indigo-600 uppercase mb-0.5">Asset Label Name</label>
              <input
                type="text"
                required
                placeholder="RTK GNSS Receiver Gamma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded p-1 text-[10.5px] text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-indigo-600 uppercase mb-0.5">Category</label>
              <select
                value={newCategory}
                onChange={(e: any) => setNewCategory(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded p-1 text-[10.5px] text-slate-800 outline-none"
              >
                <option value="RTK GNSS Receiver">RTK GNSS Receiver</option>
                <option value="Total Station">Total Station</option>
                <option value="Survey Drone">Survey Drone</option>
                <option value="CORS Base Station">CORS Base Station</option>
              </select>
            </div>
            <div>
              <label className="block text-[8px] font-bold text-indigo-600 uppercase mb-0.5">Manufacturer & Model</label>
              <input
                type="text"
                placeholder="Trimble R12i"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded p-1 text-[10.5px] text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-indigo-600 uppercase mb-0.5">Serial Number</label>
              <input
                type="text"
                required
                placeholder="TR-776655-M"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded p-1 text-[10.5px] text-slate-800 outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] cursor-pointer"
          >
            Deploy and Seal Hardware to Ledger
          </button>
        </form>
      )}

      {/* CATEGORY TABS */}
      <div className="flex border-b border-slate-200 bg-slate-100 p-1 text-[10px] font-bold">
        {(["All", "RTK GNSS Receiver", "Survey Drone", "Total Station", "CORS Base Station"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 rounded text-center transition cursor-pointer ${
              activeTab === tab ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab === "All" ? "All Type" : tab.replace(" Receiver", "").replace(" Station", "")}
          </button>
        ))}
      </div>

      {/* EQUIPMENT DASHBOARD PANEL */}
      {showDashboard && (
        <div className="p-2.5 bg-white border-b border-slate-200 space-y-2.5 animate-fadeIn">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Fleet Analytics</span>
          </div>

          {/* Utilization & Availability Gauges */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Utilization</span>
                <Gauge className="w-3 h-3 text-blue-500" />
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-lg font-mono font-black text-slate-800">{metrics.utilizationRate}%</span>
                <span className="text-[8px] text-slate-400 mb-1">({metrics.checkedOut}/{metrics.total} in field)</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${metrics.utilizationRate}%` }} />
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Availability</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-lg font-mono font-black text-slate-800">{metrics.availabilityRate}%</span>
                <span className="text-[8px] text-slate-400 mb-1">({metrics.available}/{metrics.total} ready)</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${metrics.availabilityRate}%` }} />
              </div>
            </div>
          </div>

          {/* Alerts Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-rose-50/60 p-1.5 rounded border border-rose-200 text-center">
              <AlertTriangle className="w-3 h-3 text-rose-500 mx-auto mb-0.5" />
              <span className="block text-[9px] font-mono font-bold text-rose-700">{metrics.overdueCal}</span>
              <span className="text-[7px] font-bold text-rose-500 uppercase tracking-wider">Overdue Cal</span>
            </div>
            <div className="bg-amber-50/60 p-1.5 rounded border border-amber-200 text-center">
              <Calendar className="w-3 h-3 text-amber-500 mx-auto mb-0.5" />
              <span className="block text-[9px] font-mono font-bold text-amber-700">{metrics.dueCal}</span>
              <span className="text-[7px] font-bold text-amber-500 uppercase tracking-wider">Due Cal</span>
            </div>
            <div className="bg-rose-50/60 p-1.5 rounded border border-rose-200 text-center">
              <Battery className="w-3 h-3 text-rose-500 mx-auto mb-0.5" />
              <span className="block text-[9px] font-mono font-bold text-rose-700">{metrics.lowBattery}</span>
              <span className="text-[7px] font-bold text-rose-500 uppercase tracking-wider">Low Battery</span>
            </div>
          </div>

          {/* Category Breakdown Bar */}
          <div className="space-y-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">By Category</span>
            <div className="flex gap-1 h-3">
              {Object.entries(metrics.categoryBreakdown).map(([cat, count], idx) => {
                const pct = Math.round(((count as number) / metrics.total) * 100);
                const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];
                return (
                  <div
                    key={cat}
                    className={`${colors[idx % colors.length]} rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${cat}: ${count} (${pct}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[7.5px] text-slate-500 font-mono">
              {Object.entries(metrics.categoryBreakdown).map(([cat, count], idx) => {
                const colors = ["text-blue-600", "text-emerald-600", "text-amber-600", "text-violet-600", "text-rose-600"];
                return (
                  <span key={cat} className={`flex items-center gap-1 ${colors[idx % colors.length]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors[idx % colors.length].replace("text", "bg")}`} />
                    {cat.replace(" Receiver", "").replace(" Station", "")}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LAYOUT BODY: Split panel on selection or single-grid list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredEquipment.length === 0 ? (
          <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded">
            <ClipboardList className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-slate-400 text-xs">No survey gear found matching criteria.</p>
          </div>
        ) : (
          filteredEquipment.map((item) => (
            <div 
              key={item.id} 
              id={`device_card_${item.id}`}
              className={`bg-white border rounded-lg transition shadow-2xs hover:border-slate-350 ${
                selectedAsset?.id === item.id ? "border-indigo-400 ring-1 ring-indigo-100" : "border-slate-200"
              }`}
            >
              {/* Device Summary Row */}
              <div 
                className="p-2.5 flex items-start justify-between gap-2.5 cursor-pointer"
                onClick={() => setSelectedAsset(selectedAsset?.id === item.id ? null : item)}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-sans font-extrabold text-[11px] text-slate-800 leading-tight">{item.name}</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.25 rounded font-mono uppercase tracking-tight">
                      {item.serialNumber}
                    </span>
                    {item.lastCalibrated && getCalibrationBadge(item)}
                  </div>
                  
                  <div className="flex items-center gap-2.5 text-[9.5px] text-slate-500">
                    <span className="font-semibold text-slate-400">{item.category} • {item.model}</span>
                    {item.batteryLevel !== undefined && (
                      <span className={`flex items-center gap-0.5 text-[9px] font-mono font-semibold ${item.batteryLevel < 30 ? "text-rose-500" : ""}`}>
                        <Battery className={`w-3 h-3 ${item.batteryLevel < 30 ? "text-rose-500" : "text-slate-500"}`} />
                        {item.batteryLevel}%
                      </span>
                    )}
                  </div>

                  {item.location && (
                    <div className="flex items-center gap-1 text-[8px] text-slate-400">
                      <MapPin className="w-2.5 h-2.5 text-slate-400" />
                      <span className="truncate">{item.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {getStatusBadge(item.status)}
                  {item.assignedSurveyorName && (
                    <span className="text-[8px] font-sans font-bold text-slate-500 flex items-center gap-0.5">
                      <User className="w-2.5 h-2.5 text-blue-500" />
                      {item.assignedSurveyorName}
                    </span>
                  )}
                </div>
              </div>

              {/* Collapsed / Expanded Details Pane */}
              {selectedAsset?.id === item.id && (
                <div className="border-t border-slate-150 bg-slate-50/75 p-2.5 space-y-3 text-xs text-slate-700">
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded border border-slate-150">
                    <div>
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Last Calibrated</span>
                      <span className="font-mono font-bold text-slate-800">{item.lastCalibrated}</span>
                      {item.calibrationDue && (
                        <div className="mt-0.5">{getCalibrationBadge(item)}</div>
                      )}
                    </div>
                    <div>
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Hardware ID Node</span>
                      <span className="font-mono font-bold text-slate-800 text-[9px] truncate block">{item.id}</span>
                      {item.location && (
                        <span className="text-[8px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Equipment Location Mini-Map */}
                  {item.coordinates && (
                    <div className="bg-white p-2 rounded border border-slate-150">
                      <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        <MapIcon className="w-3 h-3" />
                        Equipment Position (Kigali GIS Grid)
                      </div>
                      <div className="relative bg-slate-900 rounded overflow-hidden" style={{ height: 48 }}>
                        {/* Simulated GIS backdrop grid lines */}
                        <svg viewBox="0 0 800 60" className="w-full h-full opacity-20">
                          {[0, 100, 200, 300, 400, 500, 600, 700].map(x => (
                            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={60} stroke="#94a3b8" strokeWidth={0.5} />
                          ))}
                          {[0, 15, 30, 45, 60].map(y => (
                            <line key={`h${y}`} x1={0} y1={y} x2={800} y2={y} stroke="#94a3b8" strokeWidth={0.5} />
                          ))}
                        </svg>
                        {/* Marker */}
                        <div
                          className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white shadow-lg animate-pulse"
                          style={{
                            left: `${(item.coordinates[0] / 800) * 100}%`,
                            top: `${(item.coordinates[1] / 60) * 100}%`,
                          }}
                        />
                        <div className="absolute bottom-0.5 right-1 text-[7px] font-mono text-slate-500 bg-slate-950/80 px-1 rounded">
                          Grid: ({item.coordinates[0]}, {item.coordinates[1]})
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTION CONTROLS */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.status === "Available" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAsset(item);
                          setIsCheckOutModalOpen(true);
                        }}
                        className="flex-1 py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Check Out Gear
                      </button>
                    ) : item.status === "In Use" ? (
                      <button
                        type="button"
                        onClick={() => handleReturn(item.id)}
                        className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Log Return Vault
                      </button>
                    ) : null}

                    {/* Toggle Availability Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(item.id)}
                      className={`py-1 px-2.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                        item.status === "Available"
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}
                      title={item.status === "Available" ? "Mark as Maintenance" : "Mark as Available"}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      {item.status === "Available" ? "Flag Maintenance" : "Flag Available"}
                    </button>

                    {/* File Log/Issue button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAsset(item);
                        setIsLogModalOpen(true);
                      }}
                      className="py-1 px-2.5 bg-slate-200 hover:bg-slate-250 text-slate-700 font-bold rounded border border-slate-300 text-[10px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Add Log
                    </button>
                  </div>

                  {/* EQUIPMENT TIMELINE HISTORY */}
                  <div className="space-y-1.5">
                    <h5 className="font-bold text-[9px] uppercase text-slate-500 tracking-wider">Device Ledger Audit Trail</h5>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {item.logs.map((log) => (
                        <div key={log.id} className="bg-white p-2 rounded border border-slate-150 space-y-0.5">
                          <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                            <span className="flex items-center gap-1 font-sans font-bold text-slate-600">
                              <User className="w-2.5 h-2.5 text-indigo-400" />
                              {log.surveyorName} ({log.surveyorId})
                            </span>
                            <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className={`text-[8.5px] font-bold px-1 rounded uppercase tracking-tighter shrink-0 mt-0.5 ${
                              log.action === "Checked Out" ? "bg-blue-50 text-blue-600" :
                              log.action === "Returned" ? "bg-emerald-50 text-emerald-600" :
                              log.action === "Reported Issue" ? "bg-rose-50 text-rose-600" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {log.action}
                            </span>
                            <p className="text-[9.5px] font-sans text-slate-600 leading-relaxed font-medium">{log.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* CHECK-OUT MODAL PROMPT */}
      {isCheckOutModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-sm w-full p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
              <h4 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-tight">Check Out Equipment</h4>
              <button onClick={() => setIsCheckOutModalOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCheckOut} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2 rounded border border-slate-150">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Device</span>
                <span className="font-bold text-slate-800 text-[11px]">{selectedAsset.name} ({selectedAsset.serialNumber})</span>
              </div>

              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">Select Licensed Surveyor</label>
                <select
                  value={targetSurveyorId}
                  onChange={(e) => setTargetSurveyorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-400 text-slate-800"
                >
                  {REGISTERED_SURVEYORS.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">Mission / Field Log Details</label>
                <textarea
                  placeholder="e.g. Dispatched for active survey of UPI 1/02/11/04/1844..."
                  rows={2}
                  value={logDetails}
                  onChange={(e) => setLogDetails(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-400 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCheckOutModalOpen(false)}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300 text-[10.5px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10.5px] cursor-pointer"
                >
                  Authorize Checkout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD CUSTOM LOG MODAL */}
      {isLogModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-sm w-full p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
              <h4 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-tight">Record Hardware Log Event</h4>
              <button onClick={() => setIsLogModalOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleRecordLog} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2 rounded border border-slate-150">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Device</span>
                <span className="font-bold text-slate-800 text-[11px]">{selectedAsset.name} ({selectedAsset.serialNumber})</span>
              </div>

              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">Select Event Type</label>
                <select
                  value={customAction}
                  onChange={(e: any) => setCustomAction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-400 text-slate-800"
                >
                  <option value="Status Changed">Status Changed</option>
                  <option value="Reported Issue">Reported Issue (Flags maintenance)</option>
                  <option value="Returned">Returned</option>
                </select>
              </div>

              <div>
                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">Details & Diagnostics Notes</label>
                <textarea
                  placeholder="Describe status changes, minor problems, battery replacements, calibration details..."
                  rows={3}
                  value={logDetails}
                  required
                  onChange={(e) => setLogDetails(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-400 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300 text-[10.5px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10.5px] cursor-pointer"
                >
                  Write Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
});

export default AssetManagement;

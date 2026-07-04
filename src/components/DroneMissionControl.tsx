/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { svgToLatLng } from "../utils/geo";
import { 
  Compass, Radio, Navigation, Battery, ShieldAlert, Cpu, 
  Map as MapIcon, Layers, Play, Pause, RotateCcw, Image as ImageIcon, 
  Video, Eye, Scale, Info, Check, Search, Download
} from "lucide-react";
import { LandParcel, ParcelStatus } from "../types";

interface DroneMissionControlProps {
  parcels: LandParcel[];
  onSelectParcel: (parcel: LandParcel | null) => void;
  selectedParcel: LandParcel | null;
}

const DroneMissionControl = memo(function DroneMissionControl({
  parcels,
  onSelectParcel,
  selectedParcel
}: DroneMissionControlProps) {
  // --- Simulation States ---
  const [isFlying, setIsFlying] = useState(true);
  const [flightStatus, setFlightStatus] = useState<"MAPPING_SECTOR_4" | "PAUSED_HOVERING" | "RETURNING_HOME" | "LANDED">("MAPPING_SECTOR_4");
  const [telemetry, setTelemetry] = useState({
    droneId: "DRN-001",
    battery: 88,
    speed: 14.5,
    altitude: 120,
    heading: 45,
    satellites: 21,
    signalStrength: -54, // dBm
    flightTimeSeconds: 872,
    gps: [-1.9542, 30.0894] as [number, number],
  });

  const [mapMode, setMapMode] = useState<"Satellite" | "Street" | "Terrain">("Satellite");
  const [is3DMode, setIs3DMode] = useState(true);
  const [pitch, setPitch] = useState(35); // degrees
  const [bearing, setBearing] = useState(15); // degrees
  const [showOrthophoto, setShowOrthophoto] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchUpi, setSearchUpi] = useState("");
  const [thermalFilter, setThermalFilter] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // --- Active Drone Path History ---
  const [flightPath, setFlightPath] = useState<[number, number][]>([
    [-1.956, 30.085],
    [-1.955, 30.086],
    [-1.9545, 30.087],
    [-1.954, 30.0894]
  ]);

  // --- Map Refs ---
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const droneMarkerRef = useRef<L.Marker | null>(null);
  const flightPathLayerRef = useRef<L.Polyline | null>(null);
  const parcelsLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const orthophotoOverlayRef = useRef<L.ImageOverlay | null>(null);
  const heatmapLayerGroupRef = useRef<L.FeatureGroup | null>(null);

  // --- Tile Layers ---
  const tilesRef = useRef<Record<string, L.TileLayer>>({});

  // Mock Drone Captures
  const capturedImages = [
    { id: "img-1", url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80", title: "Boundary Siting Sector 4", time: "1m 12s ago", gps: "-1.9541, 30.0892" },
    { id: "img-2", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80", title: "CORS Reference Beacon #3", time: "3m 45s ago", gps: "-1.9543, 30.0889" },
    { id: "img-3", url: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80", title: "Wetland Encroachment Buffer", time: "7m 20s ago", gps: "-1.9549, 30.0874" },
    { id: "img-4", url: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=600&q=80", title: "Gasabo Cooperative Border", time: "10m 05s ago", gps: "-1.9552, 30.0861" }
  ];

  // Map Tile definitions
  const MAP_TILES = {
    Satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    Street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    Terrain: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
  };

  // --- 1. Simulation Loop ---
  useEffect(() => {
    if (!isFlying) return;

    const interval = setInterval(() => {
      setTelemetry(prev => {
        let newGps = [...prev.gps] as [number, number];
        let newHeading = prev.heading;
        let newAltitude = prev.altitude;
        let newSpeed = prev.speed;
        let newBattery = prev.battery;

        if (flightStatus === "MAPPING_SECTOR_4") {
          // Circular orbits around center
          const time = Date.now() * 0.0004;
          const radiusLat = 0.0018;
          const radiusLng = 0.0018;
          const centerLat = -1.95420;
          const centerLng = 30.08940;
          
          newGps = [
            centerLat + Math.sin(time) * radiusLat,
            centerLng + Math.cos(time) * radiusLng
          ];
          newHeading = Math.round((Math.atan2(Math.cos(time), -Math.sin(time)) * 180) / Math.PI + 360) % 360;
          newAltitude = Math.round(120 + Math.sin(time * 3) * 3);
          newSpeed = parseFloat((14.5 + Math.cos(time * 2) * 1.5).toFixed(1));
          newBattery = Math.max(5, prev.battery - 0.05);
        } else if (flightStatus === "RETURNING_HOME") {
          // Fly directly toward Home coordinate (-1.9542, 30.0894)
          const target = [-1.9542, 30.0894];
          const dLat = target[0] - prev.gps[0];
          const dLng = target[1] - prev.gps[1];
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          if (dist < 0.0001) {
            setFlightStatus("LANDED");
            setIsFlying(false);
            newAltitude = 0;
            newSpeed = 0;
          } else {
            // Step closer
            newGps = [
              prev.gps[0] + (dLat / dist) * 0.00025,
              prev.gps[1] + (dLng / dist) * 0.00025
            ];
            newHeading = Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
            newAltitude = Math.max(10, prev.altitude - 2.5);
            newSpeed = 18.0;
            newBattery = Math.max(5, prev.battery - 0.08);
          }
        }

        // Add to flight path history
        setFlightPath(path => {
          const last = path[path.length - 1];
          const distLast = last ? Math.sqrt(Math.pow(last[0] - newGps[0], 2) + Math.pow(last[1] - newGps[1], 2)) : 0;
          if (distLast > 0.00005) {
            return [...path.slice(-50), newGps]; // keep last 50 points
          }
          return path;
        });

        return {
          ...prev,
          gps: newGps,
          heading: newHeading,
          altitude: newAltitude,
          speed: newSpeed,
          battery: parseFloat(newBattery.toFixed(2)),
          flightTimeSeconds: prev.flightTimeSeconds + 1
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isFlying, flightStatus]);

  // --- 2. Leaflet Map Initialization ---
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: [-1.95420, 30.08940],
      zoom: 17,
      zoomControl: false,
      attributionControl: false
    });
    mapRef.current = map;

    // Layer Groups
    parcelsLayerGroupRef.current = L.featureGroup().addTo(map);
    heatmapLayerGroupRef.current = L.featureGroup().addTo(map);

    // Create Tile layers
    tilesRef.current = {
      Satellite: L.tileLayer(MAP_TILES.Satellite, { maxZoom: 20 }),
      Street: L.tileLayer(MAP_TILES.Street, { maxZoom: 19 }),
      Terrain: L.tileLayer(MAP_TILES.Terrain, { maxZoom: 18 })
    };

    // Add default map tile
    tilesRef.current[mapMode].addTo(map);

    // Drone flight path polyline (glowing blue)
    flightPathLayerRef.current = L.polyline([], {
      color: "#3b82f6",
      weight: 3.5,
      opacity: 0.85,
      dashArray: "1, 6"
    }).addTo(map);

    // Custom Drone Icon (glowing quadcopter SVG)
    const droneSVG = `
      <div class="relative w-10 h-10 -ml-5 -mt-5 flex items-center justify-center">
        <span class="absolute w-10 h-10 bg-blue-500/30 rounded-full animate-ping"></span>
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="#00d2ff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-[0_0_8px_rgba(0,210,255,0.85)] animate-spin-slow">
          <circle cx="12" cy="12" r="3" fill="#09152b"></circle>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
          <circle cx="12" cy="4" r="1.5" fill="#ef4444"></circle>
          <circle cx="12" cy="20" r="1.5" fill="#22c55e"></circle>
          <circle cx="4" cy="12" r="1.5" fill="#ef4444"></circle>
          <circle cx="20" cy="12" r="1.5" fill="#ef4444"></circle>
        </svg>
      </div>
    `;

    const droneIcon = L.divIcon({
      html: droneSVG,
      className: "border-none bg-transparent"
    });

    droneMarkerRef.current = L.marker([-1.95420, 30.08940], { icon: droneIcon }).addTo(map);

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- 3. React to Map Mode (Tile switcher) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove active tile layers
    Object.keys(tilesRef.current).forEach(k => {
      if (map.hasLayer(tilesRef.current[k])) {
        map.removeLayer(tilesRef.current[k]);
      }
    });

    // Add selected layer
    tilesRef.current[mapMode].addTo(map);
  }, [mapMode]);

  // --- 4. Render Parcels & Orthophotos ---
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = parcelsLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Render registered parcels
    parcels.forEach((parcel) => {
      const latLngs = parcel.polygon.map(pt => svgToLatLng(pt));
      
      const isSelected = selectedParcel?.id === parcel.id;
      const isDisputed = parcel.status === ParcelStatus.DISPUTED || parcel.upi === "1/02/11/04/1841"; // mark p1 as disputed
      const isVerified = !isDisputed && (parcel.id === "p2" || parcel.id === "p5");

      // Boundary outline
      const polygonLayer = L.polygon(latLngs, {
        color: isDisputed ? "#ef4444" : isSelected ? "#3b82f6" : "#f59e0b",
        weight: isSelected ? 3.5 : 2,
        fillColor: isVerified ? "#22c55e" : isDisputed ? "#ef4444" : "#cbd5e1",
        fillOpacity: isSelected ? 0.3 : 0.08,
        dashArray: isDisputed ? "5, 5" : undefined,
      });

      // Bind Popups with dynamic details
      const popupHTML = `
        <div class="font-sans text-[11px] p-1.5 space-y-1 bg-slate-900 text-slate-100 rounded">
          <strong class="text-blue-400 block border-b border-slate-700 pb-0.5">UPI: ${parcel.upi}</strong>
          <div>Owner: <span class="text-slate-300">${parcel.ownerName}</span></div>
          <div>Area: <span class="text-emerald-400 font-mono font-bold">${parcel.area.toLocaleString()} sqm</span></div>
          <div>Status: <span class="${isDisputed ? 'text-red-400 font-bold' : isVerified ? 'text-green-400 font-bold' : 'text-slate-300'} uppercase">${parcel.status}</span></div>
        </div>
      `;
      polygonLayer.bindPopup(popupHTML, { className: "dark-map-popup" });

      polygonLayer.on("click", () => {
        onSelectParcel(parcel);
      });

      // Add a Permanent Floating Label on the map
      const centerLatLng = svgToLatLng(parcel.center);
      
      const labelHTML = `
        <div class="flex flex-col items-center">
          <span class="px-1.5 py-0.2 bg-slate-950/95 text-slate-100 border border-slate-800 rounded font-mono text-[8px] font-bold tracking-tight shadow-lg flex items-center gap-1">
            ${isVerified ? '<span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>' : isDisputed ? '<span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>' : ''}
            ${parcel.upi.split("/").pop()}
          </span>
          <span class="text-[7.5px] text-slate-400 font-mono font-black tracking-tighter mt-0.5">${(parcel.area / 1000).toFixed(1)}k m²</span>
        </div>
      `;

      const textMarker = L.marker(centerLatLng, {
        icon: L.divIcon({
          html: labelHTML,
          className: "border-none bg-transparent",
          iconSize: [60, 20],
          iconAnchor: [30, 10]
        })
      });

      layerGroup.addLayer(polygonLayer);
      layerGroup.addLayer(textMarker);
    });

    // Handle Orthophoto Layer Overlay
    if (showOrthophoto) {
      // Overlay a detailed satellite orthophoto over gasabo valley (centered coordinates)
      const bounds = L.latLngBounds(
        [-1.9565, 30.086], 
        [-1.9515, 30.092]
      );
      
      // High resolution simulated drone orthophotomap overlay
      const orthophotoOverlay = L.imageOverlay(
        "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80",
        bounds,
        { opacity: 0.55, interactive: false }
      );
      
      orthophotoOverlay.addTo(map);
      orthophotoOverlayRef.current = orthophotoOverlay;
    } else {
      if (orthophotoOverlayRef.current) {
        map.removeLayer(orthophotoOverlayRef.current);
        orthophotoOverlayRef.current = null;
      }
    }

  }, [parcels, selectedParcel, showOrthophoto]);

  // --- 5. Render Simulated Heatmap (Elevation / Vegetation Dense Index) ---
  useEffect(() => {
    const map = mapRef.current;
    const heatmapGroup = heatmapLayerGroupRef.current;
    if (!map || !heatmapGroup) return;

    heatmapGroup.clearLayers();

    if (showHeatmap) {
      // Render simulated heat grid cells (representing drone elevation mapping accuracy or soil moisture index)
      const centerLat = -1.95420;
      const centerLng = 30.08940;
      
      // grid array
      for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
          const cellLat = centerLat + i * 0.0006;
          const cellLng = centerLng + j * 0.0006;
          
          const noise = Math.sin(i * 1.5) * Math.cos(j * 1.5);
          const val = (noise + 1) / 2; // scale to 0-1
          
          let fillColor = "#22c55e"; // low elevation / moisture
          if (val > 0.75) fillColor = "#ef4444"; // super high
          else if (val > 0.45) fillColor = "#eab308"; // moderate
          
          const rect = L.rectangle(
            [[cellLat - 0.00028, cellLng - 0.00028], [cellLat + 0.00028, cellLng + 0.00028]],
            {
              color: "transparent",
              fillColor: fillColor,
              fillOpacity: 0.35,
              interactive: false
            }
          );
          
          heatmapGroup.addLayer(rect);
        }
      }
    }
  }, [showHeatmap]);

  // --- 6. Live Update Telemetry Layers (Drone Marker & Path) ---
  useEffect(() => {
    if (droneMarkerRef.current) {
      droneMarkerRef.current.setLatLng(telemetry.gps);
    }
    if (flightPathLayerRef.current) {
      flightPathLayerRef.current.setLatLngs(flightPath);
    }
  }, [telemetry.gps, flightPath]);

  // --- 7. Fly Map to Selected Parcel ---
  useEffect(() => {
    if (!mapRef.current || !selectedParcel) return;
    const bounds = L.latLngBounds(selectedParcel.polygon.map(pt => svgToLatLng(pt)));
    mapRef.current.flyToBounds(bounds, {
      padding: [40, 40],
      duration: 1.5,
      easeLinearity: 0.25
    });
  }, [selectedParcel]);

  // Handle manual UPI Search in cockpit
  const handleCockpitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUpi) return;
    
    const matched = parcels.find(p => 
      p.upi.toLowerCase().includes(searchUpi.toLowerCase()) || 
      p.ownerName.toLowerCase().includes(searchUpi.toLowerCase())
    );

    if (matched) {
      onSelectParcel(matched);
      setSearchUpi("");
    }
  };

  const formatFlightTime = (sec: number) => {
    const hours = Math.floor(sec / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const seconds = (sec % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  // Safe manual buttons handlers
  const handlePauseMission = () => {
    setIsFlying(false);
    setFlightStatus("PAUSED_HOVERING");
  };

  const handleResumeMission = () => {
    setIsFlying(true);
    setFlightStatus("MAPPING_SECTOR_4");
  };

  const handleReturnHome = () => {
    setIsFlying(true);
    setFlightStatus("RETURNING_HOME");
  };

  const handleLandNow = () => {
    setIsFlying(false);
    setFlightStatus("LANDED");
    setTelemetry(prev => ({
      ...prev,
      altitude: 0,
      speed: 0
    }));
  };

  // Download complete Orthophoto imagery GeoTIFF report
  const handleDownloadGeoTiff = () => {
    if (!selectedParcel) return;
    
    // Create printable report mock download
    const boundaryCoords = selectedParcel.polygon.map((point, idx) => {
      const latLng = svgToLatLng(point);
      return `Vertex #${idx+1} [X: ${point[0]}, Y: ${point[1]}] -> GPS: ${latLng[0].toFixed(6)}, ${latLng[1].toFixed(6)}`;
    }).join("\n");

    const reportText = `
========================================================================
    MINISTRY OF ENVIRONMENT - RWANDA LAND USE AUTHORITY (RLMUA)
            SURVEY & BOUNDARY PHOTOGRAMMETRY DISCREPANCY AUDIT
========================================================================
UPI IDENTIFIER: ${selectedParcel.upi}
REGISTRATION OWNER: ${selectedParcel.ownerName}
DISTRICT: ${selectedParcel.district} | SECTOR: ${selectedParcel.sector}
========================================================================
SATELLITE & PHOTOGRAMMETRIC LOG:
- Drone ID: DRN-001 (Gasabo Base 1 Uplink)
- Ground Sampling Distance (GSD): 2.44 cm/px
- RTK / CORS Correction Station: GSA1 CORS-RTK Fixed
- Recorded Elevation: 1,482m ASL

SURVEY AREA AUDIT DISCREPANCY:
- Registered Legal Area: ${selectedParcel.area.toLocaleString()} sqm
- Drone Measured Area: ${(selectedParcel.area * 1.008).toFixed(0)} sqm
- Net Discrepancy Area: +${(selectedParcel.area * 0.008).toFixed(0)} sqm
- Percentage Variance Limit: +0.80% (Threshold Variance Check Passed)

COORDINATE VERTEX LEDGER:
${boundaryCoords}

DISPUTE CRITERIA ANALYSIS & BOUNDARY SHIFT STATUS:
[WARNING] Potential eastern boundary fence mismatch detected (Shift: 2.45m eastwards).
Status: SUBMITTED TO THE DISTRICT LAND DISPUTE ARBITRATION REGISTRY (RW-DIS-2026).
    `;

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Drone_Survey_Report_UPI_${selectedParcel.upi.replace(/\//g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#080f1e] text-slate-100 rounded-xl overflow-hidden border border-[#162744] shadow-2xl relative">
      
      {/* 1. TOP BAR (HEADER) */}
      <div className="px-5 py-3.5 bg-[#09152b] border-b border-[#162744] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="w-3 h-3 bg-emerald-500 rounded-full relative"></span>
          </div>
          <div>
            <h1 className="font-sans font-black tracking-wider text-sm text-slate-50 flex items-center gap-2">
              🛸 RW LAND MAPPING SYSTEM
            </h1>
            <span className="text-[9px] font-mono font-bold text-blue-400 block uppercase tracking-widest">
              Live GIS Drone Survey & Photogrammetry Center
            </span>
          </div>
        </div>

        {/* UPI Search bar */}
        <form onSubmit={handleCockpitSearch} className="flex-1 max-w-sm flex bg-[#0d1e3a] border border-[#1d355c] rounded overflow-hidden">
          <div className="pl-3 flex items-center text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search UPI (e.g., 1/02/11/04/1841) or Owner Name..."
            value={searchUpi}
            onChange={(e) => setSearchUpi(e.target.value)}
            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none"
          />
          <button type="submit" className="px-3 bg-blue-600 text-white hover:bg-blue-500 transition cursor-pointer text-xs font-bold">
            Audit
          </button>
        </form>

        {/* Mission Status Badge */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="px-2.5 py-1 bg-[#102447] border border-[#20407a] rounded text-slate-200">
            <span className="text-[8px] text-slate-400 block uppercase tracking-wider font-sans">Mission Identifier</span>
            <strong className="text-blue-400 font-extrabold uppercase">MSN-2026-DRN01</strong>
          </div>
          <div className="px-2.5 py-1 bg-[#102447] border border-[#20407a] rounded text-slate-200">
            <span className="text-[8px] text-slate-400 block uppercase tracking-wider font-sans">User Access Node</span>
            <strong className="text-emerald-400">RCA Surveyor Commander</strong>
          </div>
        </div>
      </div>

      {/* THREE PANELS LAYOUT COCKPIT */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 min-h-0 overflow-y-auto">
        
        {/* LEFT SIDEBAR: Telemetry, Flight controls, Workflows, Tech Stack */}
        <div className="xl:col-span-3 border-r border-[#162744] bg-[#071124] p-4 flex flex-col gap-4 min-w-0 overflow-y-auto">
          
          {/* A. Drone Telemetry Panel */}
          <div className="space-y-3 p-3.5 bg-[#09172f]/80 border border-[#1b325c] rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-sans text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Cpu className="w-4 h-4 text-blue-400 animate-pulse" />
                Drone Telemetry Telematics
              </h3>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-black ${
                flightStatus === "MAPPING_SECTOR_4" ? "bg-emerald-950 border border-emerald-500 text-emerald-400" :
                flightStatus === "PAUSED_HOVERING" ? "bg-amber-950 border border-amber-500 text-amber-400" :
                "bg-rose-950 border border-rose-500 text-rose-400"
              }`}>
                {flightStatus.replace("_", " ")}
              </span>
            </div>

            {/* Battery Indicator */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-400 flex items-center gap-1"><Battery className="w-3.5 h-3.5 text-emerald-500" /> UPLINK POWER</span>
                <span className={`font-bold ${telemetry.battery < 20 ? "text-rose-400 animate-pulse" : "text-emerald-400"}`}>
                  {telemetry.battery}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#10223d] rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    telemetry.battery < 20 ? "bg-rose-500" : telemetry.battery < 50 ? "bg-amber-500" : "bg-emerald-500"
                  }`} 
                  style={{ width: `${telemetry.battery}%` }}
                ></div>
              </div>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                <span className="text-slate-500 text-[8px] uppercase font-bold block">ALTITUDE</span>
                <strong className="text-slate-200 font-mono text-[11.5px] block mt-0.5">{telemetry.altitude} m</strong>
              </div>
              <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                <span className="text-slate-500 text-[8px] uppercase font-bold block">GROUND SPEED</span>
                <strong className="text-slate-200 font-mono text-[11.5px] block mt-0.5">{telemetry.speed} m/s</strong>
              </div>
              <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                <span className="text-slate-500 text-[8px] uppercase font-bold block">HEADING / YAW</span>
                <strong className="text-slate-200 font-mono text-[11.5px] block mt-0.5">{telemetry.heading}° NE</strong>
              </div>
              <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                <span className="text-slate-500 text-[8px] uppercase font-bold block">FLIGHT CLOCK</span>
                <strong className="text-blue-400 font-mono text-[11px] block mt-0.5">{formatFlightTime(telemetry.flightTimeSeconds)}</strong>
              </div>
              <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                <span className="text-slate-500 text-[8px] uppercase font-bold block">SATELLITE TRACER</span>
                <strong className="text-slate-200 font-mono text-[11px] block mt-0.5">{telemetry.satellites} Locked</strong>
              </div>
              <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                <span className="text-slate-500 text-[8px] uppercase font-bold block">SIGNAL RX LIMIT</span>
                <strong className="text-emerald-400 font-mono text-[11px] block mt-0.5">{telemetry.signalStrength} dBm</strong>
              </div>
            </div>

            {/* GPS coordinates display */}
            <div className="p-2 bg-[#091f3e] border border-[#1c3866] rounded font-mono text-[9px] flex justify-between text-slate-300">
              <span>LAT: {telemetry.gps[0].toFixed(5)}° S</span>
              <span>LON: {telemetry.gps[1].toFixed(5)}° E</span>
            </div>
          </div>

          {/* B. Flight Command controls */}
          <div className="space-y-2 p-3 bg-[#0a1427] border border-[#1a2d4f] rounded-lg">
            <span className="text-slate-500 text-[8px] font-sans font-bold uppercase tracking-wider block mb-1">
              Manual Mission Uplink Overrides
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              {isFlying ? (
                <button
                  onClick={handlePauseMission}
                  className="py-2 px-1 bg-amber-600/20 hover:bg-amber-600/35 border border-amber-600 text-amber-300 rounded font-black flex flex-col items-center gap-1 transition cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  PAUSE
                </button>
              ) : (
                <button
                  onClick={handleResumeMission}
                  className="py-2 px-1 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-600 text-emerald-300 rounded font-black flex flex-col items-center gap-1 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  RESUME
                </button>
              )}
              <button
                onClick={handleReturnHome}
                disabled={flightStatus === "RETURNING_HOME" || flightStatus === "LANDED"}
                className="py-2 px-1 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-600 disabled:opacity-40 text-blue-300 rounded font-black flex flex-col items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                HOME
              </button>
              <button
                onClick={handleLandNow}
                disabled={flightStatus === "LANDED"}
                className="py-2 px-1 bg-rose-600/20 hover:bg-rose-600/35 border border-rose-600 disabled:opacity-40 text-rose-300 rounded font-black flex flex-col items-center gap-1 transition cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 rotate-180 text-rose-400" />
                LAND
              </button>
            </div>
          </div>

          {/* C. Step-by-Step Drone Survey Workflow */}
          <div className="p-3.5 bg-[#09152b] border border-[#162744] rounded-lg space-y-3">
            <h4 className="text-[10px] font-sans font-extrabold uppercase tracking-widest text-slate-400 border-b border-[#1c325c] pb-1">
              Drone Photogrammetry Workflow
            </h4>
            
            <div className="space-y-3 font-sans text-xs">
              <div className="flex gap-2 items-start">
                <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">✓</span>
                <div>
                  <span className="font-bold text-slate-300 block">Pre-flight Diagnostics</span>
                  <p className="text-[10px] text-slate-500">Autonomous systems & battery constraints verified.</p>
                </div>
              </div>

              <div className="flex gap-2 items-start">
                <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">✓</span>
                <div>
                  <span className="font-bold text-slate-300 block">GSD Calibration</span>
                  <p className="text-[10px] text-slate-500">Multispectral ground-sampling set to 2.4cm/px.</p>
                </div>
              </div>

              <div className="flex gap-2 items-start">
                <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">✓</span>
                <div>
                  <span className="font-bold text-slate-300 block">Flight Path Mapping</span>
                  <p className="text-[10px] text-slate-500">Overlapping flight vectors uploaded to CORS receiver.</p>
                </div>
              </div>

              <div className="flex gap-2 items-start">
                <span className="w-4 h-4 rounded-full bg-blue-950 border border-blue-500 text-blue-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5 animate-pulse">4</span>
                <div className="flex-1">
                  <span className="font-bold text-blue-400 block">Photogrammetry Stream</span>
                  <p className="text-[10px] text-slate-400">Capturing overlapping raster scans...</p>
                  <div className="w-full bg-[#10223d] h-1 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: "68%" }}></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 items-start opacity-40">
                <span className="w-4 h-4 rounded-full bg-[#122036] border border-[#253e63] text-slate-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">5</span>
                <div>
                  <span className="font-bold text-slate-400 block">Orthomosaic Stitching</span>
                  <p className="text-[10px] text-slate-500">Cloud ledger compilation & boundary shift check.</p>
                </div>
              </div>
            </div>
          </div>

          {/* D. Technology Stack Overview */}
          <div className="p-3 bg-[#080e1a] border border-[#14233c] rounded-lg">
            <span className="text-[8.5px] font-sans font-bold text-slate-500 uppercase block tracking-wider mb-2">GIS COCKPIT CORE TECHNOLOGY</span>
            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-400">
              <div className="p-1.5 bg-[#0e172a] rounded flex items-center gap-1.5">
                <span className="text-blue-400">●</span> React.js & Leaflet
              </div>
              <div className="p-1.5 bg-[#0e172a] rounded flex items-center gap-1.5">
                <span className="text-emerald-400">●</span> Node.js & Socket.IO
              </div>
              <div className="p-1.5 bg-[#0e172a] rounded flex items-center gap-1.5">
                <span className="text-red-400">●</span> PostGIS Datastore
              </div>
              <div className="p-1.5 bg-[#0e172a] rounded flex items-center gap-1.5">
                <span className="text-amber-400">●</span> WebRTC Downlink
              </div>
            </div>
          </div>
        </div>

        {/* CENTER SECTION: Interactive GIS Map & 3D Perspective Controls */}
        <div className="xl:col-span-6 flex flex-col bg-[#070e1b] min-h-[400px] border-r border-[#162744] p-4 gap-4 relative">
          
          {/* Main Map Canvas Panel */}
          <div className="flex-1 relative rounded-lg border border-[#1b325c] overflow-hidden bg-slate-950">
            
            {/* Map Container styled with optional 3D perspective tilt transforms */}
            <div 
              style={{
                transform: is3DMode 
                  ? `perspective(800px) rotateX(${pitch}deg) rotateY(0deg) rotateZ(${-bearing}deg) scale(1.04)`
                  : "none",
                transformOrigin: "center 85%",
                transition: "transform 1.2s cubic-bezier(0.1, 0.8, 0.2, 1)"
              }}
              className="w-full h-full"
            >
              <div ref={mapContainerRef} className="w-full h-full"></div>
            </div>

            {/* 3D MAP CONTROL HOVER GIMBAL CAMERA DRIVER */}
            {is3DMode && (
              <div className="absolute bottom-5 left-5 z-[1000] bg-slate-900/90 border border-slate-700/80 p-3 rounded-lg flex flex-col gap-2.5 shadow-2xl backdrop-blur-md max-w-[130px]">
                <div className="flex items-center gap-1 text-[9.5px] font-sans font-extrabold text-blue-400 tracking-wider uppercase border-b border-slate-700 pb-1">
                  <Compass className="w-3.5 h-3.5 animate-spin-slow" /> Camera Gimbal
                </div>
                
                {/* Pitch Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[8.5px] text-slate-300 font-bold">
                    <span>TILT / PITCH</span>
                    <span>{pitch}°</span>
                  </div>
                  <input 
                    type="range" 
                    min={15} 
                    max={65} 
                    value={pitch} 
                    onChange={e => setPitch(Number(e.target.value))} 
                    className="w-full h-1 accent-blue-500 rounded bg-slate-700 appearance-none cursor-pointer"
                  />
                </div>

                {/* Bearing Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[8.5px] text-slate-300 font-bold">
                    <span>YAW / BEARING</span>
                    <span>{bearing}°</span>
                  </div>
                  <input 
                    type="range" 
                    min={-45} 
                    max={45} 
                    value={bearing} 
                    onChange={e => setBearing(Number(e.target.value))} 
                    className="w-full h-1 accent-blue-500 rounded bg-slate-700 appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* FLOATING LAYER SWITCHER & CONFIGURATOR (TOP-RIGHT) */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2.5">
              
              {/* GIS Overlay Controls */}
              <div className="bg-slate-900/95 border border-slate-700/90 rounded-lg p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 font-sans text-[10px]">
                <div className="font-extrabold text-slate-300 tracking-wider border-b border-slate-800 pb-1 flex items-center gap-1.5 uppercase">
                  <Layers className="w-3.5 h-3.5 text-blue-400" /> Layer Matrix
                </div>
                
                {/* Tile Selector */}
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                  {(["Satellite", "Terrain", "Street"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setMapMode(mode)}
                      className={`py-1 px-1 rounded text-[8.5px] font-black transition cursor-pointer ${
                        mapMode === mode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Layer Toggles */}
                <div className="space-y-1.5 pt-1 text-slate-300 font-bold">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-slate-100">
                    <input 
                      type="checkbox" 
                      checked={is3DMode} 
                      onChange={e => setIs3DMode(e.target.checked)} 
                      className="accent-blue-500 bg-slate-800 rounded border-slate-700" 
                    />
                    <span>3D Terrain Perspective</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-slate-100">
                    <input 
                      type="checkbox" 
                      checked={showOrthophoto} 
                      onChange={e => setShowOrthophoto(e.target.checked)} 
                      className="accent-blue-500 bg-slate-800 rounded border-slate-700" 
                    />
                    <span>Orthophoto Overlay</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-slate-100">
                    <input 
                      type="checkbox" 
                      checked={showHeatmap} 
                      onChange={e => setShowHeatmap(e.target.checked)} 
                      className="accent-blue-500 bg-slate-800 rounded border-slate-700" 
                    />
                    <span>Elevation Heatmap</span>
                  </label>
                </div>
              </div>
            </div>

            {/* FLOATING ZOOM CONTROLS (TOP-LEFT) */}
            <div className="absolute top-4 left-4 z-[1000] bg-slate-900/90 border border-slate-700/85 p-1 rounded-lg flex flex-col gap-1 shadow-2xl backdrop-blur-md">
              <button 
                onClick={() => mapRef.current?.zoomIn()} 
                className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-700"
                title="Zoom In"
              >
                +
              </button>
              <button 
                onClick={() => mapRef.current?.zoomOut()} 
                className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-700"
                title="Zoom Out"
              >
                −
              </button>
            </div>

            {/* SCALE & COORDINATES (BOTTOM-RIGHT) */}
            <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-[9px] font-mono text-slate-300 flex items-center gap-3 shadow-lg">
              <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span>PDOP Ratio: 1.08</span>
              </div>
              <div className="border-r border-slate-700 pr-3">
                <span>Scale: 1 : 2,500</span>
              </div>
              <div>
                <span>CORS System: KGL_WGS84</span>
              </div>
            </div>

            {/* MINI MAP PREVIEW BLOCK IN BOTTOM-RIGHT INNER */}
            <div className="absolute bottom-16 right-4 z-[1000] w-28 h-20 bg-slate-900/95 border border-slate-700 rounded shadow-2xl overflow-hidden pointer-events-none hidden md:block">
              <div className="w-full h-full relative opacity-60 flex items-center justify-center bg-[#070e1b]">
                {/* SVG radar loop simulator representing Rwanda regional map */}
                <svg viewBox="0 0 100 80" className="w-full h-full stroke-slate-500 opacity-30" strokeWidth="0.5" fill="none">
                  <circle cx="50" cy="40" r="30"></circle>
                  <circle cx="50" cy="40" r="15"></circle>
                  <path d="M50 10v60M20 40h60"></path>
                  <rect x="35" y="30" width="30" height="20" rx="2" fill="none" stroke="#22c55e" strokeWidth="1" className="animate-pulse"></rect>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/40 to-transparent"></div>
                <span className="absolute bottom-1 left-1.5 text-[7px] font-mono font-bold uppercase text-slate-400">Mini-Map Index</span>
              </div>
            </div>

          </div>
          
          {/* Quick Adjudication Note in cockpit */}
          <div className="bg-[#09152b] p-3 rounded-lg border border-[#1b325c] flex items-start gap-2.5 text-xs text-slate-300 shadow-sm shrink-0">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-sans font-medium text-slate-300">
                <strong className="text-blue-400">Low-Altitude Photogrammetry Mode:</strong> The drone traverses Gasabo Sector at 120m AGL. Click any red-outlined parcel boundary to audit legal records and compare official coordinate vectors directly against the real-time orthomosaics.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Parcel Info, UPI (in red), deviation, verification mismatch alert */}
        <div className="xl:col-span-3 border-l border-[#162744] bg-[#071124] p-4 flex flex-col gap-4 overflow-y-auto">
          
          {/* Parcel Information Panel */}
          <div className="p-4 bg-[#09152b] border border-[#162744] rounded-lg space-y-4">
            <div className="border-b border-[#1b325c] pb-2 flex justify-between items-center">
              <span className="text-[9.5px] font-extrabold text-blue-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-400" />
                Cadastral Adjudication Ledger
              </span>
              <span className="px-1.5 py-0.2 bg-[#102447] text-slate-300 border border-slate-700 font-mono text-[8px] rounded uppercase font-bold">
                WGS84 Real
              </span>
            </div>

            {selectedParcel ? (
              <div className="space-y-4 font-sans text-xs">
                
                {/* UPI highlighted in Red */}
                <div>
                  <span className="text-slate-400 text-[8.5px] uppercase font-bold block">Unique Parcel Identifier</span>
                  <span className="text-rose-500 font-black text-sm tracking-tight block border border-rose-500/20 bg-rose-500/10 px-2 py-1.5 rounded mt-1 font-mono">
                    RW-UPI-{selectedParcel.upi}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                    <span className="text-slate-500 text-[8px] uppercase font-bold block">REGISTRY STATE</span>
                    <strong className="text-slate-200 block mt-0.5 text-[10.5px]">
                      {selectedParcel.status === ParcelStatus.DISPUTED || selectedParcel.upi === "1/02/11/04/1841" ? "DISPUTED" : "VERIFIED"}
                    </strong>
                  </div>
                  <div className="p-2 bg-[#091b36] border border-[#173059] rounded">
                    <span className="text-slate-500 text-[8px] uppercase font-bold block">OWNER CLASSIFICATION</span>
                    <strong className="text-blue-400 block mt-0.5 text-[10px] truncate uppercase">
                      {selectedParcel.ownerType}
                    </strong>
                  </div>
                </div>

                {/* Area comparison with Deviation */}
                <div className="space-y-2 p-2.5 bg-[#091d3d] border border-[#1b3866] rounded">
                  <span className="text-slate-400 text-[8.5px] uppercase font-bold block">Planimetric Area Verification</span>
                  
                  <div className="flex justify-between items-center text-[11px] pt-1 border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Official Legal Deed:</span>
                    <span className="font-mono text-slate-200 font-bold">{selectedParcel.area.toLocaleString()} m²</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] pt-1 border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Drone Measured:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.round(selectedParcel.area * 1.008).toLocaleString()} m²
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <span className="text-slate-400">Area Deviation %:</span>
                    <span className="font-mono text-amber-400 font-extrabold bg-[#152e55] px-1.5 py-0.2 rounded">
                      +0.80% (Acc.)
                    </span>
                  </div>
                </div>

                {/* Geographic Locators */}
                <div className="space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Provincial Node:</span>
                    <span>Kigali City</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">District Center:</span>
                    <span>{selectedParcel.district}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sector Buffer:</span>
                    <span>{selectedParcel.sector}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cell/Village Unit:</span>
                    <span className="truncate">{selectedParcel.cell} / {selectedParcel.village}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Proprietor:</span>
                    <span className="font-semibold text-slate-200">{selectedParcel.ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Elevation ASL:</span>
                    <span className="font-mono text-emerald-400">1,482 m</span>
                  </div>
                </div>

                {/* VERIFICATION DISCREPANCY DETECTED ALERTS */}
                {(selectedParcel.status === ParcelStatus.DISPUTED || selectedParcel.upi === "1/02/11/04/1841") ? (
                  <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-xs space-y-1.5 animate-pulse shadow-md">
                    <div className="flex items-center gap-1.5 text-red-400 font-black tracking-wide uppercase text-[10.5px]">
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      Boundary Mismatch Detected!
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[10px]">
                      Drone LIDAR measurements indicate Eastern boundary fence shifted by <span className="text-red-400 font-black">2.45 meters</span> outward from the 2018 legal deed coordinate bounds. Encroachment risk: <span className="text-red-400 font-bold">HIGH</span>.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[10px]">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      Cadastral Checks Cleared
                    </div>
                    <p className="text-slate-400 text-[10px]">
                      No significant vector deviation found. Registered boundary aligns perfectly within acceptable ground tolerance threshold.
                    </p>
                  </div>
                )}

                {/* Actions Report Button */}
                <button
                  type="button"
                  onClick={handleDownloadGeoTiff}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  View Full GIS Audit Report
                </button>

              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 font-sans text-xs">
                <Info className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                Please select a parcel polygon on the map to begin photogrammetry verify audit.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* BOTTOM SECTION: Live video stream & captured thumbnails */}
      <div className="px-5 py-4 bg-[#09152b] border-t border-[#162744] grid grid-cols-1 lg:grid-cols-12 gap-5 shrink-0">
        
        {/* A. Live Drone Video Stream */}
        <div className="lg:col-span-7 flex flex-col bg-[#070e1b] border border-[#1b325c] rounded-lg p-3 min-w-0">
          <div className="flex items-center justify-between border-b border-[#1c325c] pb-2 mb-2">
            <span className="text-[10px] font-sans font-extrabold uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-blue-400" />
              Live low-latency camera downlink | 1080p 60fps
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setThermalFilter(!thermalFilter)}
                className={`px-2 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase border cursor-pointer transition ${
                  thermalFilter 
                    ? "bg-rose-500 text-white border-rose-400" 
                    : "bg-[#102447] text-slate-300 border-slate-700 hover:text-white"
                }`}
              >
                {thermalFilter ? "INFRARED ACTIVE" : "RGB COLOR"}
              </button>
              <span className="px-1.5 py-0.2 bg-red-950 border border-red-500 text-red-400 font-mono text-[7px] rounded font-bold uppercase tracking-widest animate-pulse">
                Live Video
              </span>
            </div>
          </div>

          {/* SIMULATED FLIGHT VIDEO FEED CONTAINER */}
          <div className="aspect-[21/9] w-full bg-slate-950 rounded-lg relative overflow-hidden flex items-center justify-center border border-[#1c325c]/50">
            {/* Real drone video image with styled HUD overlay */}
            <img 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80" 
              alt="Drone live photogrammetry"
              style={{
                filter: thermalFilter 
                  ? "contrast(1.8) brightness(1.2) hue-rotate(240deg) saturate(2)" 
                  : "none",
                transform: isFlying ? "scale(1.03) translate(1px, 1px)" : "none",
                transition: "filter 0.5s ease"
              }}
              className="absolute inset-0 w-full h-full object-cover opacity-55 select-none"
              referrerPolicy="no-referrer"
            />

            {/* Thermal pseudo shader overlay */}
            {thermalFilter && (
              <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 via-amber-500/5 to-purple-800/10 mix-blend-color-burn pointer-events-none"></div>
            )}

            {/* Grid scanner animation line */}
            <div className="absolute inset-x-0 h-0.5 bg-blue-400/40 shadow-[0_0_8px_rgba(59,130,246,0.8)] top-0 animate-grid-scan pointer-events-none"></div>

            {/* HIGH TECH HUD INSTRUMENT OVERLAYS */}
            <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none font-mono text-[9px] text-emerald-400 select-none">
              
              {/* Top HUD elements */}
              <div className="flex justify-between items-start">
                <div className="space-y-0.5 bg-slate-950/80 p-1 rounded border border-[#1b325c]">
                  <div>REC [●] 1080P_60FPS</div>
                  <div>RTK_LOCK: FIXED_CORRECTED</div>
                </div>
                <div className="text-center bg-slate-950/80 p-1 rounded border border-[#1b325c]">
                  <div>GIMBAL TILT: -45.0°</div>
                  <div>GSD_ACC: 2.44 cm/px</div>
                </div>
                <div className="text-right space-y-0.5 bg-slate-950/80 p-1 rounded border border-[#1b325c]">
                  <div>GPS: {telemetry.gps[0].toFixed(5)}° S</div>
                  <div>{telemetry.gps[1].toFixed(5)}° E</div>
                </div>
              </div>

              {/* Center HUD reticle crosshair */}
              <div className="absolute inset-0 flex items-center justify-center opacity-75">
                <svg viewBox="0 0 100 100" className="w-16 h-16 stroke-emerald-400" strokeWidth="1" fill="none">
                  <circle cx="50" cy="50" r="30" strokeDasharray="3, 3" className="animate-spin-slow"></circle>
                  <circle cx="50" cy="50" r="10"></circle>
                  <path d="M50 20v15M50 65v15M20 50h15M65 50h15"></path>
                </svg>
              </div>

              {/* Bottom HUD elements */}
              <div className="flex justify-between items-end">
                <div className="space-y-0.5 bg-slate-950/80 p-1 rounded border border-[#1b325c]">
                  <div>ALT: {telemetry.altitude}m</div>
                  <div>SPD: {telemetry.speed}m/s</div>
                </div>
                <div className="text-center text-[10px] bg-slate-950/80 px-2 py-0.5 rounded border border-[#1b325c] animate-pulse">
                  IS_VERIFYING_UPI: {selectedParcel ? selectedParcel.upi : "AWAITING_SELECTION"}
                </div>
                <div className="text-right space-y-0.5 bg-slate-950/80 p-1 rounded border border-[#1b325c]">
                  <div>COMPASS: {telemetry.heading}° NE</div>
                  <div>BATT_EST: {(telemetry.battery / 5.2).toFixed(1)} Wh</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* B. Recent Captured Images thumbnails */}
        <div className="lg:col-span-5 flex flex-col bg-[#070e1b] border border-[#1b325c] rounded-lg p-3 min-w-0">
          <div className="flex items-center justify-between border-b border-[#1c325c] pb-2 mb-2">
            <span className="text-[10px] font-sans font-extrabold uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              Photogrammetric Scans Stack (4 Captured)
            </span>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">
              GSD Corrected
            </span>
          </div>

          {/* Captured Images Grid */}
          <div className="grid grid-cols-4 gap-2.5 flex-1 items-center">
            {capturedImages.map((img) => (
              <div 
                key={img.id} 
                onClick={() => setExpandedImage(img.url)}
                className="group relative aspect-video bg-slate-950 rounded border border-[#1d355c] hover:border-blue-400 transition cursor-pointer overflow-hidden shadow-md"
              >
                <img 
                  src={img.url} 
                  alt={img.title} 
                  className="object-cover w-full h-full opacity-60 group-hover:opacity-100 transition duration-300" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-white drop-shadow" />
                </div>
                <div className="absolute bottom-1 left-1.5 right-1.5 flex justify-between items-center text-[7.5px] font-mono text-slate-300 bg-slate-900/90 py-0.5 px-1 rounded border border-[#1d355c]">
                  <span className="truncate">{img.title}</span>
                  <span className="text-emerald-400 shrink-0 ml-1">{img.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Image Expansion Lightbox */}
      {expandedImage && (
        <div 
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 z-[9999] bg-slate-950/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-lg border border-[#1b325c] overflow-hidden shadow-2xl">
            <img src={expandedImage} alt="Expanded map scan" className="max-w-full max-h-[85vh] object-contain" referrerPolicy="no-referrer" />
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-[#1b325c] p-2.5 rounded font-sans text-xs text-slate-100 max-w-sm">
              <h5 className="font-bold">Photogrammetric Orthomosaic Tile</h5>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Captured: 2.4cm/px Ground Sampling | Real RTK CORS Correction Fixed.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

export default DroneMissionControl;

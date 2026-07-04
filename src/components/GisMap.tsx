/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Kigali GIS Workspace - Leaflet-based Google Maps-style Land System
 */

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LandParcel, IoTSensorFeed, ParcelStatus, LandUse } from "../types";
import { svgToLatLng, latLngToSvg } from "../utils/geo";
import { 
  Compass, Layers, Info, Ruler, Map as MapIcon, Satellite, 
  Landmark, ShieldAlert, FlameKindling, Activity, Grid, 
  Search, Navigation, Wrench, Check
} from "lucide-react";

// Ray-casting point-in-polygon algorithm for backwards compatibility
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Line segment intersection checker
export function doSegmentsIntersect(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number]
): boolean {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) => {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

// Check if two polygons intersect
export function doPolygonsIntersect(poly1: [number, number][], poly2: [number, number][]): boolean {
  for (let i = 0; i < poly1.length; i++) {
    const p1_start = poly1[i];
    const p1_end = poly1[(i + 1) % poly1.length];
    
    for (let j = 0; j < poly2.length; j++) {
      const p2_start = poly2[j];
      const p2_end = poly2[(j + 1) % poly2.length];
      
      if (doSegmentsIntersect(p1_start, p1_end, p2_start, p2_end)) {
        return true;
      }
    }
  }
  if (isPointInPolygon(poly1[0], poly2)) return true;
  if (isPointInPolygon(poly2[0], poly1)) return true;
  return false;
}

// Calculate Polygon Area using Shoelace Formula
export function calculatePolygonArea(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  const mathArea = Math.abs(area) / 2;
  const scaledArea = Math.round(mathArea * 18.5); // matches database sqm
  return scaledArea;
}

// Calculate Euclidean Distance between two coordinates
export function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 4.3); // simulated meters
}

interface GisMapProps {
  parcels: LandParcel[];
  onSelectParcel: (parcel: LandParcel | null) => void;
  selectedParcel: LandParcel | null;
  activeSurveyParcelId?: string;
  activeGeofenceRadius?: number; // meters
  iotSensors: IoTSensorFeed[];
  onDrawComplete?: (newPolygon: [number, number][], area: number) => void;
  isDrawingMode: boolean;
  setIsDrawingMode: (val: boolean) => void;
  onCursorMove?: (coords: { x: number; y: number; lat: number; lon: number }) => void;
  cursors?: Record<string, any>;
  surveyorGps?: Record<string, any>;
  presence?: any[];
}

const GisMap = memo(function GisMap({
  parcels,
  onSelectParcel,
  selectedParcel,
  activeSurveyParcelId,
  activeGeofenceRadius = 250,
  iotSensors,
  onDrawComplete,
  isDrawingMode,
  setIsDrawingMode,
  onCursorMove,
  cursors = {},
  surveyorGps = {},
  presence = [],
}: GisMapProps) {
  // Map customization state
  const [mapMode, setMapMode] = useState<"street" | "satellite" | "contour" | "cadastral" | "survey">("cadastral");
  const [showWetlands, setShowWetlands] = useState(true);
  const [showRoadReserve, setShowRoadReserve] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LandParcel[]>([]);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gisContainerRef = useRef<HTMLDivElement | null>(null);

  const toggleFullscreen = useCallback(async () => {
    if (!gisContainerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await gisContainerRef.current.requestFullscreen();
      } catch {}
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // 3D Perspective controls (3D Terrain simulation)
  const [is3DMode, setIs3DMode] = useState(false);
  const [pitch, setPitch] = useState(30); // tilt angle (0 to 65)
  const [bearing, setBearing] = useState(-10); // rotation angle (-180 to 180)
  const [elevationExaggeration, setElevationExaggeration] = useState(1.5); // simulated height scale

  // Floating layer panel control state
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

  // Dynamic coordinates under cursor
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number; utmE: number; utmN: number; lat: number; lon: number }>({
    x: 0, y: 0, utmE: 304212, utmN: 9784210, lat: -1.94215, lon: 30.09121
  });

  // Active Ruler drawing / measuring
  const [rulerPoints, setRulerPoints] = useState<[number, number][]>([]);
  const [isRulerActive, setIsRulerActive] = useState(false);

  // Active Drawing parcel state
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [drawArea, setDrawArea] = useState<number>(0);
  const [overlapWarning, setOverlapWarning] = useState<{ isOverlapping: boolean; overlappedOwner?: string; overlappedUpi?: string }>({
    isOverlapping: false
  });

  // Boundary Vertex-editing local state
  const [isEditingVertices, setIsEditingVertices] = useState(false);
  const [localEditPoints, setLocalEditPoints] = useState<[number, number][]>([]);

  // Leaflet references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layers groups to update dynamic features
  const parcelsLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const drawingLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const telemetryLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const environmentalLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const vertexMarkersLayerGroupRef = useRef<L.FeatureGroup | null>(null);

  // Drone simulation position
  const dronePosRef = useRef({ x: 450, y: 150 });
  const droneTargetIndexRef = useRef(0);
  const dronePath = [[450, 150], [580, 150], [580, 260], [450, 260]];
  const [dronePos, setDronePos] = useState<{ x: number; y: number }>(dronePosRef.current);

  // 1. Drone position update timer (ref-based to avoid re-creating interval)
  useEffect(() => {
    const timer = setInterval(() => {
      const target = dronePath[droneTargetIndexRef.current];
      const current = dronePosRef.current;
      const dx = target[0] - current.x;
      const dy = target[1] - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 4) {
        droneTargetIndexRef.current = (droneTargetIndexRef.current + 1) % dronePath.length;
      } else {
        dronePosRef.current = {
          x: current.x + (dx / dist) * 2,
          y: current.y + (dy / dist) * 2
        };
        setDronePos({ ...dronePosRef.current });
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // 2. Map mounting and initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map instance centered at Kimihurura coordinates
    const map = L.map(mapContainerRef.current, {
      center: [-1.95420, 30.08940],
      zoom: 16,
      zoomControl: false,
      doubleClickZoom: false,
    });

    mapInstanceRef.current = map;

    // Create feature groups
    parcelsLayerGroupRef.current = L.featureGroup().addTo(map);
    drawingLayerGroupRef.current = L.featureGroup().addTo(map);
    telemetryLayerGroupRef.current = L.featureGroup().addTo(map);
    environmentalLayerGroupRef.current = L.featureGroup().addTo(map);
    vertexMarkersLayerGroupRef.current = L.featureGroup().addTo(map);

    // Track mouse coordinates on map hover
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      const svgPt = latLngToSvg([lat, lon]);
      const x = svgPt[0];
      const y = svgPt[1];

      const utmE = Math.round(300000 + (x * 12.5));
      const utmN = Math.round(9784000 - (y * 12.5));

      setMouseCoord({ x, y, utmE, utmN, lat, lon });

      // Trigger cursor collaboration callbacks if provided
      if (onCursorMove) {
        onCursorMove({ x, y, lat, lon });
      }
    });

    // Handle map click events (Drawing mode or Ruler mode or click outside)
    map.on("click", (e: L.LeafletMouseEvent) => {
      const latLng: [number, number] = [e.latlng.lat, e.latlng.lng];
      const svgPt = latLngToSvg(latLng);

      // Handle drawing mode click
      if (isDrawingMode) {
        setDrawPoints((prev) => {
          const updated = [...prev, svgPt];
          const area = calculatePolygonArea(updated);
          setDrawArea(area);

          // Check overlap
          let overlapFound = false;
          let owner = "";
          let upi = "";
          for (const p of parcels) {
            if (doPolygonsIntersect(updated, p.polygon)) {
              overlapFound = true;
              owner = p.ownerName;
              upi = p.upi;
              break;
            }
          }
          setOverlapWarning({
            isOverlapping: overlapFound,
            overlappedOwner: owner,
            overlappedUpi: upi
          });

          return updated;
        });
        return;
      }

      // Handle ruler mode click
      if (isRulerActive) {
        setRulerPoints((prev) => [...prev, svgPt]);
        return;
      }
    });

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isDrawingMode, isRulerActive]);

  // 3. Keep drawing status aligned with external props
  useEffect(() => {
    if (!isDrawingMode) {
      setDrawPoints([]);
      setDrawArea(0);
      setOverlapWarning({ isOverlapping: false });
    }
  }, [isDrawingMode]);

  // 4. Update tile layer when mapMode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    let tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    let attribution = "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

    if (mapMode === "satellite") {
      tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
    } else if (mapMode === "contour") {
      tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
      attribution = "Tiles &copy; OpenTopoMap &copy; OpenStreetMap contributors";
    } else if (mapMode === "cadastral" || mapMode === "survey") {
      tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      attribution = "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='https://carto.com/'>CARTO</a>";
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: mapMode === "contour" ? 17 : 20,
    }).addTo(mapInstanceRef.current);
  }, [mapMode]);

  // 5. Redraw parcels, geofences, and environmental layers on changes
  useEffect(() => {
    if (!mapInstanceRef.current || !parcelsLayerGroupRef.current || !environmentalLayerGroupRef.current) return;

    parcelsLayerGroupRef.current.clearLayers();
    environmentalLayerGroupRef.current.clearLayers();

    // -- A. Environmental Conservation Layer (Wetlands) --
    if (showWetlands) {
      const wetlandPts: [number, number][] = [[410, 480], [550, 470], [680, 420], [810, 480], [350, 480]];
      const wetlandLatLngs = wetlandPts.map(pt => svgToLatLng(pt));
      const wetlandPoly = L.polygon(wetlandLatLngs, {
        color: "#0891b2",
        weight: 1.5,
        dashArray: "4, 4",
        fillColor: "#06b6d4",
        fillOpacity: 0.12,
      });
      wetlandPoly.bindTooltip("Nyabugogo-Wetland Conservancy Zone", {
        permanent: true,
        direction: "center",
        className: "bg-cyan-900/90 text-[8.5px] text-cyan-100 px-1.5 py-0.5 rounded font-bold border-none shadow-sm"
      });
      environmentalLayerGroupRef.current.addLayer(wetlandPoly);
    }

    // -- B. Road Reserve Buffer Overlay --
    if (showRoadReserve) {
      const road1Pts: [number, number][] = [[0, 130], [800, 130]];
      const road2Pts: [number, number][] = [[430, 0], [430, 500]];
      
      const r1Line = L.polyline(road1Pts.map(pt => svgToLatLng(pt)), {
        color: "#d97706",
        weight: 14,
        opacity: 0.08
      });
      const r2Line = L.polyline(road2Pts.map(pt => svgToLatLng(pt)), {
        color: "#d97706",
        weight: 16,
        opacity: 0.08
      });
      environmentalLayerGroupRef.current.addLayer(r1Line);
      environmentalLayerGroupRef.current.addLayer(r2Line);
    }

    // -- C. Redraw Spatial UTM Grid if enabled --
    if (showGrid) {
      // Render simple coordinates lines
      for (let x = 50; x < 800; x += 100) {
        const line = L.polyline([svgToLatLng([x, 0]), svgToLatLng([x, 500])], {
          color: "#94a3b8",
          weight: 0.5,
          opacity: 0.4
        });
        environmentalLayerGroupRef.current.addLayer(line);
      }
      for (let y = 50; y < 500; y += 100) {
        const line = L.polyline([svgToLatLng([0, y]), svgToLatLng([800, y])], {
          color: "#94a3b8",
          weight: 0.5,
          opacity: 0.4
        });
        environmentalLayerGroupRef.current.addLayer(line);
      }
    }

    // -- D. Map Parcels with RED boundary outlines --
    parcels.forEach((parcel) => {
      const isSelected = selectedParcel?.id === parcel.id;
      const isSurveyTarget = activeSurveyParcelId === parcel.id;

      // Translate points
      const latLngs = parcel.polygon.map(pt => svgToLatLng(pt));

      const isCadastral = mapMode === "cadastral";
      const isSurvey = mapMode === "survey";

      let boundaryColor = "#FF0000";
      let boundaryWeight = 2;
      let fillCol = "#FF0000";
      let fillOp = 0.04;
      let dashArr: string | undefined;

      if (isCadastral) {
        // ----- Strong Cadastral Mode -----
        // Vibrant land-use fill colors
        switch (parcel.landUse) {
          case LandUse.PROTECTED:
            fillCol = "#0891b2";
            break;
          case LandUse.AGRICULTURAL:
            fillCol = "#65a30d";
            break;
          case LandUse.COMMERCIAL:
            fillCol = "#a855f7";
            break;
          case LandUse.FORESTRY:
            fillCol = "#059669";
            break;
          case LandUse.INDUSTRIAL:
            fillCol = "#ea580c";
            break;
          default:
            fillCol = "#e2e8f0";
        }
        fillOp = 0.15;
        boundaryWeight = 2;

        // Status-based border color & dash pattern
        switch (parcel.status) {
          case ParcelStatus.APPROVED:
            boundaryColor = "#16a34a";
            boundaryWeight = 2.5;
            dashArr = undefined;
            break;
          case ParcelStatus.DISPUTED:
            boundaryColor = "#dc2626";
            boundaryWeight = 3.5;
            dashArr = "8, 4";
            break;
          case ParcelStatus.UNDER_SURVEY:
            boundaryColor = "#d97706";
            boundaryWeight = 2.5;
            dashArr = "6, 3";
            break;
          case ParcelStatus.PENDING_MUTATION:
            boundaryColor = "#2563eb";
            boundaryWeight = 2.5;
            dashArr = "2, 4";
            break;
          default:
            boundaryColor = "#1e293b";
            boundaryWeight = 2;
            dashArr = undefined;
        }
      }

      if (isSurvey) {
        boundaryColor = "#0f172a";
        boundaryWeight = 3;
        fillCol = "#f8fafc";
        fillOp = 0.5;
        dashArr = undefined;
      }

      if (isSelected) {
        boundaryColor = "#10b981";
        boundaryWeight = 3.5;
        fillCol = "#10b981";
        fillOp = 0.22;
        dashArr = undefined;
      } else if (isSurveyTarget) {
        boundaryColor = "#f59e0b";
        boundaryWeight = 3;
        fillCol = "#f59e0b";
        fillOp = 0.15;
        dashArr = undefined;
      } else if (!isCadastral && !isSurvey) {
        switch (parcel.landUse) {
          case LandUse.PROTECTED:
            fillCol = "#06b6d4";
            break;
          case LandUse.AGRICULTURAL:
            fillCol = "#84cc16";
            break;
          case LandUse.COMMERCIAL:
            fillCol = "#c084fc";
            break;
          case LandUse.FORESTRY:
            fillCol = "#059669";
            break;
          case LandUse.INDUSTRIAL:
            fillCol = "#ea580c";
            break;
          default:
            fillCol = "#64748b";
        }
        dashArr = undefined;
      }

      const polygonLayer = L.polygon(latLngs, {
        color: boundaryColor,
        weight: boundaryWeight,
        fillColor: fillCol,
        fillOpacity: fillOp,
        dashArray: dashArr,
      });

      // Cadastral hover: darken fill on mouseover
      if (isCadastral && !isSelected) {
        const origFill = fillCol;
        const origOp = fillOp;
        polygonLayer.on("mouseover", () => {
          polygonLayer.setStyle({ fillOpacity: Math.min(origOp + 0.18, 0.55), weight: boundaryWeight + 1 });
          polygonLayer.bringToFront();
        });
        polygonLayer.on("mouseout", () => {
          polygonLayer.setStyle({ fillOpacity: origOp, weight: boundaryWeight });
        });
      }

      // Show UPI Code and Area on the map centered on polygon
      const centroidLatLng = svgToLatLng(parcel.center);
      const statusDotColor =
        parcel.status === ParcelStatus.APPROVED ? "#16a34a" :
        parcel.status === ParcelStatus.DISPUTED ? "#dc2626" :
        parcel.status === ParcelStatus.UNDER_SURVEY ? "#d97706" :
        parcel.status === ParcelStatus.PENDING_MUTATION ? "#2563eb" : "#94a3b8";

      const landUseAbbr = parcel.landUse.replace(/ \(.*\)/, "");

      const tooltipContent = isCadastral
        ? `<div class="text-center font-mono leading-tight select-none pointer-events-none p-1 min-w-[130px]">
            <div class="flex items-center justify-center gap-1 mb-0.5">
              <span class="w-1.5 h-1.5 rounded-full" style="background:${statusDotColor}"></span>
              <span class="text-[9px] font-black text-slate-900">${parcel.upi}</span>
            </div>
            <div class="text-[7.5px] text-slate-600 font-semibold truncate max-w-[130px]">
              ${parcel.ownerName}
            </div>
            <div class="flex items-center justify-center gap-1 mt-0.5">
              <span class="text-[6.5px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1 rounded">${landUseAbbr}</span>
              <span class="text-[7px] text-slate-400">${parcel.area.toLocaleString()} m²</span>
            </div>
          </div>`
        : isSurvey
        ? `<div class="text-center font-mono leading-tight select-none pointer-events-none p-1.5 min-w-[140px]">
            <div class="text-[11px] font-black text-slate-900">UPI ${parcel.upi.split("/").pop()}</div>
            <div class="text-[18px] font-black text-blue-700 my-0.5">${parcel.area.toLocaleString()}<span class="text-[10px]"> m²</span></div>
            <div class="border-t border-slate-200 pt-0.5 text-[8px] text-slate-500">${(parcel.area / 10000).toFixed(4)} ha</div>
          </div>`
        : `<div class="text-center font-mono leading-tight select-none pointer-events-none p-1">
            <div class="text-[9.5px] font-bold ${isSelected ? 'text-emerald-700' : 'text-rose-700'}">
              ${parcel.upi.split("/").pop()}
            </div>
            <div class="text-[8px] text-slate-500 font-semibold">
              ${parcel.area.toLocaleString()} m²
            </div>
          </div>`;

      polygonLayer.bindTooltip(tooltipContent, {
        permanent: true,
        direction: "center",
        className: isCadastral
          ? "bg-white/95 border-2 border-slate-300 rounded-md shadow-md px-1 py-0.5"
          : isSurvey
          ? "bg-white border-2 border-blue-400 rounded-xl shadow-lg px-2 py-1"
          : "bg-white/80 border border-slate-200/50 rounded shadow-xs px-1.5 py-0.5"
      });

      // Status badge color map
      const statusBadge =
        parcel.status === ParcelStatus.APPROVED
          ? '<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">APPROVED</span>'
          : parcel.status === ParcelStatus.DISPUTED
          ? '<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200">DISPUTED</span>'
          : parcel.status === ParcelStatus.UNDER_SURVEY
          ? '<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200">UNDER SURVEY</span>'
          : parcel.status === ParcelStatus.PENDING_MUTATION
          ? '<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200">PENDING MUTATION</span>'
          : `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-50 text-slate-600 border border-slate-200">${parcel.status}</span>`;

      const taxBadge = parcel.taxPaid
        ? '<span class="text-[8px] font-bold text-emerald-600">\u2713 Tax Paid</span>'
        : '<span class="text-[8px] font-bold text-rose-500">\u2717 Tax Due</span>';

      // Google Maps-like click popup system
      const popupHTML = `
        <div class="p-3 font-sans text-xs space-y-2 min-w-[260px]">
          <div class="flex items-center justify-between border-b pb-1.5">
            <span class="font-bold text-slate-800 text-[11px] font-mono">UPI: ${parcel.upi}</span>
            ${statusBadge}
          </div>
          <div class="grid grid-cols-2 gap-y-1 text-slate-600 text-[10.5px]">
            <span>Proprietor:</span>
            <strong class="text-slate-800 text-right">${parcel.ownerName}</strong>
            <span>Owner Type:</span>
            <strong class="text-slate-800 text-right">${parcel.ownerType}</strong>
            <span>Zoning:</span>
            <strong class="text-slate-800 text-right">${parcel.landUse}</strong>
            <span>Area:</span>
            <strong class="text-slate-800 text-right font-mono">${parcel.area.toLocaleString()} m²</strong>
            <span>Valuation:</span>
            <strong class="text-slate-800 text-right font-mono">${parcel.marketValue.toLocaleString()} RWF</strong>
            <span>Annual Tax:</span>
            <strong class="text-slate-800 text-right font-mono">${parcel.annualTax.toLocaleString()} RWF ${taxBadge}</strong>
            <span>Location:</span>
            <span class="text-slate-800 text-right">${parcel.district} / ${parcel.sector}</span>
          </div>
          <div class="bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px] text-slate-500 text-center">
            ${parcel.cell}, ${parcel.village}
          </div>
        </div>
      `;
      polygonLayer.bindPopup(popupHTML);

      // Connect selection handler
      polygonLayer.on("click", () => {
        onSelectParcel(parcel);
      });

      parcelsLayerGroupRef.current?.addLayer(polygonLayer);

      // Survey mode: edge distance labels and corner markers
      if (isSurvey) {
        for (let i = 0; i < parcel.polygon.length; i++) {
          const j = (i + 1) % parcel.polygon.length;
          const p1 = parcel.polygon[i];
          const p2 = parcel.polygon[j];
          const dist = calculateDistance(p1, p2);

          const midX = (p1[0] + p2[0]) / 2;
          const midY = (p1[1] + p2[1]) / 2;
          const midLatLng = svgToLatLng([midX, midY]);

          const edgeLabel = L.marker(midLatLng, {
            icon: L.divIcon({
              html: `<div class="bg-blue-600 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap border border-blue-400">${dist} m</div>`,
              className: "border-none",
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            })
          });
          parcelsLayerGroupRef.current?.addLayer(edgeLabel);

          const cornerLatLng = svgToLatLng(p1);
          const cornerMarker = L.circleMarker(cornerLatLng, {
            radius: 5,
            fillColor: "#0f172a",
            color: "#ffffff",
            weight: 2,
            fillOpacity: 1,
          });
          cornerMarker.bindTooltip(`<span class="font-mono font-bold text-[9px]">V${i + 1} (${p1[0]}, ${p1[1]})</span>`, {
            direction: "top",
            className: "bg-slate-900 text-white border-none rounded px-1.5 py-0.5 text-[8px]"
          });
          parcelsLayerGroupRef.current?.addLayer(cornerMarker);
        }
      }
    });

    // -- E. Active Survey Geofence alerting ring --
    const activeSurvey = parcels.find(p => p.id === activeSurveyParcelId);
    if (activeSurvey) {
      const circleCenter = svgToLatLng(activeSurvey.center);
      const radiusMeters = activeGeofenceRadius;

      const geofenceCircle = L.circle(circleCenter, {
        radius: radiusMeters,
        color: "#f59e0b",
        weight: 1.5,
        fillColor: "#f59e0b",
        fillOpacity: 0.05,
        dashArray: "3, 6",
      });

      geofenceCircle.bindTooltip(`SURVEY ALERT ZONE: ${radiusMeters}m`, {
        permanent: true,
        direction: "top",
        className: "bg-amber-900 text-white font-bold text-[8.5px] rounded px-1.5 py-0.5 border-none shadow-md"
      });

      environmentalLayerGroupRef.current.addLayer(geofenceCircle);
    }

  }, [parcels, selectedParcel, activeSurveyParcelId, showWetlands, showRoadReserve, showGrid]);

  // 6. Draw local cursor edits (vertex dragging) and temp drawings on changes
  useEffect(() => {
    if (!mapInstanceRef.current || !drawingLayerGroupRef.current || !vertexMarkersLayerGroupRef.current) return;

    drawingLayerGroupRef.current.clearLayers();
    vertexMarkersLayerGroupRef.current.clearLayers();

    // -- A. Draw Temporary Polygon segments in progress --
    if (isDrawingMode && drawPoints.length > 0) {
      const latLngs = drawPoints.map(pt => svgToLatLng(pt));

      if (latLngs.length > 1) {
        // Line route
        const line = L.polyline(latLngs, { color: "#3b82f6", weight: 3 });
        drawingLayerGroupRef.current.addLayer(line);
      }

      if (latLngs.length > 2) {
        // Closing segment preview
        const closingLine = L.polyline([latLngs[latLngs.length - 1], latLngs[0]], {
          color: "#60a5fa",
          weight: 1.5,
          dashArray: "4, 4"
        });
        drawingLayerGroupRef.current.addLayer(closingLine);
      }

      // Add vertex handles for active drawing
      latLngs.forEach((latLng, idx) => {
        const marker = L.circleMarker(latLng, {
          radius: 5,
          fillColor: "#3b82f6",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 1
        });
        marker.bindTooltip(`Node ${idx + 1}`, { direction: "top" });
        drawingLayerGroupRef.current?.addLayer(marker);
      });
    }

    // -- B. Draw Ruler Measurement Lines --
    if (isRulerActive && rulerPoints.length > 0) {
      const latLngs = rulerPoints.map(pt => svgToLatLng(pt));

      const rulerLine = L.polyline(latLngs, { color: "#ec4899", weight: 3 });
      drawingLayerGroupRef.current.addLayer(rulerLine);

      latLngs.forEach((latLng, idx) => {
        const marker = L.circleMarker(latLng, {
          radius: 4,
          fillColor: "#ec4899",
          color: "#ffffff",
          weight: 1.5,
          fillOpacity: 1
        });
        drawingLayerGroupRef.current?.addLayer(marker);

        // Display segment distances
        if (idx > 0) {
          const prevSvg = rulerPoints[idx - 1];
          const currSvg = rulerPoints[idx];
          const segmentDist = calculateDistance(prevSvg, currSvg);

          // Place segment mid-point tooltip
          const midLat = (latLngs[idx - 1][0] + latLngs[idx][0]) / 2;
          const midLon = (latLngs[idx - 1][1] + latLngs[idx][1]) / 2;

          const distanceMarker = L.marker([midLat, midLon], {
            icon: L.divIcon({
              html: `<span class="bg-pink-900 border border-pink-400 text-white font-mono text-[8.5px] font-bold px-1.5 py-0.5 rounded shadow-md">${segmentDist}m</span>`,
              className: "border-none",
              iconSize: [40, 15],
              iconAnchor: [20, 7.5],
            })
          });
          drawingLayerGroupRef.current?.addLayer(distanceMarker);
        }
      });
    }

    // -- C. Draggable Vertex Editing for Selected Parcel --
    if (isEditingVertices && localEditPoints.length > 0) {
      const latLngs = localEditPoints.map(pt => svgToLatLng(pt));

      // Interactive preview polygon
      const previewPoly = L.polygon(latLngs, {
        color: "#d97706",
        weight: 2.5,
        fillColor: "#f59e0b",
        fillOpacity: 0.15,
        dashArray: "4, 4"
      });
      drawingLayerGroupRef.current.addLayer(previewPoly);

      // Render draggable marker handle on each vertex
      localEditPoints.forEach((pt, idx) => {
        const lLng = svgToLatLng(pt);
        const nodeIcon = L.divIcon({
          html: `<div class="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md flex items-center justify-center font-mono text-[9.5px] font-black text-white hover:scale-110 cursor-move">V${idx + 1}</div>`,
          className: "bg-transparent border-none",
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const vMarker = L.marker(lLng, {
          draggable: true,
          icon: nodeIcon
        });

        // Track dragging coordinates to update local state in real time
        vMarker.on("drag", (e: L.LeafletEvent) => {
          const draggedMarker = e.target as L.Marker;
          const newPos = draggedMarker.getLatLng();
          const svgCoords = latLngToSvg([newPos.lat, newPos.lng]);

          setLocalEditPoints((prev) => {
            const copy = [...prev];
            copy[idx] = svgCoords;
            return copy;
          });
        });

        vertexMarkersLayerGroupRef.current?.addLayer(vMarker);
      });
    }

  }, [isDrawingMode, drawPoints, isRulerActive, rulerPoints, isEditingVertices, localEditPoints]);

  // 7. Render dynamic Telemetry entities on map (Sensors, Users cursors, Live GPS, Drone)
  useEffect(() => {
    if (!mapInstanceRef.current || !telemetryLayerGroupRef.current) return;

    telemetryLayerGroupRef.current.clearLayers();

    // -- A. IoT Ground Telemetry Anchors --
    iotSensors.forEach((sensor) => {
      const latLng = svgToLatLng(sensor.coordinates);
      const isOnline = sensor.status === "Online";

      const htmlBadge = `
        <div class="relative group cursor-pointer flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50">
            <span class="w-4 h-4 flex items-center justify-center">📡</span>
          </div>
          ${isOnline ? `<div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full animate-ping"></div>` : ""}
          <div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full"></div>
        </div>
      `;

      const iotMarker = L.marker(latLng, {
        icon: L.divIcon({
          html: htmlBadge,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });

      // Bind detailed telemetry tooltips
      iotMarker.bindTooltip(
        `<div class="p-2 font-sans text-[10px] space-y-1 font-semibold leading-normal min-w-[150px]">
          <div class="font-bold border-b pb-1 text-slate-800">${sensor.name}</div>
          <div class="text-blue-600 font-mono text-[9px]">${sensor.reading.split("|")[0]}</div>
          <div class="text-slate-500 text-[8px]">${sensor.reading.split("|")[1] || ""}</div>
         </div>`,
        { direction: "top", opacity: 0.95 }
      );

      telemetryLayerGroupRef.current?.addLayer(iotMarker);
    });

    // -- B. Live Surveyor GPS walk path beacons --
    Object.values(surveyorGps).forEach((s: any) => {
      if (!s.lat || !s.lon) return;

      const htmlBadge = `
        <div class="flex flex-col items-center select-none pointer-events-none">
          <div class="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg animate-bounce flex items-center justify-center"></div>
          <div class="w-6 h-6 bg-blue-500/25 rounded-full absolute -top-1 animate-ping"></div>
          <div class="mt-1 bg-slate-900/90 text-white border border-blue-400 rounded-sm px-1.5 py-0.5 text-[8px] font-sans font-bold shadow-lg whitespace-nowrap">
            🏃 ${s.name} (LIVE RTK)
          </div>
        </div>
      `;

      const gpsMarker = L.marker([s.lat, s.lon], {
        icon: L.divIcon({
          html: htmlBadge,
          className: "",
          iconSize: [80, 40],
          iconAnchor: [40, 8]
        })
      });

      telemetryLayerGroupRef.current?.addLayer(gpsMarker);
    });

    // -- C. Real-time flying Drone Sentinel Simulator --
    const droneLatLng = svgToLatLng([dronePos.x, dronePos.y]);
    const droneHTML = `
      <div class="relative flex items-center justify-center select-none pointer-events-none animate-pulse">
        <div class="w-8 h-8 rounded-full bg-white border border-emerald-500 shadow-md flex items-center justify-center">
          🛸
        </div>
        <div class="absolute w-12 h-12 border border-emerald-400/40 rounded-full animate-spin"></div>
        <span class="absolute top-7 bg-emerald-950 text-emerald-300 px-1 py-0.5 rounded text-[7.5px] font-black uppercase tracking-widest whitespace-nowrap border border-emerald-700">Drone Active</span>
      </div>
    `;

    const droneMarker = L.marker(droneLatLng, {
      icon: L.divIcon({
        html: droneHTML,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    });
    telemetryLayerGroupRef.current.addLayer(droneMarker);

    // -- D. Real-time Multi-user collaboration cursors --
    Object.values(cursors).forEach((c: any) => {
      if (!c.lat || !c.lon) return;

      const color = c.role === "Citizen" ? "#10b981" : c.role === "Licensed Surveyor" ? "#3b82f6" : c.role === "Land Officer" ? "#ef4444" : "#8b5cf6";
      const cursorHTML = `
        <div class="relative select-none pointer-events-none flex items-center gap-1">
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5.5 14.5L9.5 10.5L14.5 14.5L15 13.5L10.5 9.5L14.5 5.5L1 1Z" fill="${color}" stroke="white" stroke-width="1.5"/>
          </svg>
          <span class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-100 font-sans font-bold text-[8.5px] shadow-lg border border-slate-700 whitespace-nowrap">
            ${c.name}
          </span>
        </div>
      `;

      const cursorMarker = L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          html: cursorHTML,
          className: "",
          iconSize: [120, 24],
          iconAnchor: [0, 0]
        })
      });

      telemetryLayerGroupRef.current?.addLayer(cursorMarker);
    });

  }, [iotSensors, surveyorGps, dronePos, cursors]);

  // 8. Smooth zoom-to-parcel animation on selectedParcel change
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedParcel) return;

    const latLngs = selectedParcel.polygon.map(pt => svgToLatLng(pt));
    const bounds = L.latLngBounds(latLngs.map(pt => L.latLng(pt[0], pt[1])));
    
    mapInstanceRef.current.flyToBounds(bounds, {
      padding: [50, 50],
      duration: 1.5,
      easeLinearity: 0.25,
      animate: true
    });
  }, [selectedParcel]);

  // 9. Map-specific keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case "1":
          setMapMode("street");
          break;
        case "2":
          setMapMode("satellite");
          break;
        case "3":
          setMapMode("contour");
          break;
        case "4":
          setMapMode("cadastral");
          break;
        case "5":
          setMapMode("survey");
          break;
        case "d":
        case "D":
          e.preventDefault();
          setIsDrawingMode(!isDrawingMode);
          if (!isDrawingMode) {
            setIsRulerActive(false);
            setIsEditingVertices(false);
          }
          break;
        case "r":
        case "R":
          e.preventDefault();
          setIsRulerActive((p) => !p);
          if (!isRulerActive) {
            setIsDrawingMode(false);
            setIsEditingVertices(false);
            setDrawPoints([]);
            setDrawArea(0);
          }
          break;
        case "m":
        case "M":
          e.preventDefault();
          setIs3DMode((p) => !p);
          break;
        case "w":
        case "W":
          e.preventDefault();
          setShowWetlands((p) => !p);
          break;
        case "b":
        case "B":
          e.preventDefault();
          setShowRoadReserve((p) => !p);
          break;
        case "g":
        case "G":
          e.preventDefault();
          setShowGrid((p) => !p);
          break;
        case "l":
        case "L":
          e.preventDefault();
          setIsLayerPanelOpen((p) => !p);
          break;
        case "Escape":
          if (isDrawingMode) {
            setIsDrawingMode(false);
            setDrawPoints([]);
            setDrawArea(0);
          }
          if (isRulerActive) {
            setIsRulerActive(false);
            setRulerPoints([]);
          }
          if (isEditingVertices) {
            setIsEditingVertices(false);
          }
          if (isLayerPanelOpen) {
            setIsLayerPanelOpen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDrawingMode, isRulerActive, isEditingVertices, isLayerPanelOpen]);

  // Handle vertex updates saving
  const handleSaveVertexEdits = () => {
    if (!selectedParcel || localEditPoints.length < 3) return;

    // Recalculate area
    const newArea = calculatePolygonArea(localEditPoints);
    
    // Call complete or handle update
    if (onDrawComplete) {
      // Trigger update of boundaries inside our application registry
      selectedParcel.polygon = localEditPoints;
      selectedParcel.area = newArea;
      // Est center
      const xs = localEditPoints.map(pt => pt[0]);
      const ys = localEditPoints.map(pt => pt[1]);
      selectedParcel.center = [
        Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
        Math.round((Math.min(...ys) + Math.max(...ys)) / 2)
      ];
      
      // Notify parent selection
      onSelectParcel({ ...selectedParcel });
    }

    setIsEditingVertices(false);
  };

  // Google Maps Style Locate GPS center action
  const handleLocateUserGPS = useCallback(() => {
    if (!mapInstanceRef.current) return;
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current?.setView([latitude, longitude], 17, { animate: true });
        setGpsLocating(false);
      },
      () => {
        mapInstanceRef.current?.setView([-1.95420, 30.08940], 17, { animate: true });
        setTimeout(() => setGpsLocating(false), 800);
      },
      { timeout: 3000 }
    );
  }, []);

  const handleSearchUPI = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const matched = parcels.filter(p => p.upi.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    setSearchResults(matched);
    if (matched.length > 0) {
      onSelectParcel(matched[0]);
    }
  }, [searchQuery, parcels, onSelectParcel]);

  const handleCompleteDrawing = useCallback(() => {
    if (drawPoints.length < 3) return;
    if (onDrawComplete) {
      onDrawComplete(drawPoints, drawArea);
    }
    setDrawPoints([]);
    setDrawArea(0);
    setIsDrawingMode(false);
    setOverlapWarning({ isOverlapping: false });
  }, [drawPoints, drawArea, onDrawComplete, setIsDrawingMode]);

  // Parcel statistics for cadastral mode
  const parcelStats = React.useMemo(() => {
    const total = parcels.length;
    const totalArea = parcels.reduce((s, p) => s + p.area, 0);
    const byStatus = {
      approved: parcels.filter(p => p.status === ParcelStatus.APPROVED).length,
      disputed: parcels.filter(p => p.status === ParcelStatus.DISPUTED).length,
      underSurvey: parcels.filter(p => p.status === ParcelStatus.UNDER_SURVEY).length,
      pendingMutation: parcels.filter(p => p.status === ParcelStatus.PENDING_MUTATION).length,
    };
    const byLandUse = {
      residential: parcels.filter(p => p.landUse === LandUse.RESIDENTIAL).length,
      agricultural: parcels.filter(p => p.landUse === LandUse.AGRICULTURAL).length,
      commercial: parcels.filter(p => p.landUse === LandUse.COMMERCIAL).length,
      forestry: parcels.filter(p => p.landUse === LandUse.FORESTRY).length,
      industrial: parcels.filter(p => p.landUse === LandUse.INDUSTRIAL).length,
      protected: parcels.filter(p => p.landUse === LandUse.PROTECTED).length,
    };
    return { total, totalArea, byStatus, byLandUse };
  }, [parcels]);

  return (
    <div id="gis_container" ref={gisContainerRef} className={`flex flex-col bg-white border rounded-lg overflow-hidden shadow-sm h-full min-h-[150px] ${isFullscreen ? 'fixed inset-0 z-[9999] border-0 rounded-none' : 'border-slate-200'}`}>
      
      {/* 1. Map Toolbar controls */}
      <div id="gis_map_toolbar" className={`flex flex-wrap items-center justify-between px-5 py-3 gap-4 ${isFullscreen ? 'bg-slate-900 text-white border-b border-slate-700' : 'bg-slate-50 border-b border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-teal-600" />
          <span className={`font-sans font-bold text-xs tracking-tight ${isFullscreen ? 'text-white' : 'text-slate-800'}`}>Kigali Leaflet GIS Engine</span>
        </div>
        
        {/* Layer Toggles & Mode Selection */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-md">
            <button
              id="layer_btn_street"
              onClick={() => setMapMode("street")}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-bold transition ${
                mapMode === "street" ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              Street Map
            </button>
            <button
              id="layer_btn_sat"
              onClick={() => setMapMode("satellite")}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-bold transition ${
                mapMode === "satellite" ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              Satellite Ortho
            </button>
            <button
              id="layer_btn_topo"
              onClick={() => setMapMode("contour")}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-bold transition ${
                mapMode === "contour" ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Topo Contours
            </button>
            <button
              id="layer_btn_cadastral"
              onClick={() => setMapMode("cadastral")}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-bold transition ${
                mapMode === "cadastral" ? "bg-white text-amber-700 shadow-xs border border-amber-300" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              Cadastral Map
            </button>
            <button
              id="layer_btn_survey"
              onClick={() => setMapMode("survey")}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-bold transition ${
                mapMode === "survey" ? "bg-white text-teal-600 shadow-xs border border-teal-300" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              Survey Map
            </button>
            <button
              id="layer_btn_3d"
              onClick={() => setIs3DMode(!is3DMode)}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 font-bold transition ${
                is3DMode ? "bg-amber-100 text-amber-700 border border-amber-200" : "text-slate-500 hover:text-slate-700"
              }`}
              title="Toggle 3D Terrain Perspective Mode"
            >
              <Compass className={`w-3.5 h-3.5 ${is3DMode ? 'animate-spin-slow' : ''}`} />
              3D Terrain view
            </button>
          </div>

          {/* Environmental Toggles */}
          <div className="flex gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-md">
            <button
              id="wetlands_toggle"
              onClick={() => setShowWetlands(!showWetlands)}
              className={`p-1 rounded transition ${showWetlands ? "bg-cyan-100 text-cyan-700" : "text-slate-400"}`}
              title="Toggle Wetlands Layer"
            >
              <FlameKindling className="w-3.5 h-3.5" />
            </button>
            <button
              id="road_toggle"
              onClick={() => setShowRoadReserve(!showRoadReserve)}
              className={`p-1 rounded transition ${showRoadReserve ? "bg-amber-100 text-amber-700" : "text-slate-400"}`}
              title="Toggle Road Buffers"
            >
              <Landmark className="w-3.5 h-3.5" />
            </button>
            <button
              id="grid_toggle"
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1 rounded transition ${showGrid ? "bg-blue-100 text-blue-700" : "text-slate-400"}`}
              title="Toggle Spatial Grid Overlay"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Leaflet viewport & controls */}
      <div className="relative flex-1 bg-slate-50 overflow-hidden flex flex-col">
        
        {/* Floating Google Maps-style Search Bar */}
        <div className="absolute top-3 left-3 z-[500] w-[calc(100vw-6rem)] md:w-72">
          <form onSubmit={handleSearchUPI} className="flex bg-white rounded-lg shadow-md border border-slate-200/90 overflow-hidden">
            <input
              id="gis_search_input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Land UPI (e.g., 1841)..."
              className="pl-6 pr-3 py-2 text-xs flex-1 outline-none text-slate-800 placeholder-slate-400"
            />
            <button
              id="gis_search_submit"
              type="submit"
              className="px-3 bg-slate-50 border-l border-slate-100 text-slate-500 hover:text-blue-600 transition flex items-center justify-center cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

          {/* Floating Compass, Zoom, Layers, and GPS location control */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
          {/* Compass rose */}
          <div className="bg-white/90 backdrop-blur-xs border border-slate-200 p-1.5 rounded-lg shadow-md flex flex-col items-center">
            <Compass className="w-4 h-4 text-blue-600 animate-spin-slow" />
            <span className="font-mono text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">WGS 84</span>
          </div>

          {/* Custom Zoom Controls */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-md flex flex-col overflow-hidden">
            <button
              id="zoom_in_btn"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="p-2 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition cursor-pointer active:scale-95 border-b border-slate-200"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              id="zoom_out_btn"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="p-2 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition cursor-pointer active:scale-95"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
          </div>

          {/* Floating Layers Selection Toggle Button */}
          <button
            id="floating_layers_toggle_btn"
            onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
            className={`p-2 rounded-lg border shadow-md flex items-center justify-center transition cursor-pointer active:scale-95 ${
              isLayerPanelOpen 
                ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title="Map Base Layers"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* GPS positioning button */}
          <button
            id="gps_locate_btn"
            onClick={handleLocateUserGPS}
            disabled={gpsLocating}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 shadow-md flex items-center justify-center transition cursor-pointer active:scale-95 disabled:opacity-55"
            title="Locate via GPS"
          >
            <Navigation className={`w-4 h-4 text-indigo-600 ${gpsLocating ? 'animate-pulse' : ''}`} />
          </button>

          {/* Fullscreen toggle button */}
          <button
            id="fullscreen_toggle_btn"
            onClick={toggleFullscreen}
            className={`p-2 rounded-lg border shadow-md flex items-center justify-center transition cursor-pointer active:scale-95 ${
              isFullscreen
                ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isFullscreen ? (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                </>
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8V5a2 2 0 012-2h3m0 18H5a2 2 0 01-2-2v-3m14 0h3a2 2 0 012 2v3m0-14V5a2 2 0 00-2-2h-3" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Floating Layer Control Panel Flyout */}
        {isLayerPanelOpen && (
          <div id="gis_floating_layer_control" className="absolute top-3 left-3 md:left-auto md:right-16 z-[500] bg-white/95 border border-slate-200/90 p-3 rounded-xl shadow-xl flex flex-col gap-2.5 w-[calc(100vw-1.5rem)] md:min-w-[200px] md:w-auto animate-in fade-in slide-in-from-right-3 duration-200 backdrop-blur-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-sans font-extrabold text-[10px] uppercase tracking-wider text-slate-700">Map Type</span>
              <button 
                id="floating_layers_close"
                onClick={() => setIsLayerPanelOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {/* OpenStreetMap */}
              <button
                id="layer_select_street"
                type="button"
                onClick={() => {
                  setMapMode("street");
                }}
                className={`flex items-center gap-3 p-1.5 rounded-lg border text-left transition cursor-pointer ${
                  mapMode === "street" 
                    ? "bg-indigo-50/80 border-indigo-500 text-indigo-700" 
                    : "border-slate-150 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="w-9 h-9 rounded bg-sky-100 flex items-center justify-center text-lg border border-sky-200 shrink-0">
                  🗺️
                </div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[10.5px] leading-tight text-slate-800">OpenStreetMap</span>
                  <span className="text-[8.5px] text-slate-400">Standard OSM Base Layer</span>
                </div>
              </button>

              {/* Satellite */}
              <button
                id="layer_select_satellite"
                type="button"
                onClick={() => {
                  setMapMode("satellite");
                }}
                className={`flex items-center gap-3 p-1.5 rounded-lg border text-left transition cursor-pointer ${
                  mapMode === "satellite" 
                    ? "bg-indigo-50/80 border-indigo-500 text-indigo-700" 
                    : "border-slate-150 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="w-9 h-9 rounded bg-emerald-950 flex items-center justify-center text-lg border border-emerald-800 shrink-0">
                  🛰️
                </div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[10.5px] leading-tight text-slate-800">Satellite</span>
                  <span className="text-[8.5px] text-slate-400">Esri World Imagery</span>
                </div>
              </button>

              {/* Terrain */}
              <button
                id="layer_select_terrain"
                type="button"
                onClick={() => {
                  setMapMode("contour");
                }}
                className={`flex items-center gap-3 p-1.5 rounded-lg border text-left transition cursor-pointer ${
                  mapMode === "contour" 
                    ? "bg-indigo-50/80 border-indigo-500 text-indigo-700" 
                    : "border-slate-150 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="w-9 h-9 rounded bg-orange-50 flex items-center justify-center text-lg border border-orange-200 shrink-0">
                  🏔️
                </div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[10.5px] leading-tight text-slate-800">Terrain</span>
                  <span className="text-[8.5px] text-slate-400">OpenTopo Elevation Contours</span>
                </div>
              </button>

              {/* Cadastral */}
              <button
                id="layer_select_cadastral"
                type="button"
                onClick={() => {
                  setMapMode("cadastral");
                }}
                className={`flex items-center gap-3 p-1.5 rounded-lg border text-left transition cursor-pointer ${
                  mapMode === "cadastral" 
                    ? "bg-amber-50/80 border-amber-500 text-amber-700" 
                    : "border-slate-150 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-lg border border-slate-300 shrink-0">
                  🏛️
                </div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[10.5px] leading-tight text-slate-800">Cadastral Map</span>
                  <span className="text-[8.5px] text-slate-400">CARTO Light Parcel Basemap</span>
                </div>
              </button>

              {/* Survey */}
              <button
                id="layer_select_survey"
                type="button"
                onClick={() => {
                  setMapMode("survey");
                }}
                className={`flex items-center gap-3 p-1.5 rounded-lg border text-left transition cursor-pointer ${
                  mapMode === "survey" 
                    ? "bg-teal-50/80 border-teal-500 text-teal-700" 
                    : "border-slate-150 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <div className="w-9 h-9 rounded bg-blue-50 flex items-center justify-center text-lg border border-blue-200 shrink-0">
                  📏
                </div>
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-[10.5px] leading-tight text-slate-800">Survey Map</span>
                  <span className="text-[8.5px] text-slate-400">Precise Measurements & Boundaries</span>
                </div>
              </button>
            </div>

            {/* Feature Overlays Toggle Block */}
            <div className="border-t border-slate-100 pt-2.5 mt-1 space-y-1.5">
              <span className="font-sans font-bold text-[9px] text-slate-400 uppercase tracking-wider block">Feature Overlays</span>
              
              <label className="flex items-center justify-between text-[10px] text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  Wetland Reserves
                </span>
                <input
                  type="checkbox"
                  checked={showWetlands}
                  onChange={(e) => setShowWetlands(e.target.checked)}
                  className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-[10px] text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Road Buffer Zones
                </span>
                <input
                  type="checkbox"
                  checked={showRoadReserve}
                  onChange={(e) => setShowRoadReserve(e.target.checked)}
                  className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-[10px] text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  UTM Spatial Grid
                </span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* Spatial Overlaps Adjudication Warning Overlay */}
        {overlapWarning.isOverlapping && (
          <div className="absolute top-16 left-3 right-16 z-[500] bg-rose-50 border border-rose-200 p-2.5 rounded-lg shadow-md flex items-center gap-2.5 animate-bounce">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <div className="font-sans font-bold text-rose-900 text-[10.5px]">Boundary Overlap Warning!</div>
              <p className="font-sans text-rose-700 text-[9.5px] mt-0.5 leading-normal">
                Adjudicated bounds encroach on parcel <strong className="font-bold text-rose-950">{overlapWarning.overlappedUpi}</strong> ({overlapWarning.overlappedOwner}).
              </p>
            </div>
          </div>
        )}

        {/* 3D GIMBAL CAMERA FLIGHT CONTROLLER */}
        {is3DMode && (
          <div id="gis_3d_gimbal_panel" className="absolute top-28 right-3 z-[500] bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-xl backdrop-blur-md text-slate-100 w-56 space-y-2.5 animate-in slide-in-from-right-5 duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-sans font-black text-[9.5px] uppercase tracking-wider text-amber-400">3D Terrain Gimbal</span>
              <span className="text-[8.5px] font-mono text-slate-400">WGS 84 GEO</span>
            </div>
            
            {/* Tilt / Pitch */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-300">
                <span>Camera Tilt (Pitch)</span>
                <span className="font-mono text-amber-400">{pitch}°</span>
              </div>
              <input
                id="gimbal_tilt_slider"
                type="range"
                min="0"
                max="65"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Rotation / Bearing */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-300">
                <span>Orbit Bearing (Yaw)</span>
                <span className="font-mono text-amber-400">{bearing}°</span>
              </div>
              <input
                id="gimbal_bearing_slider"
                type="range"
                min="-180"
                max="180"
                value={bearing}
                onChange={(e) => setBearing(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Elevation Exaggeration (Simulated Height) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-slate-300">
                <span>Height Exaggeration</span>
                <span className="font-mono text-amber-400">{elevationExaggeration.toFixed(1)}x</span>
              </div>
              <input
                id="gimbal_elevation_slider"
                type="range"
                min="1.0"
                max="4.0"
                step="0.5"
                value={elevationExaggeration}
                onChange={(e) => setElevationExaggeration(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="flex justify-between gap-1.5 pt-1 text-[8px]">
              <button 
                id="gimbal_reset_btn"
                type="button"
                onClick={() => { setPitch(35); setBearing(-15); setElevationExaggeration(1.5); }}
                className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-300 font-bold uppercase transition cursor-pointer"
              >
                Reset Gimbal
              </button>
              <button 
                id="gimbal_flyto_btn"
                type="button"
                onClick={() => { setPitch(55); setBearing(45); setElevationExaggeration(3.0); }}
                className="flex-1 py-1 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 rounded text-center font-bold uppercase transition border border-amber-900/30 cursor-pointer"
              >
                Fly-to Peak
              </button>
            </div>
          </div>
        )}

        {/* Real Leaflet Map Container div wrapped with CSS Perspective transform */}
        <div 
          className="w-full flex-1 min-h-[150px] overflow-hidden relative flex flex-col"
          style={{
            perspective: is3DMode ? "1200px" : "none",
            perspectiveOrigin: "50% 60%",
            transformStyle: "preserve-3d"
          }}
        >
          <div 
            ref={mapContainerRef} 
            id="leaflet_map_container"
            className="w-full flex-1 z-0"
            style={{
              transform: is3DMode 
                ? `rotateX(${pitch}deg) rotateZ(${bearing}deg) scale(${1 + (pitch / 140) * 0.15})`
                : "none",
              transformOrigin: "50% 70%",
              transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* GIS Interactive Status Footer */}
        <div className="absolute bottom-4 left-4 right-4 z-[500] bg-white/95 border border-slate-200 p-3 rounded-xl shadow-lg backdrop-blur-xs flex flex-wrap items-center justify-between text-[11px] gap-3">
          
          {/* UTM Coordinates Tracking */}
          <div className="flex items-center gap-3 font-mono text-slate-700">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans text-[9px] uppercase tracking-wider">UTM E:</span>
              <strong className="text-blue-600 font-bold">{mouseCoord.utmE.toLocaleString()} m E</strong>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans text-[9px] uppercase tracking-wider">UTM N:</span>
              <strong className="text-blue-600 font-bold">{mouseCoord.utmN.toLocaleString()} m N</strong>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-slate-400 font-sans text-[9px] uppercase tracking-wider">LAT/LON:</span>
              <span className="text-slate-500 font-medium text-[9.5px]">{mouseCoord.lat.toFixed(5)}°, {mouseCoord.lon.toFixed(5)}°</span>
            </div>
          </div>

          {/* Cadastral Land Use Legend — Strong Cadastral Mapping */}
          {mapMode === "cadastral" && (
            <div className="flex items-center gap-3 text-[8px] font-sans flex-wrap">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Land Use:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:"#e2e8f0",border:"1px solid #cbd5e1"}}></span> Residential</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:"#65a30d",border:"1px solid #4d7c0f"}}></span> Agri</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:"#a855f7",border:"1px solid #9333ea"}}></span> Commercial</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:"#059669",border:"1px solid #047857"}}></span> Forestry</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:"#ea580c",border:"1px solid #c2410c"}}></span> Industrial</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background:"#0891b2",border:"1px solid #0e7490"}}></span> Protected</span>
              <span className="w-px h-3 bg-slate-200 mx-1"></span>
              <span className="text-slate-400 font-bold uppercase tracking-wider">Status:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5" style={{background:"#16a34a"}}></span> Approved</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2" style={{background:"#dc2626",borderTop:"2px dashed #dc2626"}}></span> Disputed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{background:"#d97706",borderTop:"1.5px dashed #d97706"}}></span> Under Survey</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{background:"#2563eb",borderTop:"1px dotted #2563eb"}}></span> Pending Mut.</span>
            </div>
          )}

          {/* Survey Legend */}
          {mapMode === "survey" && (
            <div className="flex items-center gap-2 text-[8px] font-sans">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Survey:</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 border border-white"></span> Corner Vertex</span>
              <span className="flex items-center gap-1 text-blue-700 font-semibold">— 142 m —</span>
              <span className="text-slate-500 text-[7px]">Edge Distance</span>
            </div>
          )}

          {/* Interactive GIS Actions panel */}
          <div className="flex items-center gap-1.5">
            {isDrawingMode ? (
              <>
                <button
                  id="btn_complete_draw"
                  onClick={handleCompleteDrawing}
                  disabled={drawPoints.length < 3}
                  className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-50 font-bold transition flex items-center gap-1 text-[10.5px] cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Confirm Bounds ({drawArea.toLocaleString()} m²)
                </button>
                <button
                  id="btn_cancel_draw"
                  onClick={() => {
                    setDrawPoints([]);
                    setIsDrawingMode(false);
                    setOverlapWarning({ isOverlapping: false });
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-semibold transition text-[10.5px] cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : isRulerActive ? (
              <button
                id="btn_stop_ruler"
                onClick={() => {
                  setRulerPoints([]);
                  setIsRulerActive(false);
                }}
                className="px-2.5 py-1.5 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold transition flex items-center gap-1 text-[10.5px] cursor-pointer shadow-xs"
              >
                Clear Measuring Tape ({rulerPoints.length} nodes)
              </button>
            ) : isEditingVertices ? (
              <>
                <button
                  id="btn_save_vertex_edits"
                  onClick={handleSaveVertexEdits}
                  className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1 text-[10.5px] cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Apply Boundary Updates
                </button>
                <button
                  id="btn_cancel_vertex_edits"
                  onClick={() => {
                    setIsEditingVertices(false);
                    setLocalEditPoints([]);
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-semibold transition text-[10.5px] cursor-pointer"
                >
                  Discard
                </button>
              </>
            ) : (
              <>
                {selectedParcel && (
                  <button
                    id="btn_start_vertex_edit"
                    onClick={() => {
                      setIsEditingVertices(true);
                      setLocalEditPoints([...selectedParcel.polygon]);
                      setIsRulerActive(false);
                      setIsDrawingMode(false);
                    }}
                    className="px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold transition flex items-center gap-1 text-[10.5px] cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    Edit Selected Boundary
                  </button>
                )}
                
                <button
                  id="btn_start_draw"
                  onClick={() => {
                    setIsDrawingMode(true);
                    setIsRulerActive(false);
                    setIsEditingVertices(false);
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold transition flex items-center gap-1 text-[10.5px] cursor-pointer"
                >
                  <MapIcon className="w-3.5 h-3.5 text-blue-500" />
                  Draw Polygon Bounds
                </button>
                <button
                  id="btn_start_ruler"
                  onClick={() => {
                    setIsRulerActive(true);
                    setIsDrawingMode(false);
                    setIsEditingVertices(false);
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold transition flex items-center gap-1 text-[10.5px] cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5 text-pink-500" />
                  Ruler Tape
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GisMap;

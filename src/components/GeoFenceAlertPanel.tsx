import React, { useState, useEffect, useRef, memo } from "react";
import { GeoFenceEvent, SurveyAssignment } from "../types";
import {
  ShieldAlert, Bell, MapPin, Radio, Navigation,
  CheckCircle, Clock, AlertTriangle, Info, X,
  Filter, ChevronDown, ChevronUp
} from "lucide-react";

interface GeoFenceAlertPanelProps {
  events: GeoFenceEvent[];
  onAcknowledge: (eventId: string) => void;
  onClearAll: () => void;
  onSelectPosition?: (pos: [number, number]) => void;
  activeAssignment: SurveyAssignment | null;
}

const severityConfig = {
  critical: { icon: ShieldAlert, bg: "bg-rose-50 border-rose-200", dot: "bg-rose-500", text: "text-rose-800", label: "Critical" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500", text: "text-amber-800", label: "Warning" },
  info: { icon: Info, bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500", text: "text-blue-800", label: "Info" },
};

const GeoFenceAlertPanel = memo(function GeoFenceAlertPanel({
  events,
  onAcknowledge,
  onClearAll,
  onSelectPosition,
  activeAssignment,
}: GeoFenceAlertPanelProps) {
  const [filterSeverity, setFilterSeverity] = useState<"all" | "critical" | "warning" | "info">("all");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const unacked = events.filter(e => !e.acknowledged);
  useEffect(() => {
    setUnreadCount(unacked.length);
  }, [events]);

  const filtered = filterSeverity === "all"
    ? events
    : events.filter(e => e.severity === filterSeverity);

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const latestUnacked = unacked.slice(0, 3);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md hover:shadow-lg overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="relative">
              <Bell className="w-4 h-4 text-white/90 group-hover:text-white transition" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-400 text-white text-[7px] font-bold flex items-center justify-center animate-ping" />
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[7px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </>
              )}
            </div>
            <span className="text-xs font-extrabold text-white tracking-wide drop-shadow-sm">Geo-Fence Alerts</span>
            {activeAssignment && (
              <span className="text-[7px] font-mono text-emerald-100 bg-emerald-800/40 px-1.5 py-0.5 rounded-full border border-emerald-400/30">
                {activeAssignment.geofenceRadius}m zone
              </span>
            )}
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition" />
            )}
          </button>

          <div className="flex items-center gap-1.5">
            {events.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-2 py-0.5 text-[8px] font-bold text-white/70 hover:text-white uppercase tracking-widest cursor-pointer hover:bg-white/10 rounded transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-2.5 space-y-2.5">
          {/* Severity Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-400 shrink-0" />
            {(["all", "critical", "warning", "info"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest cursor-pointer transition-all border ${
                  filterSeverity === s
                    ? s === "critical" ? "bg-rose-50 text-rose-700 border-rose-200 shadow-sm"
                      : s === "warning" ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
                      : s === "info" ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                      : "bg-slate-100 text-slate-700 border-slate-200 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 border-transparent hover:border-slate-200"
                }`}
              >
                {s === "all" ? `All (${events.length})` : s}
              </button>
            ))}
          </div>

          {/* Unacked Banner */}
          {latestUnacked.length > 0 && (
            <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 p-3 rounded-xl space-y-2 shadow-sm">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-700 uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>{latestUnacked.length} Unacknowledged Alert{latestUnacked.length > 1 ? "s" : ""}</span>
              </div>
              {latestUnacked.map((ev) => {
                const cfg = severityConfig[ev.severity];
                const Icon = cfg.icon;
                return (
                  <div key={ev.id} className={`flex items-start gap-2.5 p-2 rounded-lg border-l-2 animate-fadeIn ${
                    ev.severity === "critical" ? "border-l-rose-500 bg-rose-50" : ev.severity === "warning" ? "border-l-amber-500 bg-amber-50" : "border-l-blue-500 bg-blue-50"
                  }`}>
                    <Icon className={`w-4 h-4 ${cfg.dot} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9px] font-semibold ${cfg.text} leading-relaxed`}>{ev.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[7.5px] font-mono text-slate-400">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        {ev.distance !== undefined && (
                          <span className="text-[7.5px] font-mono text-slate-400 bg-slate-100 px-1 rounded">{ev.distance}m away</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onAcknowledge(ev.id)}
                      className="shrink-0 p-1.5 rounded-lg bg-white/70 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition cursor-pointer shadow-sm"
                      title="Acknowledge"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeline */}
          <div ref={timelineRef} className="max-h-48 overflow-y-auto space-y-0.5">
            {sorted.length === 0 ? (
              <div className="text-center py-6 text-[10px] text-slate-400">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                  <MapPin className="w-4 h-4 text-slate-300" />
                </div>
                <span className="italic">No geo-fence events recorded</span>
              </div>
            ) : (
              sorted.map((ev) => {
                const cfg = severityConfig[ev.severity];
                const Icon = cfg.icon;
                const isUnacked = !ev.acknowledged;
                return (
                  <div
                    key={ev.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                      isUnacked
                        ? "bg-slate-50 hover:bg-slate-100 border border-slate-100"
                        : "opacity-60 hover:opacity-90 border border-transparent"
                    }`}
                    onClick={() => onSelectPosition?.(ev.position)}
                  >
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ring-2 ring-white ${isUnacked ? "animate-pulse" : ""}`} />
                      <div className="w-0.5 h-full bg-slate-200 mt-0.5 rounded-full" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isUnacked ? "bg-slate-100" : ""}`}>
                          <Icon className={`w-3 h-3 ${cfg.text}`} />
                        </div>
                        <span className={`text-[8.5px] font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                        {ev.type === "breach" && (
                          <span className="text-[7px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Breach</span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-600 leading-relaxed mt-0.5">{ev.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[7px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                          <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {ev.distance !== undefined && (
                          <span className="text-[7px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                            <Navigation className="w-2.5 h-2.5 inline mr-0.5" />
                            {ev.distance}m
                          </span>
                        )}
                        <span className="text-[7px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                          <MapPin className="w-2.5 h-2.5 inline mr-0.5" />
                          ({ev.position[0]}, {ev.position[1]})
                        </span>
                      </div>
                    </div>

                    {isUnacked && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAcknowledge(ev.id); }}
                        className="shrink-0 p-1 rounded hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition cursor-pointer"
                        title="Acknowledge"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {ev.acknowledged && (
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Active Survey Info */}
          {activeAssignment && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-2.5 rounded-xl flex items-center gap-2.5 text-[9px] text-slate-600">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              </div>
              <span>Monitoring geofence: <strong className="text-indigo-700">{activeAssignment.geofenceRadius}m</strong> radius around UPI <strong className="text-indigo-700 font-mono">{activeAssignment.upi}</strong> — <strong className="text-indigo-700">{activeAssignment.beaconsConfirmed}</strong> beacons placed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default GeoFenceAlertPanel;

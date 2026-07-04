import React, { memo } from "react";
import { Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  keys: { combo: string; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Map Layers",
    keys: [
      { combo: "1", label: "Street map view" },
      { combo: "2", label: "Satellite ortho view" },
      { combo: "3", label: "Topographic contours" },
    ],
  },
  {
    title: "Map Tools",
    keys: [
      { combo: "D", label: "Toggle drawing mode" },
      { combo: "R", label: "Toggle ruler measure" },
      { combo: "M", label: "Toggle 3D terrain view" },
      { combo: "L", label: "Toggle layer panel" },
    ],
  },
  {
    title: "Environment Layers",
    keys: [
      { combo: "W", label: "Toggle wetlands overlay" },
      { combo: "B", label: "Toggle road buffer overlay" },
      { combo: "G", label: "Toggle spatial grid" },
    ],
  },
  {
    title: "Application",
    keys: [
      { combo: "Space", label: "Analyze selected parcel" },
      { combo: "O", label: "Toggle offline mode" },
      { combo: "C", label: "Toggle collaboration hub" },
      { combo: "Esc", label: "Close panel / deselect parcel" },
      { combo: "? / H", label: "Show this help" },
    ],
  },
];

interface Props {
  onClose: () => void;
}

const KeyboardShortcutsHelp = memo(function KeyboardShortcutsHelp({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-bold text-xs uppercase tracking-wider">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.keys.map(({ combo, label }) => (
                  <div
                    key={combo}
                    className="flex items-center justify-between py-1 px-2 rounded bg-slate-50"
                  >
                    <span className="text-[10px] text-slate-600">{label}</span>
                    <kbd className="font-mono text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 min-w-[24px] text-center">
                      {combo}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-2 bg-slate-50">
          <p className="text-[8.5px] text-slate-400 text-center">
            Press <kbd className="font-mono font-bold bg-slate-200 text-slate-600 px-1 rounded border border-slate-300">?</kbd> or <kbd className="font-mono font-bold bg-slate-200 text-slate-600 px-1 rounded border border-slate-300">H</kbd> anytime to reopen
          </p>
        </div>
      </div>
    </div>
  );
});

export default KeyboardShortcutsHelp;

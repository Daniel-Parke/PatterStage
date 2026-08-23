"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown } from "lucide-react";

interface MissionTimeSelectorProps {
  value: number;
  onChange: (minutes: number) => void;
  compact?: boolean;
}

const PRESETS = [
  { minutes: 10, label: "Quick Pass", devHours: "2-3h" },
  { minutes: 15, label: "Half Day", devHours: "4h" },
  { minutes: 20, label: "Most of a Day", devHours: "5-6h" },
  { minutes: 30, label: "Full Day", devHours: "8h" },
  { minutes: 45, label: "Deep Dive", devHours: "12h" },
  { minutes: 60, label: "Sprint", devHours: "16h" },
];

export default function MissionTimeSelector({ value, onChange, compact = false }: MissionTimeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = PRESETS.find((p) => p.minutes === value) || PRESETS[1];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (compact) {
    return (
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-ps-text-secondary hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors relative"
        title={`Mission time: ${selected.label} (${selected.minutes}m ≈ ${selected.devHours} dev work)`}
      >
        <Clock className="w-3 h-3" />
        {selected.minutes}m
        {open && (
          <div ref={ref} className="absolute top-full left-0 mt-1 z-50 w-48 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={(e) => { e.stopPropagation(); onChange(p.minutes); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between ${value === p.minutes ? "text-neon-cyan" : "text-ps-text-secondary"}`}
              >
                <span>{p.label} ({p.minutes}m)</span>
                <span className="text-xs text-ps-text-muted">≈ {p.devHours}</span>
              </button>
            ))}
          </div>
        )}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neon-cyan" />
          <span className="font-medium">{selected.label}</span>
          <span className="text-xs text-ps-text-muted">({selected.minutes}m ≈ {selected.devHours} dev)</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              onClick={() => { onChange(p.minutes); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 flex items-center justify-between ${value === p.minutes ? "text-neon-cyan bg-neon-cyan/5" : "text-ps-text-secondary"}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${value === p.minutes ? "bg-neon-cyan" : "bg-white/20"}`} />
                <span>{p.label}</span>
                <span className="text-xs text-ps-text-muted">({p.minutes}m)</span>
              </div>
              <span className="text-xs text-ps-text-muted">≈ {p.devHours} dev work</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

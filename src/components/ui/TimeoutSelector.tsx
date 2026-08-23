"use client";

import { useState, useRef, useEffect } from "react";
import { Timer, ChevronDown } from "lucide-react";

interface TimeoutSelectorProps {
  value: number;
  onChange: (minutes: number) => void;
  compact?: boolean;
  /** When false, hides the fixed “Inactivity kill switch” subtitle (parent may label once). Default true. */
  showSubtitle?: boolean;
}

const PRESETS = [
  { minutes: 5, label: "5m" },
  { minutes: 10, label: "10m (recommended)" },
  { minutes: 15, label: "15m" },
  { minutes: 20, label: "20m" },
  { minutes: 30, label: "30m" },
  { minutes: 60, label: "60m" },
  { minutes: 0, label: "∞ (unlimited)" },
];

export default function TimeoutSelector({
  value,
  onChange,
  compact = false,
  showSubtitle = true,
}: TimeoutSelectorProps) {
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
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-ps-text-muted hover:border-white/30 hover:text-ps-text-secondary transition-colors relative"
        title={`Inactivity timeout: ${value === 0 ? "unlimited" : value + "m"}`}
      >
        <Timer className="w-3 h-3" />
        {value === 0 ? "∞" : `${value}m`}
        {open && (
          <div ref={ref} className="absolute top-full left-0 mt-1 z-50 w-44 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={(e) => { e.stopPropagation(); onChange(p.minutes); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${value === p.minutes ? "text-neon-cyan" : "text-ps-text-secondary"}`}
              >
                {p.label}
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
          <Timer className="w-4 h-4 text-ps-text-muted" />
          <div className="text-left">
            <div className="font-medium text-sm">{selected.label}</div>
            {showSubtitle && (
              <div className="text-xs text-ps-text-muted">Inactivity kill switch</div>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              onClick={() => { onChange(p.minutes); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${value === p.minutes ? "text-neon-cyan bg-neon-cyan/5" : "text-ps-text-secondary"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

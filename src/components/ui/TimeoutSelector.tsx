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

  // The trigger and the menu are SIBLINGS inside a positioned wrapper — which is
  // the shape the non-compact branch below already uses. This branch rendered the
  // menu INSIDE the trigger button, so every option was a button inside a button:
  // invalid HTML that the browser recovers from by hoisting the options out,
  // moving their click target and focus order somewhere the source does not show
  // (T-0071). The ref moves to the wrapper so the outside-click handler still
  // counts the trigger as inside.
  if (compact) {
    return (
      <span ref={ref} className="relative inline-flex">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-ps-sm bg-ps-surface-raised border border-ps-edge text-micro font-mono text-ps-text-muted hover:border-ps-edge-emphasis hover:text-ps-text-secondary transition-colors"
          title={`Inactivity timeout: ${value === 0 ? "unlimited" : value + "m"}`}
        >
          <Timer className="w-3 h-3" />
          {value === 0 ? "∞" : `${value}m`}
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 w-44 bg-ps-surface-panel border border-ps-edge-hairline rounded-ps-md shadow-xl overflow-hidden">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={(e) => { e.stopPropagation(); onChange(p.minutes); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-body hover:bg-ps-surface-raised ${value === p.minutes ? "text-neon-cyan" : "text-ps-text-secondary"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-ps-md bg-ps-surface-raised border border-ps-edge text-body text-ps-text-primary hover:border-ps-edge-emphasis transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-ps-text-muted" />
          <div className="text-left">
            <div className="font-medium text-body">{selected.label}</div>
            {showSubtitle && (
              <div className="text-body text-ps-text-muted">Inactivity kill switch</div>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-ps-surface-panel border border-ps-edge-hairline rounded-ps-md shadow-xl overflow-hidden">
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              onClick={() => { onChange(p.minutes); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-body hover:bg-ps-surface-raised ${value === p.minutes ? "text-neon-cyan bg-neon-cyan/5" : "text-ps-text-secondary"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

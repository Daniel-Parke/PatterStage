"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, ChevronDown } from "lucide-react";

interface IntervalSelectorProps {
  value: string;
  onChange: (interval: string) => void;
  compact?: boolean;
}

// Presets used when the user selects a value via the dropdown.
// These use the "every N" format that the cron API expects.
const PRESETS = [
  { value: "every 1m",  label: "1 minute"  },
  { value: "every 5m",  label: "5 minutes" },
  { value: "every 10m", label: "10 minutes"},
  { value: "every 15m", label: "15 minutes"},
  { value: "every 30m", label: "30 minutes"},
  { value: "every 1h",  label: "1 hour"    },
  { value: "every 2h",  label: "2 hours"   },
  { value: "every 3h",  label: "3 hours"   },
  { value: "every 4h",  label: "4 hours"   },
  { value: "every 8h",  label: "8 hours"   },
  { value: "every 12h", label: "12 hours"  },
  { value: "every 1d",  label: "1 day"     },
  { value: "every 3d",  label: "3 days"    },
  { value: "every 7d",  label: "7 days"    },
];

// Parse a cron expression and return a human-readable label.
// Handles all common patterns: */N, 0 */N, daily, weekly, etc.
// Returns null if the expression doesn't match any known pattern.
function parseCronExpression(expr: string): string | null {
  if (!expr) return null;
  const trimmed = expr.trim();

  // Handle "every N" format (used by the cron API)
  // e.g. "every 5m", "every 60m", "every 1h", "every 12h", "every 7d"
  const everyMatch = trimmed.match(/^every\s+(\d+)([mhd])$/i);
  if (everyMatch) {
    const num = parseInt(everyMatch[1]);
    const unit = everyMatch[2].toLowerCase();
    if (unit === "m") {
      if (num >= 60) {
        const h = Math.floor(num / 60);
        const m = num % 60;
        if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
        return `${h}h ${m}m`;
      }
      return num === 1 ? "1 minute" : `${num} minutes`;
    }
    if (unit === "h") return num === 1 ? "1 hour" : `${num} hours`;
    if (unit === "d") return num === 1 ? "1 day" : `${num} days`;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) return null;
  const [min, hour, dom, mon, dow] = parts;

  // Every N minutes: */N * * * *
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${min.slice(2)}m`;
  }

  // Every N hours: 0 */N * * *
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${hour.slice(2)}h`;
  }

  // Every hour at MM past: MM * * * *
  if (min !== "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const m = parseInt(min);
    if (Number.isFinite(m) && m >= 0 && m <= 59) {
      return `Hourly :${String(m).padStart(2, "0")}`;
    }
  }

  // Every minute: * * * * *
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return "Every minute";
  }

  // Daily at HH:MM: 0 HH * * *
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Daily ${displayHour}:${displayMin}${period}`;
    }
  }

  // Weekly on specific day: 0 HH * * D
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayIndex = parseInt(dow);
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(dayIndex) && dayIndex >= 0 && dayIndex <= 6 && Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `${days[dayIndex]}s ${displayHour}:${displayMin}${period}`;
    }
  }

  // Monthly: 0 HH DD * *
  if (min !== "*" && hour !== "*" && dom !== "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    const d = parseInt(dom);
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(d)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Day ${d} ${displayHour}:${displayMin}${period}`;
    }
  }

  // Weekdays (1-5): 0 HH * * 1-5
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && /^[1-5](,[1-5])*$/.test(dow)) {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Weekdays ${displayHour}:${displayMin}${period}`;
    }
  }

  return null;
}

// Dropdown menu rendered as a portal so it escapes any parent overflow: hidden
function DropdownMenu({
  anchorRef,
  presets,
  activePresetValue,
  onSelect,
  onClose,
  width = 160,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  presets: typeof PRESETS;
  activePresetValue: string | undefined;
  onSelect: (v: string) => void;
  onClose: () => void;
  width?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the menu above or below the anchor, staying within viewport
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuH = presets.length * 36 + 16; // approx height
    const spaceBelow = window.innerHeight - rect.bottom;

    // Prefer below — only show above when there truly isn't room beneath
    const top = spaceBelow >= menuH
      ? rect.bottom + 4        // show below
      : rect.top - menuH - 4; // show above

    setPos({ top, left: rect.left });
  }, [anchorRef, presets.length]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  if (typeof document === "undefined" || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
      style={{ top: pos.top, left: pos.left, width }}
    >
      <div className="max-h-72 overflow-y-auto py-1">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => { onSelect(p.value); onClose(); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              activePresetValue === p.value
                ? "text-neon-cyan bg-neon-cyan/5"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            Every {p.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

export default function IntervalSelector({ value, onChange, compact = false }: IntervalSelectorProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => setOpen(false), []);

  // Parse value for display
  const displayLabel = (() => {
    const stripped = value.replace(/^every\s+/i, "");
    const preset = PRESETS.find((p) => p.value === stripped || p.value === value);
    if (preset) return preset.label;
    const cronLabel = parseCronExpression(value);
    if (cronLabel) return cronLabel;
    return stripped || value;
  })();

  const stripped = value.replace(/^every\s+/i, "");
  const activePresetValue = PRESETS.find(
    (p) => p.value === value || p.value === stripped || stripped === p.value
  )?.value;

  if (compact) {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60 hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors"
          title={`Interval: ${displayLabel}`}
        >
          <RefreshCw className="w-3 h-3" />
          {displayLabel}
        </button>
        {open && (
          <DropdownMenu
            anchorRef={buttonRef}
            presets={PRESETS}
            activePresetValue={activePresetValue}
            onSelect={(v) => onChange(v)}
            onClose={handleClose}
            width={160}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-neon-cyan" />
          <div className="text-left">
            <div className="font-medium text-sm">Every {displayLabel}</div>
            <div className="text-[10px] text-white/30">Repeat frequency</div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <DropdownMenu
          anchorRef={buttonRef}
          presets={PRESETS}
          activePresetValue={activePresetValue}
          onSelect={(v) => onChange(v)}
          onClose={handleClose}
          width={220}
        />
      )}
    </>
  );
}

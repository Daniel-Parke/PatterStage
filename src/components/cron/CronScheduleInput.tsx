// ═══════════════════════════════════════════════════════════════
// CronScheduleInput — Dual-mode schedule input
//
// Provides both a friendly dropdown (5m, 10m, 15m, 1h, etc.)
// and a raw cron expression text field. Both stay in sync:
//   - Selecting a preset → updates the text field
//   - Editing the text field → attempts to match a preset,
//     falls back to "custom" with a parsed human label
//
// Usage:
//   <CronScheduleInput value={schedule} onChange={setSchedule} />
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, Clock, AlertCircle } from "lucide-react";
import { baseInputStyles } from "@/lib/theme";
import { describeSchedule } from "@/lib/schedule/types";

export interface PresetOption {
  label: string;       // Display label shown in dropdown  e.g. "Every 5 minutes"
  shortLabel: string;  // Short label for compact display   e.g. "5m"
  value: string;      // Cron expression                     e.g. "*/5 * * * *"
}

// Preset intervals — ordered by frequency
export const CRON_PRESETS: PresetOption[] = [
  { label: "Every 5 minutes",  shortLabel: "5m",  value: "*/5 * * * *"  },
  { label: "Every 10 minutes", shortLabel: "10m", value: "*/10 * * * *" },
  { label: "Every 15 minutes", shortLabel: "15m", value: "*/15 * * * *" },
  { label: "Every 30 minutes", shortLabel: "30m", value: "*/30 * * * *" },
  { label: "Every 1 hour",     shortLabel: "1h",  value: "0 * * * *"    },
  { label: "Every 2 hours",   shortLabel: "2h",  value: "0 */2 * * *"  },
  { label: "Every 3 hours",   shortLabel: "3h",  value: "0 */3 * * *"  },
  { label: "Every 4 hours",   shortLabel: "4h",  value: "0 */4 * * *"  },
  { label: "Every 6 hours",   shortLabel: "6h",  value: "0 */6 * * *"  },
  { label: "Every 12 hours",  shortLabel: "12h", value: "0 */12 * * *" },
  { label: "Daily at midnight",shortLabel: "1d",  value: "0 0 * * *"    },
  { label: "Daily at 9am",    shortLabel: "9am", value: "0 9 * * *"    },
];

// Reverse-lookup: cron expression → preset index (-1 = custom)
export function matchPreset(cron: string): number {
  return CRON_PRESETS.findIndex((p) => p.value === cron);
}

// describeSchedule is imported from @/lib/schedule/types and re-exported below

interface CronScheduleInputProps {
  value: string;
  onChange: (cron: string) => void;
  error?: string | null;
}

export default function CronScheduleInput({ value, onChange, error }: CronScheduleInputProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [textValue, setTextValue] = useState(value);
  const [matchedPreset, setMatchedPreset] = useState<number>(-1); // -1 = not matched yet
  const [customLabel, setCustomLabel] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync: when external value changes (e.g. from props), update internal state
  useEffect(() => {
    setTextValue(value);
    const idx = matchPreset(value);
    setMatchedPreset(idx);
    if (idx === -1) {
      setCustomLabel(describeSchedule(value));
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePresetSelect = useCallback((preset: PresetOption) => {
    onChange(preset.value);
    setTextValue(preset.value);
    setMatchedPreset(matchPreset(preset.value));
    setCustomLabel("");
    setDropdownOpen(false);
  }, [onChange]);

  const handleTextChange = useCallback((raw: string) => {
    setTextValue(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setMatchedPreset(-1);
      setCustomLabel("");
      return;
    }
    const idx = matchPreset(trimmed);
    if (idx >= 0) {
      setMatchedPreset(idx);
      setCustomLabel("");
    } else {
      setMatchedPreset(-1);
      setCustomLabel(describeSchedule(trimmed));
    }
    onChange(trimmed);
  }, [onChange]);

  // Determine display label for the dropdown button
  const currentPresetIdx = matchedPreset >= 0 ? matchedPreset : -1;
  const buttonLabel = currentPresetIdx >= 0
    ? CRON_PRESETS[currentPresetIdx].label
    : matchedPreset === -1
      ? customLabel || "Custom"
      : value
        ? describeSchedule(value)
        : "Select a frequency";

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-white/70">
        Cron Schedule
      </label>

      {/* Preset dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className={`w-full flex items-center justify-between ${baseInputStyles} pr-3`}
        >
          <span className={`flex items-center gap-2 ${matchedPreset < 0 && value ? "text-white/50 font-mono text-xs" : "text-white"}`}>
            <Clock className="w-3.5 h-3.5 text-neon-orange/60 flex-shrink-0" />
            {buttonLabel}
          </span>
          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-dark-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-1">
              {CRON_PRESETS.map((preset, idx) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    currentPresetIdx === idx
                      ? "bg-neon-orange/15 text-neon-orange"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className="text-xs font-mono text-white/30">{preset.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Raw cron expression input */}
      <input
        type="text"
        value={textValue}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="e.g. */5 * * * *"
        className={baseInputStyles}
        spellCheck={false}
      />

      {/* Helper text + parsed description */}
      <div className="flex items-start gap-1.5">
        <p className="text-xs text-white/30 font-mono flex-1">
          min hour day month weekday — e.g.&nbsp;
          <button
            type="button"
            className="text-neon-orange/60 hover:text-neon-orange underline"
            onClick={() => handlePresetSelect(CRON_PRESETS[0])}
          >
            */5 * * * *
          </button>
          &nbsp;for every 5 min
        </p>
        {matchedPreset === -1 && customLabel && (
          <span className="text-xs text-white/40 font-mono whitespace-nowrap flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-neon-orange/50" />
            {customLabel}
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

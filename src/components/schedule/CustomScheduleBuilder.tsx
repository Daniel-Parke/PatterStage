"use client";

// ═══════════════════════════════════════════════════════════════
// CustomScheduleBuilder — the SchedulePicker's "Custom…" panel:
// frequency + time-of-day + day-of-week chips with a live cron preview.
// Render-preserving extraction from SchedulePicker.tsx. `customTime` and
// `customDays` are owned by the parent (it reads them on Apply and seeds
// them from an unrecognised cron); the `customFrequency` select is purely
// local UI, so its state lives here.
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import { X } from "lucide-react";
import { baseInputStyles } from "@/lib/theme";
import { allDays, DOW_LABELS, type DayOfWeek } from "@/lib/schedule/presets";
import { previewCron } from "@/lib/schedule/picker-resolver";

export interface CustomScheduleBuilderProps {
  customTime: string;
  setCustomTime: (time: string) => void;
  customDays: Set<DayOfWeek>;
  setCustomDays: (days: Set<DayOfWeek>) => void;
  toggleDay: (d: DayOfWeek) => void;
  disabled: boolean;
  onApply: () => void;
  onClose: () => void;
}

export function CustomScheduleBuilder({
  customTime,
  setCustomTime,
  customDays,
  setCustomDays,
  toggleDay,
  disabled,
  onApply,
  onClose,
}: CustomScheduleBuilderProps) {
  const [customFrequency, setCustomFrequency] = useState<string>("60");

  return (
    <div className="rounded-lg border border-white/10 bg-dark-800/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ps-text-secondary">Custom schedule</span>
        <button
          type="button"
          onClick={onClose}
          className="text-ps-text-muted hover:text-ps-text-secondary"
          aria-label="Close custom builder"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ps-text-muted font-mono block mb-1">
            Frequency
          </label>
          <select
            value={customFrequency}
            onChange={(e) => setCustomFrequency(e.target.value)}
            disabled={disabled}
            className={baseInputStyles}
          >
            <option value="1">Every 1 minute</option>
            <option value="5">Every 5 minutes</option>
            <option value="10">Every 10 minutes</option>
            <option value="15">Every 15 minutes</option>
            <option value="20">Every 20 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="60">Every 1 hour</option>
            <option value="120">Every 2 hours</option>
            <option value="180">Every 3 hours</option>
            <option value="360">Every 6 hours</option>
            <option value="720">Every 12 hours</option>
            <option value="1440">Every 1 day</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ps-text-muted font-mono block mb-1">
            Time of day
          </label>
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            disabled={disabled}
            className={baseInputStyles}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
          Days of week
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {DOW_LABELS.map((label, idx) => {
            const d = idx as DayOfWeek;
            const checked = customDays.has(d);
            return (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => toggleDay(d)}
                aria-pressed={checked}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                  checked
                    ? "bg-neon-orange/20 text-neon-orange border border-neon-orange/40"
                    : "bg-white/5 text-ps-text-muted border border-white/10 hover:text-ps-text-secondary"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setCustomDays(allDays())}
            disabled={disabled}
            className="text-xs text-ps-text-muted hover:text-ps-text-secondary font-mono"
          >
            All days
          </button>
          <button
            type="button"
            onClick={() => setCustomDays(new Set([1, 2, 3, 4, 5]))}
            disabled={disabled}
            className="text-xs text-ps-text-muted hover:text-ps-text-secondary font-mono"
          >
            Weekdays
          </button>
          <button
            type="button"
            onClick={() => setCustomDays(new Set())}
            disabled={disabled}
            className="text-xs text-ps-text-muted hover:text-ps-text-secondary font-mono"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-xs text-ps-text-muted font-mono">
          Preview: <code className="text-neon-orange">{previewCron(customTime, customDays)}</code>
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          className="px-3 py-1.5 rounded-md bg-neon-orange/20 text-neon-orange border border-neon-orange/40 text-xs font-mono hover:bg-neon-orange/30 disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

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
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/field";
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

const FREQUENCY_OPTIONS = [
  { value: "1", label: "Every 1 minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "10", label: "Every 10 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "20", label: "Every 20 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every 1 hour" },
  { value: "120", label: "Every 2 hours" },
  { value: "180", label: "Every 3 hours" },
  { value: "360", label: "Every 6 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 1 day" },
];

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
    <Card variant="raised" padding="sm" className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-body font-medium text-ps-text-secondary">Custom schedule</span>
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
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
            Frequency
          </label>
          <Select
            ariaLabel="Frequency"
            value={customFrequency}
            onChange={setCustomFrequency}
            disabled={disabled}
            options={FREQUENCY_OPTIONS}
          />
        </div>
        <div>
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
            Time of day
          </label>
          <Input
            aria-label="Time of day"
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            disabled={disabled}
            className="font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-micro text-ps-text-muted font-mono block mb-1.5">
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
                className={`px-2.5 py-1 rounded-ps-md text-micro font-mono transition-colors ${
                  checked
                    ? "bg-neon-orange/20 text-neon-orange border border-neon-orange/40"
                    : "bg-ps-surface-raised text-ps-text-muted border border-ps-edge hover:text-ps-text-secondary"
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
            className="text-micro text-ps-text-muted hover:text-ps-text-secondary font-mono"
          >
            All days
          </button>
          <button
            type="button"
            onClick={() => setCustomDays(new Set([1, 2, 3, 4, 5]))}
            disabled={disabled}
            className="text-micro text-ps-text-muted hover:text-ps-text-secondary font-mono"
          >
            Weekdays
          </button>
          <button
            type="button"
            onClick={() => setCustomDays(new Set())}
            disabled={disabled}
            className="text-micro text-ps-text-muted hover:text-ps-text-secondary font-mono"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-micro text-ps-text-muted font-mono">
          Preview: <code className="text-neon-orange">{previewCron(customTime, customDays)}</code>
        </div>
        <Button variant="primary" color="orange" size="sm" onClick={onApply} disabled={disabled}>
          Apply
        </Button>
      </div>
    </Card>
  );
}

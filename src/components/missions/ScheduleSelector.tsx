// ═══════════════════════════════════════════════════════════════
// ScheduleSelector — Enhanced scheduling UI with three modes:
//   Interval:   every N minutes/hours (current behavior)
//   Wall Clock: at a specific time, repeat every N
//   Post-run:   N after previous mission finishes
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, ChevronDown, Clock, Timer } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { INTERVAL_PRESETS } from "@/components/cron/CronScheduleInput";
import { describeSchedule } from "@/lib/schedule/types";

export type ScheduleMode = "interval" | "wall-clock" | "post-run";

interface ScheduleSelectorProps {
  /** Current schedule string */
  value: string;
  onChange: (interval: string) => void;
  /** Current schedule mode */
  mode: ScheduleMode;
  onModeChange: (mode: ScheduleMode) => void;
  /** Wall clock start time (HH:MM) — only relevant in wall-clock mode */
  startTime?: string;
  onStartTimeChange?: (time: string) => void;
  /** Compact variant for inline display */
  compact?: boolean;
}

// Interval presets for "every N" format

// ── Mode tab config ──────────────────────────────────────────

interface ModeTabProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function ModeTab({ label, icon, active, onClick }: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
        active
          ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30"
          : "text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────

export default function ScheduleSelector({
  value,
  onChange,
  mode,
  onModeChange,
  startTime,
  onStartTimeChange,
  compact = false,
}: ScheduleSelectorProps) {
  // Track which mode's dropdown is open — resets automatically when mode changes
  const [activeDropdown, setActiveDropdown] = useState<ScheduleMode | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setActiveDropdown(null), []);

  const isOpen = activeDropdown === mode;

  // Close dropdown when mode changes (prevents stale buttonRef targeting)
  useEffect(() => {
    setActiveDropdown(null);
  }, [mode]);

  // Parse value for display
  const displayLabel = (() => {
    const stripped = value.replace(/^every\s+/i, "");
    const preset = INTERVAL_PRESETS.find((p) => p.value === stripped || p.value === value);
    if (preset) return preset.label;
    const cronLabel = describeSchedule(value);
    if (cronLabel && cronLabel !== "No schedule") return cronLabel;
    return stripped || value;
  })();

  const stripped = value.replace(/^every\s+/i, "");
  const activePresetValue = INTERVAL_PRESETS.find(
    (p) => p.value === value || p.value === stripped || stripped === p.value
  )?.value;

  if (compact) {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => setActiveDropdown((prev) => prev === mode ? null : mode)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60 hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors"
          title={`Interval: ${displayLabel}`}
        >
          <RefreshCw className="w-3 h-3" />
          {displayLabel}
        </button>
        {isOpen && (
          <DropdownMenu
            anchorRef={buttonRef}
            presets={INTERVAL_PRESETS}
            activePresetValue={activePresetValue}
            onSelect={(v) => onChange(v)}
            onClose={handleClose}
            width={160}
          />
        )}
      </>
    );
  }

  // Build wall-clock cron expression from start time + interval
  const buildWallClockSchedule = (time: string, _interval: string) => {
    // Parse HH:MM or default to 00:00
    const parts = time.split(":");
    const hh = parts[0]?.padStart(2, "0") || "00";
    const mm = parts[1]?.padStart(2, "0") || "00";
    return `${mm} ${hh} * * *`;  // daily at specified time; can make more specific with day-of-week
  };

  const handleIntervalChange = (newVal: string) => {
    if (mode === "wall-clock") {
      // Build cron expression from startTime + interval
      const cronExpr = buildWallClockSchedule(startTime || "00:00", newVal);
      onChange(cronExpr);
    } else {
      onChange(newVal);
    }
  };

  return (
    <div className="space-y-2">
      {/* Top row: mode tabs + compact interval selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <ModeTab
            label="Interval"
            icon={<RefreshCw className="w-3 h-3" />}
            active={mode === "interval"}
            onClick={() => onModeChange("interval")}
          />
          <ModeTab
            label="Wall Clock"
            icon={<Clock className="w-3 h-3" />}
            active={mode === "wall-clock"}
            onClick={() => onModeChange("wall-clock")}
          />
          <ModeTab
            label="Post-run"
            icon={<Timer className="w-3 h-3" />}
            active={mode === "post-run"}
            onClick={() => onModeChange("post-run")}
          />
        </div>

        {/* Interval / Post-run: compact selector beside mode tabs */}
        {(mode === "interval" || mode === "post-run") && (
          <div className="flex-1 min-w-0">
            <button
              ref={buttonRef}
              onClick={() => setActiveDropdown((prev) => prev === mode ? null : mode)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                {mode === "post-run" ? (
                  <Timer className="w-4 h-4 shrink-0 text-neon-purple" />
                ) : (
                  <RefreshCw className="w-4 h-4 shrink-0 text-neon-cyan" />
                )}
                <span>Every {displayLabel}</span>
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-white/30 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <DropdownMenu
                anchorRef={buttonRef}
                presets={INTERVAL_PRESETS}
                activePresetValue={activePresetValue}
                onSelect={(v) => { onChange(v); setActiveDropdown(null); }}
                onClose={handleClose}
                width={220}
              />
            )}
          </div>
        )}
      </div>

      {/* Wall Clock mode: start time + repeat every (below the top row) */}
      {mode === "wall-clock" && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-white/40 font-mono block mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime || "00:00"}
              onChange={(e) => {
                if (onStartTimeChange) onStartTimeChange(e.target.value);
                const cronExpr = buildWallClockSchedule(e.target.value, value);
                onChange(cronExpr);
              }}
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50 font-mono"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-white/40 font-mono block mb-1">
              Repeat Every
            </label>
            <button
              ref={buttonRef}
              onClick={() => setActiveDropdown((prev) => prev === mode ? null : mode)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
            >
              <span>Every {displayLabel}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <DropdownMenu
                anchorRef={buttonRef}
                presets={INTERVAL_PRESETS}
                activePresetValue={activePresetValue}
                onSelect={(v) => handleIntervalChange(v)}
                onClose={handleClose}
                width={220}
              />
            )}
          </div>
        </div>
      )}

      {/* Description text */}
      <p className="text-[10px] text-white/25 font-mono">
        {mode === "interval" && "Runs on a fixed time interval from when the job starts."}
        {mode === "wall-clock" && "Runs daily at the specified start time with the given repeat interval."}
        {mode === "post-run" && "Waits for the mission to finish, then schedules the next run after the specified delay."}
      </p>
    </div>
  );
}

"use client";

// ═══════════════════════════════════════════════════════════════
// SchedulePicker — canonical schedule input for both the cron page
// and the missions page. Emits a 5-field cron expression; accepts
// 5-field cron, "every Nh" shorthand, and JSON-serialised
// ParsedSchedule on load (for backwards compat with existing jobs).
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Clock, AlertCircle, Calendar, X } from "lucide-react";
import { baseInputStyles } from "@/lib/theme";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { describeSchedule } from "@/lib/schedule/types";
import {
  SCHEDULE_PRESETS,
  findPresetByValue,
  buildWeeklyCron,
  parseDayOfWeek,
  allDays,
  DOW_LABELS,
  type DayOfWeek,
  type SchedulePreset,
  type SchedulePresetGroup,
} from "@/lib/schedule/presets";

export type ScheduleMode = "interval" | "wall-clock" | "weekly" | "post-run";

export interface SchedulePickerProps {
  /** Current schedule value — accepts 5-field cron, "every Nh" shorthand, or JSON-serialised ParsedSchedule. */
  value: string;
  /** Called whenever the user changes the schedule. Always emits a 5-field cron expression. */
  onChange: (cron: string) => void;
  /** Optional id for form-field association. */
  id?: string;
  /** Disables the picker. */
  disabled?: boolean;
  /** Optional error message displayed below. */
  error?: string | null;
  /** Compact mode — render only the preset dropdown, no custom builder. */
  compact?: boolean;
  /** Optional mode hint (kept for legacy callers; affects display ordering only). */
  mode?: ScheduleMode;
}

const GROUP_ORDER: SchedulePresetGroup[] = ["Interval", "Daily", "Weekly", "Monthly"];

/**
 * Resolve a raw value (any supported format) to a canonical 5-field cron expression.
 * Returns null if the value doesn't parse to something usable.
 */
function resolveToCron(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Plain 5-field cron
  if (trimmed.split(/\s+/).length >= 5) return trimmed;

  // 2. JSON-serialised ParsedSchedule (what the DB stores)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { kind?: string; expr?: string; display?: string };
      if (parsed.kind === "cron" && typeof parsed.expr === "string") {
        return parsed.expr;
      }
      if (parsed.kind === "interval" && typeof parsed.display === "string") {
        // Re-parse the display field (e.g. "every 2h")
        const re = parseSchedule(parsed.display);
        if (re.kind === "cron" && "expr" in re) return re.expr;
        if (re.kind === "interval") {
          // Convert minutes to a cron expression: pick a sensible hour interval
          const m = re.minutes;
          if (m % 60 === 0) return `0 */${m / 60} * * *`;
          if (m % (24 * 60) === 0) return `0 0 */${m / (24 * 60)} * *`;
          if (60 % m === 0) return `*/${m} * * * *`;
        }
      }
    } catch {
      // fall through
    }
  }

  // 3. "every Nh/Nm/Nd" shorthand
  const parsed = parseSchedule(trimmed);
  if (parsed.kind === "interval") {
    const m = parsed.minutes;
    if (m % 60 === 0) return `0 */${m / 60} * * *`;
    if (m % (24 * 60) === 0) return `0 0 */${m / (24 * 60)} * *`;
    if (60 % m === 0) return `*/${m} * * * *`;
  }
  if (parsed.kind === "cron" && "expr" in parsed) {
    return parsed.expr;
  }

  return null;
}

// ── Grouped preset list (used for rendering) ─────────────────

function useGroupedPresets() {
  return useMemo(() => {
    const groups: Record<SchedulePresetGroup, SchedulePreset[]> = {
      Interval: [],
      Daily: [],
      Weekly: [],
      Monthly: [],
    };
    for (const p of SCHEDULE_PRESETS) groups[p.group].push(p);
    return GROUP_ORDER.map((g) => ({ group: g, items: groups[g] }));
  }, []);
}

// ── Main component ───────────────────────────────────────────

export default function SchedulePicker({
  value,
  onChange,
  id,
  disabled = false,
  error = null,
  compact = false,
  mode: _mode,
}: SchedulePickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve the current value to canonical 5-field cron
  const canonicalCron = useMemo(() => resolveToCron(value), [value]);
  const matchedPreset = useMemo(
    () => (canonicalCron ? findPresetByValue(canonicalCron) : null),
    [canonicalCron],
  );

  // Advanced (raw cron) input: local controlled state. The previous
  // implementation used `defaultValue` + a `key` that reset on every
  // parent update, which made free-form typing impossible — every
  // keystroke called `onChange`, which updated the parent `value`,
  // which changed the `key`, which remounted the input mid-word.
  //
  // The fix: hold the in-progress edit in local state, only sync to
  // the parent when the user blurs the field or presses Enter. That
  // way the parent only sees a complete cron expression.
  const [advancedDraft, setAdvancedDraft] = useState<string>(
    canonicalCron ?? value,
  );
  // Re-seed the draft whenever the parent's `value` changes from a
  // non-advanced source (preset select, custom builder apply, external
  // API edit). Without this, switching back to advanced would show a
  // stale draft from the previous edit session.
  const lastSeededValueRef = useRef<string>(value);
  useEffect(() => {
    if (value !== lastSeededValueRef.current) {
      lastSeededValueRef.current = value;
      setAdvancedDraft(canonicalCron ?? value);
    }
  }, [value, canonicalCron]);

  // Custom builder state
  const [customTime, setCustomTime] = useState<string>("09:00");
  const [customDays, setCustomDays] = useState<Set<DayOfWeek>>(() => allDays());
  const [customFrequency, setCustomFrequency] = useState<string>("60");

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // When the picker is asked to display a value that doesn't match a preset,
  // auto-open the custom builder so the user can see/edit the advanced settings.
  useEffect(() => {
    if (compact) return;
    if (canonicalCron && !matchedPreset) {
      // Try to seed the custom builder from the cron expression
      const parts = canonicalCron.split(/\s+/);
      if (parts.length >= 5) {
        const [min, hour, , , dow] = parts;
        const mm = parseInt(min, 10);
        const hh = parseInt(hour, 10);
        if (Number.isFinite(mm) && Number.isFinite(hh)) {
          setCustomTime(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
        }
        if (dow !== "*") {
          const parsed = parseDayOfWeek(dow);
          if (parsed) setCustomDays(parsed);
        }
      }
    }
  }, [canonicalCron, matchedPreset, compact]);

  const groups = useGroupedPresets();

  const handlePresetSelect = useCallback(
    (preset: SchedulePreset) => {
      onChange(preset.value);
      setDropdownOpen(false);
      setShowCustom(false);
    },
    [onChange],
  );

  const handleCustomApply = useCallback(() => {
    const [hhStr, mmStr] = customTime.split(":");
    const hh = parseInt(hhStr ?? "0", 10);
    const mm = parseInt(mmStr ?? "0", 10);
    const cron = buildWeeklyCron(customDays, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    onChange(cron);
    setShowCustom(false);
  }, [customTime, customDays, onChange]);

  // `handleAdvancedChange` was removed: the advanced input now manages
  // its own draft state and commits via onBlur (see the controlled
  // input block below). The old per-keystroke `onChange` handler was
  // the source of the input-reset bug.

  // Commit the current advanced draft to the parent. Called on blur
  // and on Enter. Validates with `parseSchedule`; reverts to the
  // previous canonical value on empty / invalid input so the parent
  // never sees garbage.
  const commitAdvancedDraft = useCallback(() => {
    const trimmed = advancedDraft.trim();
    if (!trimmed) {
      setAdvancedDraft(canonicalCron ?? value);
      return;
    }
    const parsed = parseSchedule(trimmed);
    if (parsed.kind === "invalid") {
      setAdvancedDraft(canonicalCron ?? value);
      return;
    }
    const emitted =
      parsed.kind === "cron" && "expr" in parsed ? parsed.expr : trimmed;
    if (emitted !== value) {
      onChange(emitted);
    }
    setAdvancedDraft(emitted);
  }, [advancedDraft, canonicalCron, value, onChange]);

  const toggleDay = useCallback((d: DayOfWeek) => {
    setCustomDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }, []);

  // ── Rendering ──────────────────────────────────────────────

  const displayLabel = (() => {
    if (matchedPreset) return matchedPreset.label;
    if (canonicalCron) return describeSchedule(canonicalCron) || canonicalCron;
    return value || "Select a frequency";
  })();

  // Compact mode: just the preset dropdown (for IntervalSelector use case)
  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setDropdownOpen((o) => !o)}
          className={`w-full flex items-center justify-between ${baseInputStyles} pr-3 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-neon-orange/60 flex-shrink-0" />
            {displayLabel}
          </span>
          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto py-1">
              {groups.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/30 font-mono">
                    {group}
                  </div>
                  {items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetSelect(p)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        matchedPreset?.id === p.id
                          ? "bg-neon-orange/15 text-neon-orange"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-white/70">
        Schedule
      </label>

      {/* Preset dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setDropdownOpen((o) => !o)}
          className={`w-full flex items-center justify-between ${baseInputStyles} pr-3 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-neon-orange/60 flex-shrink-0" />
            {displayLabel}
          </span>
          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto py-1">
              {groups.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/30 font-mono sticky top-0 bg-dark-900">
                    {group}
                  </div>
                  {items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetSelect(p)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        matchedPreset?.id === p.id
                          ? "bg-neon-orange/15 text-neon-orange"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ))}
              {/* Custom option at the bottom */}
              <div className="border-t border-white/5 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCustom((v) => !v); setDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-neon-cyan hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Custom…
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom builder */}
      {showCustom && (
        <div className="rounded-lg border border-white/10 bg-dark-800/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Custom schedule</span>
            <button
              type="button"
              onClick={() => setShowCustom(false)}
              className="text-white/30 hover:text-white/60"
              aria-label="Close custom builder"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 font-mono block mb-1">
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
              <label className="text-[10px] text-white/40 font-mono block mb-1">
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
            <label className="text-[10px] text-white/40 font-mono block mb-1.5">
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
                        : "bg-white/5 text-white/40 border border-white/10 hover:text-white/60"
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
                className="text-[10px] text-white/40 hover:text-white/70 font-mono"
              >
                All days
              </button>
              <button
                type="button"
                onClick={() => setCustomDays(new Set([1, 2, 3, 4, 5]))}
                disabled={disabled}
                className="text-[10px] text-white/40 hover:text-white/70 font-mono"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setCustomDays(new Set())}
                disabled={disabled}
                className="text-[10px] text-white/40 hover:text-white/70 font-mono"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-[10px] text-white/30 font-mono">
              Preview: <code className="text-neon-orange">{previewCron(customTime, customDays)}</code>
            </div>
            <button
              type="button"
              onClick={handleCustomApply}
              disabled={disabled}
              className="px-3 py-1.5 rounded-md bg-neon-orange/20 text-neon-orange border border-neon-orange/40 text-xs font-mono hover:bg-neon-orange/30 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Read-only canonical cron display */}
      {canonicalCron && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800/50 border border-white/5">
          <span className="text-[10px] text-white/40 font-mono shrink-0">Cron:</span>
          <code className="text-xs font-mono text-neon-orange truncate">{canonicalCron}</code>
        </div>
      )}

      {/* Advanced: raw cron editor (collapsible) */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[10px] text-white/30 hover:text-white/60 font-mono underline"
        disabled={disabled}
      >
        {showAdvanced ? "Hide" : "Show"} advanced (raw cron)
      </button>
      {showAdvanced && (
        <input
          type="text"
          value={advancedDraft}
          onChange={(e) => setAdvancedDraft(e.target.value)}
          onBlur={commitAdvancedDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAdvancedDraft();
            } else if (e.key === "Escape") {
              setAdvancedDraft(canonicalCron ?? value);
            }
          }}
          placeholder="e.g. 0 9 * * 1-5"
          className={baseInputStyles}
          spellCheck={false}
          disabled={disabled}
        />
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

/** Build a preview cron expression for the custom builder's "Preview" label. */
function previewCron(time: string, days: ReadonlySet<DayOfWeek>): string {
  const [hhStr, mmStr] = time.split(":");
  const hh = parseInt(hhStr ?? "0", 10);
  const mm = parseInt(mmStr ?? "0", 10);
  return buildWeeklyCron(days, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
}

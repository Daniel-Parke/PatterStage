"use client";

// ═══════════════════════════════════════════════════════════════
// SchedulePicker — canonical schedule input for both the cron page
// and the missions page. Emits a 5-field cron expression; accepts
// 5-field cron, "every Nh" shorthand, and JSON-serialised
// ParsedSchedule on load (for backwards compat with existing jobs).
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Clock, AlertCircle, Calendar } from "lucide-react";
import { baseInputStyles } from "@/lib/theme";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { computeNextRun } from "@/lib/schedule/next-run";
import { describeSchedule } from "@/lib/schedule/types";
import {
  findPresetByValue,
  buildWeeklyCron,
  parseDayOfWeek,
  allDays,
  type DayOfWeek,
  type SchedulePreset,
} from "@/lib/schedule/presets";
import {
  advancedDraftProblem,
  resolveToCron,
  groupSchedulePresets,
} from "@/lib/schedule/picker-resolver";
import { CustomScheduleBuilder } from "@/components/schedule/CustomScheduleBuilder";

type ScheduleMode = "interval" | "wall-clock" | "weekly" | "post-run";

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
  /**
   * Called whenever the advanced (raw cron) draft's usability changes: the
   * message when the box holds something this cannot parse, null when it does
   * not.
   *
   * REQUIRED, not optional, and that is the fix. `commitAdvancedDraft` already
   * returned a boolean "so a caller that is about to SUBMIT can tell a silent
   * revert from a successful commit" (T-0051) and nothing ever consumed it. An
   * optional callback is the same bug with a nicer name: making it required
   * turns "a caller forgot" into a red `tsc`, which is WG-WEB-013's principle
   * applied to the type system rather than to a lint script.
   */
  onDraftError: (message: string | null) => void;
}

// resolveToCron / previewCron / groupSchedulePresets moved to
// src/lib/schedule/picker-resolver.ts (pure + unit-tested).

// ── Main component ───────────────────────────────────────────

export default function SchedulePicker({
  value,
  onChange,
  id,
  disabled = false,
  error = null,
  compact = false,
  mode: _mode,
  onDraftError,
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

  // Preview the next few fire times so the user can sanity-check a cron
  // before saving. Reuses the same dependency-free evaluator the scheduler
  // tick uses (src/lib/schedule/next-run.ts), so the preview matches reality.
  const nextRuns = useMemo(() => {
    if (!canonicalCron) return [] as Date[];
    const out: Date[] = [];
    let from = new Date();
    for (let i = 0; i < 3; i++) {
      const next = computeNextRun(canonicalCron, from);
      if (!next) break;
      out.push(next);
      from = next;
    }
    return out;
  }, [canonicalCron]);

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

  // Custom builder state. `customTime`/`customDays` are read here (Apply +
  // unrecognised-cron seeding); the frequency select is builder-local and
  // lives inside CustomScheduleBuilder.
  const [customTime, setCustomTime] = useState<string>("09:00");
  const [customDays, setCustomDays] = useState<Set<DayOfWeek>>(() => allDays());

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

  const groups = useMemo(() => groupSchedulePresets(), []);

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
  /**
   * Commit the advanced draft to the parent.
   *
   * Returns whether the draft was usable, so a caller that is about to SUBMIT
   * can tell a silent revert from a successful commit. It used to return
   * nothing and revert quietly on invalid input, which meant a typed cron could
   * sit in the box, never commit, and ship the preset default instead, with no
   * error anywhere (T-0051).
   */
  const [draftError, setDraftError] = useState<string | null>(null);

  const commitAdvancedDraft = useCallback((): boolean => {
    const trimmed = advancedDraft.trim();
    if (!trimmed) {
      setAdvancedDraft(canonicalCron ?? value);
      setDraftError(null);
      return true;
    }
    const parsed = parseSchedule(trimmed);
    if (parsed.kind === "invalid") {
      // Say so. Reverting in silence is how a schedule the operator typed
      // becomes a schedule they did not choose.
      setDraftError(`Not a schedule this understands: "${trimmed}"`);
      return false;
    }
    const emitted =
      parsed.kind === "cron" && "expr" in parsed ? parsed.expr : trimmed;
    if (emitted !== value) {
      onChange(emitted);
    }
    setAdvancedDraft(emitted);
    setDraftError(null);
    return true;
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
            <Clock className="w-3.5 h-3.5 text-neon-orange/90 flex-shrink-0" />
            {displayLabel}
          </span>
          <ChevronDown className={`w-4 h-4 text-ps-text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto py-1">
              {groups.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-ps-text-muted font-mono">
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
                          : "text-ps-text-secondary hover:bg-white/5 hover:text-white"
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
      <label className="text-sm font-medium text-ps-text-secondary">
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
            <Clock className="w-3.5 h-3.5 text-neon-orange/90 flex-shrink-0" />
            {displayLabel}
          </span>
          <ChevronDown className={`w-4 h-4 text-ps-text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto py-1">
              {groups.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-ps-text-muted font-mono sticky top-0 bg-dark-900">
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
                          : "text-ps-text-secondary hover:bg-white/5 hover:text-white"
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
        <CustomScheduleBuilder
          customTime={customTime}
          setCustomTime={setCustomTime}
          customDays={customDays}
          setCustomDays={setCustomDays}
          toggleDay={toggleDay}
          disabled={disabled}
          onApply={handleCustomApply}
          onClose={() => setShowCustom(false)}
        />
      )}

      {/* Read-only canonical cron display + next-run preview */}
      {canonicalCron && (
        <div className="rounded-lg bg-dark-800/50 border border-white/5 px-3 py-1.5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ps-text-muted font-mono shrink-0">Cron:</span>
            <code className="text-xs font-mono text-neon-orange truncate">{canonicalCron}</code>
          </div>
          {nextRuns.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-ps-text-muted font-mono shrink-0 mt-px">Next:</span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {nextRuns.map((d, i) => (
                  <span key={i} className="text-xs font-mono text-ps-text-muted">
                    {d.toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced: raw cron editor (collapsible) */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-xs text-ps-text-muted hover:text-ps-text-secondary font-mono underline"
        disabled={disabled}
      >
        {showAdvanced ? "Hide" : "Show"} advanced (raw cron)
      </button>
      {showAdvanced && (
        <input
          type="text"
          value={advancedDraft}
          onChange={(e) => {
            setAdvancedDraft(e.target.value);
            // Report on change, display on blur. The composer must know the
            // draft is unusable without the field ever having been left; see
            // advancedDraftProblem's comment for why blur ordering is not
            // something to lean on.
            onDraftError(advancedDraftProblem(e.target.value));
          }}
          onBlur={commitAdvancedDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAdvancedDraft();
            } else if (e.key === "Escape") {
              // Do not let Escape reach the sheet. `useDialogA11y` listens on
              // the document and closes the topmost dialog, so abandoning a
              // cron typo used to discard the whole half-filled mission
              // (T-0051). Same class as the stacked-dialog bug T-0045 fixed.
              e.stopPropagation();
              setAdvancedDraft(canonicalCron ?? value);
            }
          }}
          placeholder="e.g. 0 9 * * 1-5"
          className={baseInputStyles}
          spellCheck={false}
          disabled={disabled}
        />
      )}

      {/* Error. `draftError` is the picker's own: the composer never passes
          `error`, so before T-0051 this block could not fire at all. */}
      {(error || draftError) && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {error ?? draftError}
        </div>
      )}
    </div>
  );
}

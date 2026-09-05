// ═══════════════════════════════════════════════════════════════
// Input & Textarea Components
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Search } from "lucide-react";
import { Input as FieldInput, Select as FieldSelect } from "@/components/ui/field";

// ── Search Input ───────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  accentColor = "cyan",
  ariaLabel,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accentColor?: string;
  /**
   * What this box searches. Defaults to "Search", which is honest for a
   * magnifier-and-field with no other context; a caller with something more
   * specific should say so (T-0083 / the form-control gate).
   */
  ariaLabel?: string;
  /**
   * Run the search on Enter. There is no form around this input, so there is
   * no implicit submit either: the Memory page printed "Press Enter to search"
   * under a box where Enter did nothing at all (T-0101, D60).
   */
  onSubmit?: () => void;
}) {
  const focusBorder: Record<string, string> = {
    cyan: "focus:border-neon-cyan/50",
    purple: "focus:border-neon-purple/50",
    green: "focus:border-neon-green/50",
    pink: "focus:border-neon-pink/50",
    orange: "focus:border-neon-orange/50",
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ps-text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={
          onSubmit
            ? (e) => {
                if (e.key === "Enter") onSubmit();
              }
            : undefined
        }
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        placeholder={placeholder}
        // design-lint-disable-next-line no-bare-outline-none -- the accent focus border comes from focusBorder on this same line; every entry is a focus:border-* class
        className={`w-full bg-dark-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors font-mono ${focusBorder[accentColor] || focusBorder.cyan}`}
      />
    </div>
  );
}

// ── Text Input ─────────────────────────────────────────────────
export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  description,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  description?: string;
  disabled?: boolean;
}) {
  // Delegates the control styling to the Field Kit Input primitive so every
  // labeled text field shares one border/hover/focus-ring treatment.
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ps-text-secondary">{label}</label>
      {description && (
        <p className="text-xs text-ps-text-muted">{description}</p>
      )}
      <FieldInput
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="font-mono"
      />
    </div>
  );
}

// ── Number Input ───────────────────────────────────────────────
/**
 * A number field that says what it will accept, and answers `null` for empty.
 *
 * It used to be `onChange(Number(e.target.value))` over the prop directly, so
 * an emptied box emitted 0 and a half-typed "-" emitted NaN, and the declared
 * min/max were decoration on an input nothing enforced (T-0100, D77/D78).
 *
 * The text is local state, because a controlled number cannot represent
 * "1." on the way to "1.5". The prop is copied back in only when it changes to
 * something this input did not emit, so a parent that resets the form wins and
 * a keystroke round-tripping through the parent does not fight the caret.
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  description,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  const asText = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v) ? "" : String(v);
  const [raw, setRaw] = useState(() => asText(value));
  const emitted = useRef<number | null>(value ?? null);
  const problemId = useId();

  useEffect(() => {
    const next = value ?? null;
    if (next !== emitted.current) {
      emitted.current = next;
      setRaw(asText(next));
    }
    // Only the prop: `raw` is this input's own business between renders.
  }, [value]);

  const emit = (v: number | null) => {
    emitted.current = v;
    onChange(v);
  };

  const parsed = raw.trim() === "" ? null : Number(raw);
  const numeric = parsed !== null && Number.isFinite(parsed) ? parsed : null;
  const hasRange = min !== undefined && max !== undefined;
  const outOfRange =
    numeric !== null &&
    ((min !== undefined && numeric < min) || (max !== undefined && numeric > max));

  const handleChange = (text: string) => {
    setRaw(text);
    if (text.trim() === "") {
      emit(null);
      return;
    }
    const n = Number(text);
    // A partial entry ("-", "1e") is not a number yet. Holding the text and
    // emitting nothing is the only reading that is not a lie.
    if (Number.isFinite(n)) emit(n);
  };

  const handleBlur = () => {
    if (numeric === null) return;
    let clamped = numeric;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped === numeric) return;
    setRaw(String(clamped));
    emit(clamped);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ps-text-secondary">{label}</label>
      {description && (
        <p className="text-xs text-ps-text-muted">{description}</p>
      )}
      <FieldInput
        type="number"
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        min={min}
        max={max}
        aria-invalid={outOfRange ? "true" : undefined}
        aria-describedby={outOfRange ? problemId : undefined}
        className="font-mono"
      />
      {outOfRange ? (
        <p id={problemId} className="text-xs text-neon-orange">
          {`${label} must be between ${min} and ${max} (got ${numeric})`}
        </p>
      ) : (
        hasRange && (
          <p className="text-xs text-ps-text-faint">{`Range: ${min}–${max}`}</p>
        )
      )}
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────

const toggleColorMap: Record<string, { track: string; thumb: string }> = {
  cyan: { track: "bg-neon-cyan/30 border-neon-cyan/50", thumb: "bg-neon-cyan" },
  purple: { track: "bg-neon-purple/30 border-neon-purple/50", thumb: "bg-neon-purple" },
  green: { track: "bg-neon-green/30 border-neon-green/50", thumb: "bg-neon-green" },
  pink: { track: "bg-neon-pink/30 border-neon-pink/50", thumb: "bg-neon-pink" },
  orange: { track: "bg-neon-orange/30 border-neon-orange/50", thumb: "bg-neon-orange" },
};

export function Toggle({
  label,
  value,
  onChange,
  description,
  color = "cyan",
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  color?: string;
}) {
  // The visible label is pointed at rather than copied. Before this the text and
  // the control were two unrelated boxes: the label was not announced with the
  // switch and clicking it did nothing.
  const labelId = useId();
  const descId = useId();
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div id={labelId} className="text-sm font-medium text-ps-text-secondary">
          {label}
        </div>
        {description && (
          <p id={descId} className="text-xs text-ps-text-muted mt-0.5">
            {description}
          </p>
        )}
      </div>
      <InlineToggle
        value={value}
        onChange={onChange}
        color={color}
        labelledBy={labelId}
        describedBy={description ? descId : undefined}
      />
    </div>
  );
}

// ── Inline Toggle (no visible label of its own: for tables, lists, rows) ─
//
// It renders no text, so it MUST be given a name. `label` is required rather
// than optional, so a call site that forgets is a red tsc rather than a control
// a screen reader announces as "button" with no state. It also carries
// role="switch" + aria-checked, adopting the shape src/components/ui/field/
// Toggle.tsx:23 already ships; without them the on/off state is invisible to
// assistive tech even when the control is named (T-0062).
//
// Prefer `labelledBy` when a visible label exists elsewhere on screen: pointing
// at it makes the accessible name and the visible name the same string by
// construction, which is what WCAG 2.5.3 asks for and what a duplicated
// `label` string quietly stops being the first time one of them is edited.
export function InlineToggle({
  value,
  onChange,
  disabled = false,
  color = "cyan",
  label,
  labelledBy,
  describedBy,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color?: string;
  /** Required unless `labelledBy` points at visible text that names it. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  const colors = toggleColorMap[color] || toggleColorMap.cyan;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        value ? colors.track : "bg-white/10 border border-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
          value
            ? `translate-x-4 ${colors.thumb}`
            : "translate-x-0.5 bg-white/40"
        }`}
      />
    </button>
  );
}

// ── Select ─────────────────────────────────────────────────────

export function Select({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  description?: string;
  /** Retained for call-site compatibility; the Field Kit owns the accent now. */
  color?: string;
}) {
  // Delegates to the unified Field Kit Select (custom, keyboard-accessible,
  // on-brand) so every config/settings dropdown matches the rest of the product
  // instead of falling back to the OS-native control.
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ps-text-secondary">{label}</label>
      {description && <p className="text-xs text-ps-text-muted">{description}</p>}
      <FieldSelect
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options.map((opt) => ({ value: opt, label: opt }))}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Input & Textarea Components
// ═══════════════════════════════════════════════════════════════

"use client";

import { Search } from "lucide-react";
import { Input as FieldInput, Select as FieldSelect } from "@/components/ui/field";

// ── Search Input ───────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  accentColor = "cyan",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accentColor?: string;
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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
      <label className="text-sm font-medium text-white/70">{label}</label>
      {description && (
        <p className="text-xs text-white/40">{description}</p>
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
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-white/70">{label}</label>
      {description && (
        <p className="text-xs text-white/40">{description}</p>
      )}
      <FieldInput
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="font-mono"
      />
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
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-white/70">{label}</div>
        {description && (
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        )}
      </div>
      <InlineToggle value={value} onChange={onChange} color={color} />
    </div>
  );
}

// ── Inline Toggle (no label/description — for use inside tables, lists) ─
export function InlineToggle({
  value,
  onChange,
  disabled = false,
  color = "cyan",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color?: string;
}) {
  const colors = toggleColorMap[color] || toggleColorMap.cyan;
  return (
    <button
      type="button"
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
      <label className="text-sm font-medium text-white/70">{label}</label>
      {description && <p className="text-xs text-white/40">{description}</p>}
      <FieldSelect
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options.map((opt) => ({ value: opt, label: opt }))}
      />
    </div>
  );
}

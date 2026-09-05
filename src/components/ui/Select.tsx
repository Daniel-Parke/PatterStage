// ═══════════════════════════════════════════════════════════════
// Select Component — Themed dropdown select
// ═══════════════════════════════════════════════════════════════

import { ChevronDown } from "lucide-react";
import type { AccentColor } from "@/types/console";
import { focusColorMap } from "@/lib/theme";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  description?: string;
  accentColor?: AccentColor;
  className?: string;
  disabled?: boolean;
  /**
   * The accessible name when no visible <label> is wired to this control.
   * InlineSelect has no label by construction, so without this it is a
   * dropdown that announces only its current value.
   */
  ariaLabel?: string;
}

// ── Inline Select (no label/wrapper, for tight layouts) ──────
export function InlineSelect({
  value,
  onChange,
  options,
  accentColor = "cyan",
  className = "",
  disabled = false,
  ariaLabel,
}: Omit<SelectProps, "label" | "description">) {
  const focusClass = focusColorMap[accentColor];

  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        // design-lint-disable-next-line no-bare-outline-none -- the accent focus border is focusClass on this same line, a focus:border-* class per accent
        className={`w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white outline-none transition-colors font-mono appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${focusClass}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-dark-900">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ps-text-muted pointer-events-none" />
    </div>
  );
}

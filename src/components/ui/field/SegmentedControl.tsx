// ═══════════════════════════════════════════════════════════════
// ui/field/SegmentedControl — small inline option picker (Field Kit)
// For 2–4 mutually-exclusive choices (e.g. repeats, baseline mode).
// ═══════════════════════════════════════════════════════════════

"use client";

export function SegmentedControl({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-white/10 bg-dark-900/80 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 ${
            value === o.value ? "bg-neon-cyan/15 text-neon-cyan" : "text-white/50 hover:text-white/80"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ui/field/Toggle — on-brand pill switch (Field Kit)
// role="switch" + focus ring; one consistent toggle across the product.
// ═══════════════════════════════════════════════════════════════

"use client";

export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Tooltip (e.g. why a toggle is disabled). */
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={hint}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
          : "border-white/10 text-white/40 hover:text-white/70"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${checked ? "bg-neon-cyan" : "bg-white/20"}`} />
      {label}
    </button>
  );
}

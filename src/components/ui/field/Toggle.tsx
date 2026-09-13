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
      className={`inline-flex items-center gap-1.5 rounded-ps-md border px-2.5 py-1 text-body transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
          : "border-ps-edge text-ps-text-muted hover:text-ps-text-secondary"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${checked ? "bg-neon-cyan" : "bg-ps-edge"}`} />
      {label}
    </button>
  );
}

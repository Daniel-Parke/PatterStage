// ═══════════════════════════════════════════════════════════════
// ui/field/Field — label + hint + error wrapper (the Field Kit primitive)
//
// One consistent label/spacing/typography frame for every form control, so
// inputs look and behave the same across the product (UX_AUDIT B3/B4/X1).
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className = "",
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-[11px] font-medium uppercase tracking-wider text-white/40">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11px] text-neon-pink/80">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-white/30">{hint}</p>
      ) : null}
    </div>
  );
}

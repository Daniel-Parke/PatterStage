// ═══════════════════════════════════════════════════════════════
// ui/field/Input + Textarea — on-brand text controls (Field Kit)
// Consistent border/focus-ring/sizing so every text field matches.
// ═══════════════════════════════════════════════════════════════

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const BASE =
  "w-full rounded-lg border border-white/10 bg-dark-900/80 px-3 py-2 text-sm text-ps-text-primary placeholder-white/25 outline-none transition-colors hover:border-white/20 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 disabled:cursor-not-allowed disabled:opacity-40";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  // form-control-names-disable-next-line -- a pure pass-through: every input attribute including aria-label arrives in {...rest}, so the name is the caller's to supply and there is nothing here that could supply it
  return <input {...rest} className={`${BASE} ${className}`} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // form-control-names-disable-next-line -- a pure pass-through: every textarea attribute including aria-label arrives in {...rest}, so the name is the caller's to supply
  return <textarea {...rest} className={`${BASE} resize-y font-mono ${className}`} />;
}

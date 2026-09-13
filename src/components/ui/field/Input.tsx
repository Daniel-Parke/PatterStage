// ═══════════════════════════════════════════════════════════════
// ui/field/Input + Textarea — on-brand text controls (Field Kit)
// Consistent border and sizing so every text field matches.
//
// No focus ring of its own. The kit used to remove the console's one ring
// (`outline-none`) and paint a 1px ring at 30% alpha in its place, on :focus
// rather than :focus-visible, so a mouse click drew it and a keyboard user
// got a third of the indicator every other control has. The ring is the
// global one in globals.css ("Focus, once"), and nothing here touches it
// (T-0128).
// ═══════════════════════════════════════════════════════════════

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const BASE =
  "w-full rounded-ps-md border border-ps-edge bg-ps-surface-panel px-3 py-2 text-body text-ps-text-primary placeholder-ps-text-muted transition-colors hover:border-ps-edge-emphasis disabled:cursor-not-allowed disabled:opacity-40";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  // form-control-names-disable-next-line -- a pure pass-through: every input attribute including aria-label arrives in {...rest}, so the name is the caller's to supply and there is nothing here that could supply it
  return <input {...rest} className={`${BASE} ${className}`} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // form-control-names-disable-next-line -- a pure pass-through: every textarea attribute including aria-label arrives in {...rest}, so the name is the caller's to supply
  return <textarea {...rest} className={`${BASE} resize-y font-mono ${className}`} />;
}

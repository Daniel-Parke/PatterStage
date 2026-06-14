// ═══════════════════════════════════════════════════════════════
// FieldRow — labelled form field wrapper for ModelEditor
// ═══════════════════════════════════════════════════════════════
//
// Renders the `<div className="space-y-1.5"><label.../>{children}{description?}</div>`
// shell that previously appeared 6 times inline in ModelEditor.tsx.
// The label accepts `ReactNode` so call sites can include inline
// markers like the "(optional)" suffix in Base URL / Context Length;
// for plain-string labels (`"Name"`, `"Provider"`, `"Model ID"`,
// `"API Key"`, `"Credential Label"`) the ReactNode coercion is a
// transparent no-op.
//
// The input/select child is passed through as-is — FieldRow is the
// label/description SHELL, not a styled input. Callers still own
// the `inputFieldClasses("purple")` className and the variant-
// specific extras (e.g. the Provider `<select>` adds
// `appearance-none cursor-pointer` at the call site).
//
// Anti-migration guards (callers that should NOT use FieldRow):
//   - The error banner in ModelEditor (icon + colored container —
//     a different visual shape, stays inline).
//   - The "New credential" panel header in ModelEditor (uppercase
//     tracking-widest caption — different visual shape, stays
//     inline).
//   - The two-row grid wrappers (`<div className="grid grid-cols-1
//     sm:grid-cols-2 gap-4">`) — those are LAYOUT wrappers around
//     pairs of FieldRow-bound fields, not single-field wrappers.

import type { ReactNode } from "react";

interface FieldRowProps {
  /** Label text (or richer JSX — e.g. an inline "(optional)" marker). */
  label: ReactNode;
  /** The form control — input, select, etc. Owns its own className. */
  children: ReactNode;
  /** Optional helper text rendered below the control in mono caption style. */
  description?: string;
}

export default function FieldRow({
  label,
  children,
  description,
}: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-white/70">{label}</label>
      {children}
      {description && (
        <p className="text-xs text-white/30 font-mono">{description}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Hindsight Row Action Buttons — Edit + Delete shared between tabs
// ═══════════════════════════════════════════════════════════════
//
// DirectivesTab and MentalModelsTab both render a per-row action
// button group (Edit / (Toggle|Refresh) / Delete) inside the same
// wrapper div (`flex items-center gap-1 shrink-0`). The middle
// button (Toggle in DirectivesTab, Refresh in MentalModelsTab) is
// intentionally NOT extracted — it has a different shape per tab
// (different icon, different onClick signature, conditional
// `disabled` + `animate-pulse` for the Refresh state). Forcing it
// into a shared component would require a 5-prop API surface with
// 2 of the 5 props no-op at one of the 2 sites.
//
// The Edit and Delete buttons, by contrast, were byte-identical at
// both call sites — same className, same Lucide icon, same
// onClick signature `(item) => void`, same title. Extracting them
// here means a future visual tweak (hover bg colour, focus ring,
// icon size) lands in one place instead of two.
//
// Source-pattern test:
//   `tests/unit/hindsight-row-action-buttons-extraction.test.ts`
//   pins the post-extraction shape (component file exists with
//   both exports, both tabs import both, all 4 inline buttons
//   removed, both tabs use the shared components, the middle
//   Toggle/Refresh button stays inline).

import { Pencil, Trash2 } from "lucide-react";

// ── Edit Button ──────────────────────────────────────────────

interface RowEditButtonProps {
  onClick: () => void;
}

/**
 * Per-row "Edit" icon button. Byte-identical to the pre-extraction
 * inline `<button>` in both DirectivesTab (line 90-96 pre-refactor)
 * and MentalModelsTab (line 95-101 pre-refactor):
 *
 * ```tsx
 * <button
 *   onClick={onClick}
 *   className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
 *   title="Edit"
 * >
 *   <Pencil className="w-4 h-4" />
 * </button>
 * ```
 *
 * Caller is responsible for the wrapper div that arranges the
 * three buttons in a row — this component renders just the
 * `<button>` itself.
 */
export function RowEditButton({ onClick }: RowEditButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
      title="Edit"
    >
      <Pencil className="w-4 h-4" />
    </button>
  );
}

// ── Delete Button ────────────────────────────────────────────

interface RowDeleteButtonProps {
  onClick: () => void;
}

/**
 * Per-row "Delete" icon button. Byte-identical to the pre-extraction
 * inline `<button>` in both DirectivesTab (line 104-110 pre-refactor)
 * and MentalModelsTab (line 110-116 pre-refactor):
 *
 * ```tsx
 * <button
 *   onClick={onClick}
 *   className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
 *   title="Delete"
 * >
 *   <Trash2 className="w-4 h-4" />
 * </button>
 * ```
 *
 * Distinguishing styling from the Edit button: hover bg is
 * `bg-red-500/10` (not `bg-white/5`) and the hover text is
 * `text-red-400` (not `text-white/70`). The destructive-intent
 * colour stays the same in both tabs; consolidating the colour
 * into the shared component ensures a future "make destructive
 * actions more obvious" tweak lands in one place.
 */
export function RowDeleteButton({ onClick }: RowDeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
      title="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

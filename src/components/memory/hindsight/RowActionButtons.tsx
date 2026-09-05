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

"use client";

import { Pencil, Trash2 } from "lucide-react";

import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

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
 *   className="p-1.5 rounded-lg hover:bg-white/5 text-ps-text-muted hover:text-ps-text-secondary transition-colors"
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
      className="p-1.5 rounded-lg hover:bg-white/5 text-ps-text-muted hover:text-ps-text-secondary transition-colors"
      title="Edit"
    >
      <Pencil className="w-4 h-4" />
    </button>
  );
}

// ── Delete Button ────────────────────────────────────────────

interface RowDeleteButtonProps {
  onClick: () => void;
  /**
   * What is about to be deleted, named in the accessible label. A directive is
   * a standing instruction injected into every prompt and a mental model is a
   * curated query; both used to go on one click of a bare trash icon while
   * every other destructive row action in the product took two (T-0101).
   */
  label?: string;
}

/**
 * Per-row "Delete" icon button, two clicks.
 *
 * The first click arms and renames itself; the second deletes. Armed is never
 * disabled by being armed, which is the rule ConfirmButton exists to hold
 * (T-0096, D66). The armed state clears itself after four seconds, so a stray
 * click hours later is a no-op rather than a deletion.
 *
 * Distinguishing styling from the Edit button: hover bg is `bg-red-500/10` (not
 * `bg-white/5`) and the hover text is `text-red-400`; armed reverses the pair so
 * the second click is visibly the loaded one.
 */
export function RowDeleteButton({ onClick, label }: RowDeleteButtonProps) {
  const confirm = useTwoStepConfirm({ autoDismissMs: 4000 });
  const named = label ? ` ${label}` : "";

  return (
    <button
      type="button"
      onClick={() => (confirm.isArmed ? void confirm.confirm(onClick) : confirm.arm())}
      className={`p-1.5 rounded-lg transition-colors ${
        confirm.isArmed
          ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
          : "hover:bg-red-500/10 text-ps-text-muted hover:text-red-400"
      }`}
      aria-label={confirm.isArmed ? `Click again to confirm deleting${named}` : `Delete${named}`}
      title={confirm.isArmed ? "Click again to confirm" : "Delete"}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

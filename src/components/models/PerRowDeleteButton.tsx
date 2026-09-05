// ═══════════════════════════════════════════════════════════════
// PerRowDeleteButton — two-step arm-confirm delete button for table rows
// ═══════════════════════════════════════════════════════════════
//
// Shared by `ModelRow` (in ModelsTableSection) and `FallbackRow`
// (in FallbackChainList). Both call sites had an identical 8-line
// pattern pre-refactor:
//
//   const deleteConfirm = useTwoStepConfirm({ autoDismissMs: 4000 });
//   const handleDeleteClick = () => {
//     if (deleteConfirm.isArmedFor(id)) {
//       void deleteConfirm.confirm(() => onDelete(...));
//     } else {
//       deleteConfirm.arm(id);
//     }
//   };
//   const isArmed = deleteConfirm.isArmedFor(id);
//   <button
//     onClick={handleDeleteClick}
//     className={`p-1.5 rounded-lg transition-colors ${
//       isArmed
//         ? "text-red-300 bg-red-500/20 ring-1 ring-red-500/40"
//         : "text-ps-text-muted hover:text-red-400 hover:bg-red-500/10"
//     }`}
//     aria-label={
//       isArmed
//         ? `Click again to confirm deleting ${name}`
//         : `Delete ${name}`
//     }
//     title={isArmed ? "Click again to confirm" : "Delete"}
//   >
//     <Trash2 className="w-3.5 h-3.5" />
//   </button>
//
// The two sites were identical except for the call-site-specific bits
// (id, name, onDelete callback, optional `disabled` prop). Extracting
// keeps the armed-state styling + aria-labels in lockstep — a future
// "armed" style tweak is a one-file change instead of two.
//
// Per the project's two-step-confirm convention, the auto-dismiss is
// 4000ms (matches the rest of the codebase: dashboard's mission
// cancel, log page's clear-all, etc.). The hook's `useTwoStepConfirm`
// instance is created inside the parent row, so each row owns its
// own armed state — a stale "armed" state from one row can't
// accidentally fire when the user clicks a different row's delete
// button minutes later (the `isArmedFor(id)` check gates the confirm
// path; a stale arm on a different id is a no-op).

"use client";

import { Trash2 } from "lucide-react";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

interface PerRowDeleteButtonProps {
  /** Stable per-row id; gates the `isArmedFor` check. */
  rowId: string;
  /** Human-friendly name used in the `aria-label` and tooltip. */
  rowName: string;
  /** Destructive action; called only after the second click. */
  onDelete: () => void | Promise<void>;
  /** Forwarded to the underlying `<button>`. */
  disabled?: boolean;
}

export default function PerRowDeleteButton({
  rowId,
  rowName,
  onDelete,
  disabled = false,
}: PerRowDeleteButtonProps) {
  const deleteConfirm = useTwoStepConfirm({ autoDismissMs: 4000 });

  const handleClick = () => {
    if (deleteConfirm.isArmedFor(rowId)) {
      void deleteConfirm.confirm(onDelete);
    } else {
      deleteConfirm.arm(rowId);
    }
  };

  const isArmed = deleteConfirm.isArmedFor(rowId);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        isArmed
          ? "text-red-300 bg-red-500/20 ring-1 ring-red-500/40"
          : "text-ps-text-muted hover:text-red-400 hover:bg-red-500/10"
      }`}
      aria-label={
        isArmed
          ? `Click again to confirm deleting ${rowName}`
          : `Delete ${rowName}`
      }
      title={isArmed ? "Click again to confirm" : "Delete"}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

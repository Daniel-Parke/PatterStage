// ═══════════════════════════════════════════════════════════════
// LogsHeaderActions — the page header's two controls
//
// Extracted verbatim from app/(main)/logs/page.tsx: Refresh and the two-step
// Delete All. The auto-refresh toggle and the line-count select were here
// too, and on a phone the four wrapped the header onto three rows; they are
// about the terminal, so they moved into the terminal's own bar (LogTerminal,
// T-0133).
// ═══════════════════════════════════════════════════════════════

"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";

export interface LogsHeaderActionsProps {
  /** False when the directory holds no log file, so there is nothing to clear. */
  hasLogs: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  deleteArmed: boolean;
  onDeleteAll: () => void;
  onCancelDelete: () => void;
}

export default function LogsHeaderActions({
  hasLogs,
  refreshing,
  onRefresh,
  deleteArmed,
  onDeleteAll,
  onCancelDelete,
}: LogsHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onRefresh}
        loading={refreshing}
        icon={RefreshCw}
      >
        Refresh
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={onDeleteAll}
        disabled={!hasLogs}
        title={hasLogs ? "Delete every log file" : "There is nothing to delete: no log file exists yet"}
        icon={Trash2}
      >
        {deleteArmed ? "Confirm Clear" : "Delete All"}
      </Button>
      {deleteArmed && (
        <Button variant="ghost" size="sm" onClick={onCancelDelete}>
          Cancel
        </Button>
      )}
    </div>
  );
}

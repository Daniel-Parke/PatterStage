"use client";

import Link from "next/link";
import {
  Copy,
  Edit3,
  ExternalLink,
  Loader2,
  StopCircle,
  Trash2,
  Zap,
} from "lucide-react";
import { ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { timeAgo, titleCase } from "@/lib/utils";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import type { MissionDetail, MissionRow } from "@/hooks/useMissionsPage";
import {
  isMissionDraft,
  isMissionQueuedForRun,
} from "@/lib/mission-board";

export interface MissionEditorPanelProps {
  detail: MissionDetail | null;
  detailLoading: boolean;
  mission: MissionRow;
  categoryLabel?: string;
  promptCollapsed: boolean;
  onPromptCollapsedChange: (collapsed: boolean) => void;
  onEdit: (m: MissionRow) => void;
  onCancel: (id: string) => void;
  isCancelling?: boolean;
  onDelete: (id: string) => void;
  onDuplicate?: (m: MissionRow) => void;
}

export default function MissionEditorPanel({
  detail,
  detailLoading,
  mission,
  categoryLabel,
  promptCollapsed,
  onPromptCollapsedChange,
  onEdit,
  onCancel,
  isCancelling = false,
  onDelete,
  onDuplicate,
}: MissionEditorPanelProps) {
  const copyPrompt = async () => {
    const text = detail?.mission.prompt ?? mission.prompt;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  // Per-row two-step confirms for the 2 destructive actions exposed
  // by this panel. The pre-session 207 form did the confirm inside
  // the `useMissionsPage` hook callbacks (handleDelete + handleCancel)
  // — a single global `window.confirm` dialog with no per-row
  // context. Lifting the confirm into the leaf component gives each
  // expanded-mission row its own armed state so a stale "armed" from
  // one row cannot accidentally fire when the user clicks a different
  // row's destructive button minutes later. Mirrors the session 200
  // per-row `useTwoStepConfirm({ autoDismissMs: 4000 })` shape that
  // the Models table + FallbackChainList use. The hook callbacks
  // (`useMissionsPage.handleDelete` / `.handleCancel`) no longer need
  // to know about confirm-state — that's now owned by the leaf
  // component, where the mission id is in scope at render time.
  const deleteConfirm = useTwoStepConfirm({ autoDismissMs: 4000 });
  const cancelConfirm = useTwoStepConfirm({ autoDismissMs: 4000 });

  // Click handlers for the 2 destructive buttons. Each branches on
  // whether the per-row key (the mission id) is currently armed: if
  // not armed, arm; if armed, run the action. Byte-equivalent to the
  // pre-migration `onClick={() => onDelete(mission.id)}` shape
  // (the action runs on every click in the pre-migration form,
  // guarded by `window.confirm` inside the hook) — but with a
  // styled "Confirm?" state in the leaf and a per-row 4-second
  // auto-dismiss so an armed state can't outlive the user's intent.
  // The `cancellingMissionId` busy state for the cancel button is
  // preserved (the cancel-in-flight spinner is the parent-owned
  // loading indicator that survives both pre- and post-migration).
  const handleDeleteClick = () => {
    if (!deleteConfirm.isArmedFor(mission.id)) {
      deleteConfirm.arm(mission.id);
      return;
    }
    void deleteConfirm.confirm(() => onDelete(mission.id));
  };
  const handleCancelClick = () => {
    if (!cancelConfirm.isArmedFor(mission.id)) {
      cancelConfirm.arm(mission.id);
      return;
    }
    void cancelConfirm.confirm(() => onCancel(mission.id));
  };
  return (
    <div className="border-t border-white/10 px-3 py-3 bg-dark-800/30">
      {detailLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
        </div>
      ) : detail ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
            <div className="flex justify-between">
              <span className="text-white/30">Agent</span>
              <span className="text-white/70 truncate ml-2 text-right">
                {detail.mission.profileName || detail.mission.profileId || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Model</span>
              <span className="text-white/70 truncate ml-2 text-right">
                {detail.mission.modelId || detail.mission.model || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Provider</span>
              <span className="text-white/70 truncate ml-2 text-right">
                {detail.mission.provider || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Scope</span>
              <span className="text-white/70 ml-2 text-right">
                {detail.mission.missionTimeMinutes ? `${detail.mission.missionTimeMinutes}m` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Timeout</span>
              <span className="text-white/70 ml-2 text-right">
                {detail.mission.timeoutMinutes ? `${detail.mission.timeoutMinutes}m` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Elapsed</span>
              <span className="text-white/70 ml-2 text-right">
                {(() => {
                  const created = new Date(detail.mission.createdAt).getTime();
                  /* eslint-disable-next-line react-hooks/purity -- elapsed uses wall clock; list polls every 5s */
                  const now = Date.now();
                  const elapsed = Math.floor((now - created) / 1000);
                  if (elapsed < 60) return `${elapsed}s`;
                  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
                  const h = Math.floor(elapsed / 3600);
                  const m = Math.floor((elapsed % 3600) / 60);
                  return `${h}h ${m}m`;
                })()}
              </span>
            </div>
            {categoryLabel && (
              <div className="flex justify-between">
                <span className="text-white/30">Category</span>
                <span className="text-white/70 ml-2 text-right">{categoryLabel}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/30">Schedule</span>
              <span className="text-white/70 truncate ml-2 text-right">
                {detail.mission.schedule || "One-shot"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Skills</span>
              <span className="text-white/70 truncate ml-2 text-right">
                {(detail.mission.skills?.length ?? 0) > 0
                  ? `${detail.mission.skills!.length} attached`
                  : "—"}
              </span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() =>
                onPromptCollapsedChange(!promptCollapsed)
              }
              className="w-full flex items-center justify-between mb-1 hover:opacity-80 transition-opacity"
            >
              <div className="text-[10px] font-mono text-white/30 uppercase flex items-center gap-1.5">
                <Edit3 className="w-3 h-3" />
                Full Template Details
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-white/30">
                <span>
                  {promptCollapsed
                    ? "show"
                    : "hide"}
                </span>
                <ChevronRight
                  className={`w-3 h-3 transition-transform ${promptCollapsed ? "" : "rotate-90"}`}
                />
              </div>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${promptCollapsed ? "max-h-20" : "max-h-none"}`}
            >
              <div className="text-[10px] text-white/50 font-mono whitespace-pre-wrap bg-dark-900/50 rounded-lg p-2 border border-white/5">
                {detail.mission.prompt}
              </div>
            </div>
          </div>

          {(detail.mission.goals?.length ?? 0) > 0 && (
            <div>
              <div className="text-[10px] font-mono text-white/30 uppercase mb-1">
                Goals
              </div>
              <div className="flex flex-wrap gap-1">
                {(detail.mission.goals ?? [])
                  .slice(0, 3)
                  .map((goal, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5"
                    >
                      {goal}
                    </span>
                  ))}
                {(detail.mission.goals?.length ?? 0) > 3 && (
                  <span className="text-[9px] font-mono text-white/25">
                    +
                    {(detail.mission.goals?.length ?? 0) - 3}
                    {" "}
                    more
                  </span>
                )}
              </div>
            </div>
          )}

          {detail.cronJob && (
            <div className="rounded-lg border border-neon-orange/20 bg-dark-900/50 p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-neon-orange" />
                  <span className="text-[10px] font-mono text-white/60">
                    Cron Job
                  </span>
                </div>
                <Link
                  href={
                    detail.cronJob.id
                      ? `/orchestration/cron?highlight=${encodeURIComponent(detail.cronJob.id)}`
                      : "/orchestration/cron"
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="text-[9px] font-mono text-neon-orange hover:underline flex items-center gap-0.5"
                >
                  view
                  {" "}
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] font-mono">
                <div className="flex justify-between">
                  <span className="text-white/20">
                    State
                  </span>
                  <span
                    className={
                      detail.cronJob.enabled
                        ? "text-neon-green"
                        : "text-white/40"
                    }
                  >
                    {detail.cronJob.enabled
                      ? titleCase(
                          detail.cronJob.state,
                        )
                      : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/20">
                    Last
                  </span>
                  <span className="text-white/50">
                    {detail.cronJob.lastRun
                      ? timeAgo(
                          detail.cronJob.lastRun,
                        )
                      : "Never"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {detail.mission.results && (
            <div>
              <div className="text-[10px] font-mono text-white/30 uppercase mb-1">
                Results
              </div>
              <div className="text-[10px] text-white/50 font-mono whitespace-pre-wrap bg-dark-900/50 rounded-lg p-2 border border-white/5 max-h-16 overflow-y-auto">
                {detail.mission.results}
              </div>
            </div>
          )}

          {detail.mission.error && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2">
              <div className="text-[10px] font-mono text-red-400 uppercase mb-0.5">
                Error
              </div>
              <div className="text-[10px] font-mono text-red-400/60">
                {detail.mission.error}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button variant="ghost" size="sm" onClick={() => void copyPrompt()}>
              <Copy className="w-3 h-3" /> Copy prompt
            </Button>
            {onDuplicate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDuplicate(mission)}
              >
                Duplicate
              </Button>
            )}
            {isMissionDraft(mission) ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(mission)}
              >
                <Edit3 className="w-3 h-3" /> Edit draft
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(mission)}
              >
                <Edit3 className="w-3 h-3" />
                {mission.status === "successful" || mission.status === "failed"
                  ? " Re-dispatch"
                  : " Edit"}
              </Button>
            )}
            {(mission.status === "dispatched" || isMissionQueuedForRun(mission)) && (
              <Button
                variant="danger"
                size="sm"
                loading={isCancelling}
                disabled={isCancelling || cancelConfirm.isArmedFor(mission.id)}
                onClick={handleCancelClick}
              >
                {!isCancelling && !cancelConfirm.isArmedFor(mission.id) ? (
                  <StopCircle className="w-3 h-3" />
                ) : null}
                {isCancelling
                  ? "Cancelling…"
                  : cancelConfirm.isArmedFor(mission.id)
                    ? "Confirm?"
                    : mission.status === "dispatched"
                      ? "Cancel"
                      : "Remove from queue"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className={
                deleteConfirm.isArmedFor(mission.id)
                  ? "ring-1 ring-neon-red/60 bg-neon-red/10 text-neon-red"
                  : undefined
              }
            >
              <Trash2 className="w-3 h-3" />
              {deleteConfirm.isArmedFor(mission.id) ? " Confirm?" : ""}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-white/30 text-center py-3">
          Failed to load details
        </div>
      )}
    </div>
  );
}

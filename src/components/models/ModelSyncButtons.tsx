// ═══════════════════════════════════════════════════════════════
// ModelSyncButtons — push/pull icon buttons for model rows
// Shows real diffs from the diff API endpoint with red X exclusion
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { ArrowDownToLine, ArrowUpToLine, X, Loader2 } from "lucide-react";
import type { SyncActionResult } from "@/lib/sync-manager";

interface DiffEntry {
  id: string;
  label: string;
  detail: string;
}

interface ModelSyncButtonsProps {
  modelId: string;
  modelName: string;
  provider: string;
  modelIdString: string;
  onPush: (modelId: string, options?: { pushCredential?: boolean }) => Promise<SyncActionResult>;
  onPull: (modelId: string, options?: { excluded?: Set<string> }) => Promise<SyncActionResult>;
  disabled?: boolean;
}

interface SyncModalProps {
  direction: "push" | "pull";
  diffs: DiffEntry[];
  onConfirm: (excludedIds: Set<string>) => void;
  onCancel: () => void;
  confirming: boolean;
}

function SyncModal({
  direction,
  diffs,
  onConfirm,
  onCancel,
  confirming,
}: SyncModalProps) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const visibleChanges = diffs.filter((d) => !removed.has(d.id));

  const handleRemove = (id: string) => {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(removed);
  };

  const visibleCount = visibleChanges.length;
  const totalCount = diffs.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {direction === "push" ? (
              <ArrowUpToLine className="w-4 h-4 text-neon-purple" />
            ) : (
              <ArrowDownToLine className="w-4 h-4 text-neon-cyan" />
            )}
            <span className="text-sm font-semibold text-white">
              {direction === "push" ? "Push to Hermes" : "Pull from Hermes"}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diffs list */}
        <div className="px-4 py-3 max-h-72 overflow-y-auto">
          {visibleChanges.length === 0 ? (
            <p className="text-xs text-white/40 font-mono text-center py-4">
              All changes removed — nothing will be synced
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* Summary */}
              {visibleCount < totalCount && (
                <div className="text-[10px] font-mono text-neon-orange/60 mb-2">
                  {totalCount - visibleCount} of {totalCount} changes excluded
                </div>
              )}
              {visibleChanges.map((diff) => (
                <div
                  key={diff.id}
                  className="flex items-start justify-between gap-2 px-3 py-2.5 bg-white/5 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/70">
                      {diff.label}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono truncate mt-0.5">
                      {diff.detail}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(diff.id)}
                    className="flex-shrink-0 p-1 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Exclude this change"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/5 bg-dark-950/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-mono text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirming || visibleChanges.length === 0}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              direction === "push"
                ? "bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30"
                : "bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30"
            }`}
          >
            {confirming
              ? "Syncing…"
              : visibleChanges.length === diffs.length
                ? `Confirm (${diffs.length} change${diffs.length !== 1 ? "s" : ""})`
                : `Confirm ${visibleChanges.length}/${diffs.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModelSyncButtons({
  modelId,
  modelName,
  provider,
  modelIdString,
  onPush,
  onPull,
  disabled = false,
}: ModelSyncButtonsProps) {
  const [modalState, setModalState] = useState<{
    direction: "push" | "pull";
    diffs: DiffEntry[];
    confirming: boolean;
  } | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const fetchDiffs = useCallback(async (direction: "push" | "pull") => {
    setLoadingDiff(true);
    try {
      const res = await fetch(`/api/models/${encodeURIComponent(modelId)}/diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (!res.ok) throw new Error("Failed to compute diffs");
      const json = await res.json();
      const diffs = (json as { data?: { diffs?: DiffEntry[] } })?.data?.diffs ?? [];
      setModalState({ direction, diffs, confirming: false });
    } catch {
      // Fallback to generic messages if diff API fails
      setModalState({
        direction,
        diffs: [
          {
            id: "model-config",
            label: modelName,
            detail: direction === "push"
              ? `Write ${provider}/${modelIdString} to config.yaml`
              : `Read ${provider}/${modelIdString} from config.yaml`,
          },
          ...(direction === "push"
            ? [{ id: "model-env", label: "Credential", detail: `Push API key to ~/.hermes/.env` }]
            : []),
        ],
        confirming: false,
      });
    } finally {
      setLoadingDiff(false);
    }
  }, [modelId, modelName, provider, modelIdString]);

  const handlePush = useCallback(async () => {
    void fetchDiffs("push");
  }, [fetchDiffs]);

  const handlePull = useCallback(async () => {
    void fetchDiffs("pull");
  }, [fetchDiffs]);

  const handleConfirm = useCallback(async (excluded: Set<string>) => {
    if (!modalState) return;
    setModalState((prev) => (prev ? { ...prev, confirming: true } : null));

    try {
      if (modalState.direction === "push") {
        const pushModel = !excluded.has("modelId") && !excluded.has("provider") && !excluded.has("baseUrl");
        const pushCred = !excluded.has("model-env") && pushModel;
        if (pushModel) {
          await onPush(modelId, { pushCredential: pushCred });
        }
      } else {
        await onPull(modelId, { excluded });
      }
      setModalState(null);
    } catch {
      setModalState((prev) => (prev ? { ...prev, confirming: false } : null));
    }
  }, [modalState, modelId, onPush, onPull]);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void handlePull()}
          disabled={disabled || loadingDiff}
          title="Import model from Hermes config"
          className="p-1.5 rounded-lg text-white/30 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingDiff && modalState?.direction === "pull" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowDownToLine className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void handlePush()}
          disabled={disabled || loadingDiff}
          title="Save model to Hermes config"
          className="p-1.5 rounded-lg text-white/30 hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingDiff && modalState?.direction === "push" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowUpToLine className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {modalState && (
        <SyncModal
          direction={modalState.direction}
          diffs={modalState.diffs}
          confirming={modalState.confirming}
          onConfirm={(excluded) => void handleConfirm(excluded)}
          onCancel={() => setModalState(null)}
        />
      )}
    </>
  );
}

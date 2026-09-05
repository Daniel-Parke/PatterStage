// ═══════════════════════════════════════════════════════════════
// ModelSyncButtons — Pull from Hermes / Push to Hermes, per model row
// Shows the diff route's real comparison, and offers the X only where
// the endpoint behind the button honours it (T-0100, D12)
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { ArrowDownToLine, ArrowUpToLine, X, Loader2 } from "lucide-react";
import type { SyncActionResult } from "@/lib/models/sync-result";
import { pluralise } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface DiffEntry {
  id: string;
  label: string;
  detail: string;
}

interface ModelSyncButtonsProps {
  modelId: string;
  provider: string;
  modelIdString: string;
  onPush: (modelId: string, options?: { pushCredential?: boolean }) => Promise<SyncActionResult>;
  onPull: (modelId: string, options?: { excluded?: Set<string> }) => Promise<SyncActionResult>;
  disabled?: boolean;
}

interface SyncModalProps {
  direction: "push" | "pull";
  diffs: DiffEntry[];
  /** True when the two sides already agree, so there is nothing to confirm. */
  inSync: boolean;
  /** The route's sentence for a state with no rows: in sync, no matching section, or a config.yaml that did not parse. */
  note: string | null;
  onConfirm: (excludedIds: Set<string>) => void;
  onCancel: () => void;
  confirming: boolean;
}

/**
 * Which rows the operator may exclude.
 *
 * A pull applies field by field, so every field is excludable. A push writes
 * the whole `config.model` section in one call, so excluding one field of it
 * did nothing at all: the modal counted down to "Confirm 3/4", the confirm
 * was refused by its own gate, and the dialog closed having synced nothing
 * (D12). The credential is a separate file and a separate flag, so it stays
 * excludable in both directions.
 */
function isExcludable(direction: "push" | "pull", id: string): boolean {
  return direction === "pull" || id === "model-env";
}

function SyncModal({
  direction,
  diffs,
  inSync,
  note,
  onConfirm,
  onCancel,
  confirming,
}: SyncModalProps) {
  const title = direction === "push"
    ? "Push to Hermes"
    : "Pull from Hermes";
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // A dialog on the shared contract (T-0096, D116).
  const panelRef = useDialogA11y({ open: true, onClose: onCancel });

  const subtitle = direction === "push"
    ? "Write these settings into config.yaml as the primary agent model"
    : "Read these settings from config.yaml into this model";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel} role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-sync-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {direction === "push" ? (
              <ArrowUpToLine className="w-4 h-4 text-neon-purple" />
            ) : (
              <ArrowDownToLine className="w-4 h-4 text-neon-cyan" />
            )}
            <span id="model-sync-title" className="text-sm font-semibold text-white">{title}</span>
          </div>
          <button
            type="button"
            aria-label="Close sync panel"
            onClick={onCancel}
            className="p-1 rounded text-ps-text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="px-4 py-2 text-xs font-mono text-ps-text-muted">{subtitle}</p>

        {/* Diffs list. With no rows at all the route's own sentence stands in
            their place: in sync, no matching section, or an unparseable file. */}
        <div className="px-4 py-3 max-h-72 overflow-y-auto">
          {diffs.length === 0 ? (
            <p className="text-xs text-ps-text-muted font-mono text-center py-4">
              {note ?? "Nothing to sync."}
            </p>
          ) : visibleChanges.length === 0 ? (
            <p className="text-xs text-ps-text-muted font-mono text-center py-4">
              All changes removed — nothing will be synced
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* Summary */}
              {visibleCount < totalCount && (
                <div className="text-xs font-mono text-neon-orange/90 mb-2">
                  {totalCount - visibleCount} of {totalCount} changes excluded
                </div>
              )}
              {visibleChanges.map((diff) => (
                <div
                  key={diff.id}
                  className="flex items-start justify-between gap-2 px-3 py-2.5 bg-white/5 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-ps-text-secondary">
                      {diff.label}
                    </div>
                    <div className="text-xs text-ps-text-muted font-mono truncate mt-0.5">
                      {diff.detail}
                    </div>
                  </div>
                  {isExcludable(direction, diff.id) && (
                    <button
                      type="button"
                      onClick={() => handleRemove(diff.id)}
                      className="flex-shrink-0 p-1 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Exclude this change"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
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
            className="px-3 py-1.5 text-xs font-mono text-ps-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            // `inSync` is the route's answer, and a push whose only row is the
            // credential is still in sync: the fields would be rewritten with
            // the values already on disk. The credential then has to be written
            // from the Credentials panel instead, which is where a key belongs.
            disabled={confirming || visibleChanges.length === 0 || inSync}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              direction === "push"
                ? "bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30"
                : "bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30"
            }`}
          >
            {confirming
              ? "Syncing…"
              : diffs.length === 0
                ? "Confirm"
                : visibleChanges.length === diffs.length
                  ? `Confirm (${diffs.length} change${pluralise(diffs.length)})`
                  : `Confirm ${visibleChanges.length}/${diffs.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModelSyncButtons({
  modelId,
  provider,
  modelIdString,
  onPush,
  onPull,
  disabled = false,
}: ModelSyncButtonsProps) {
  const [modalState, setModalState] = useState<{
    direction: "push" | "pull";
    diffs: DiffEntry[];
    inSync: boolean;
    note: string | null;
    confirming: boolean;
  } | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const fetchDiffs = useCallback(async (direction: "push" | "pull") => {
    setLoadingDiff(true);
    try {
      const json = await apiFetch<{
        data?: { diffs?: DiffEntry[]; inSync?: boolean; note?: string | null };
      }>(
        `/api/models/${encodeURIComponent(modelId)}/diff`,
        {
          method: "POST",
          body: JSON.stringify({ direction }),
        },
      );
      const diffs = json.data?.diffs ?? [];
      setModalState({
        direction,
        diffs,
        inSync: json.data?.inSync ?? false,
        note: json.data?.note ?? null,
        confirming: false,
      });
    } catch {
      // The diff route is unreachable, so nothing can be compared. The dialog
      // still opens and still syncs — it just says what the call will do
      // rather than what would change.
      const fallbackLabel = direction === "push"
        ? "Push model settings to config.yaml"
        : "Pull model settings from config.yaml";
      setModalState({
        direction,
        diffs: [
          {
            id: "model-config",
            label: fallbackLabel,
            detail: `${provider}/${modelIdString}`,
          },
          ...(direction === "push"
            ? [{ id: "model-env", label: "Credential", detail: `Write the API key for ${provider} to the env file` }]
            : []),
        ],
        inSync: false,
        note: null,
        confirming: false,
      });
    } finally {
      setLoadingDiff(false);
    }
  }, [modelId, provider, modelIdString]);

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
        // No gate on the field ids: the push writes the whole section, so the
        // only thing an exclusion can mean here is "not the credential". The
        // old gate turned an excluded field into a confirm that did nothing.
        await onPush(modelId, { pushCredential: !excluded.has("model-env") });
      } else {
        await onPull(modelId, { excluded });
      }
      setModalState(null);
    } catch {
      setModalState((prev) => (prev ? { ...prev, confirming: false } : null));
    }
  }, [modalState, modelId, onPush, onPull]);

  // closeSyncModal — single-setter close-callback for the SyncModal.
  // Sister to the close-callbacks extracted in /config/models/page.tsx
  // (session 196) and FallbackChainList.tsx — same useState-setter
  // stability rationale. The `<SyncModal onCancel={...}>` binding at
  // line 281 is the only call site today (1-setter close-callback).
  // The 2-setter `setModalState({ ...prev, confirming: true })` paths
  // in handleConfirm are a different shape (2-setter confirm-toggling,
  // not close) and stay inline.
  const closeSyncModal = useCallback(() => setModalState(null), []);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void handlePull()}
          disabled={disabled || loadingDiff}
          title="Pull from Hermes"
          className="p-1.5 rounded-lg text-ps-text-muted hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          title="Push to Hermes"
          className="p-1.5 rounded-lg text-ps-text-muted hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          inSync={modalState.inSync}
          note={modalState.note}
          confirming={modalState.confirming}
          onConfirm={(excluded) => void handleConfirm(excluded)}
          onCancel={closeSyncModal}
        />
      )}
    </>
  );
}

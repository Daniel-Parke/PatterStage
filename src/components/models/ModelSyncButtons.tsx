// ═══════════════════════════════════════════════════════════════
// ModelSyncButtons — Pull from Hermes / Push to Hermes, per model row
// Shows the diff route's real comparison, and offers the X only where
// the endpoint behind the button honours it (T-0100, D12)
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { ArrowDownToLine, ArrowUpToLine, X } from "lucide-react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import IconButton from "@/components/ui/IconButton";
import type { SyncActionResult } from "@/lib/models/sync-result";
import { pluralise } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

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

/**
 * The confirmation, as a Dialog (T-0125). It was its own backdrop, panel,
 * header and footer; what it keeps is its heading id, which the wording
 * suite pins, and every word.
 */
function SyncModal({
  direction,
  diffs,
  inSync,
  note,
  onConfirm,
  onCancel,
  confirming,
}: SyncModalProps) {
  const title = direction === "push" ? "Push to Hermes" : "Pull from Hermes";
  const [removed, setRemoved] = useState<Set<string>>(new Set());

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

  const visibleCount = visibleChanges.length;
  const totalCount = diffs.length;

  return (
    <Dialog
      open
      onClose={onCancel}
      title={title}
      titleId="model-sync-title"
      subtitle={subtitle}
      icon={direction === "push" ? ArrowUpToLine : ArrowDownToLine}
      iconColor={direction === "push" ? "text-neon-purple" : "text-neon-cyan"}
      size="sm"
      closeLabel="Close sync panel"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color={direction === "push" ? "purple" : "cyan"}
            size="sm"
            onClick={() => onConfirm(removed)}
            // `inSync` is the route's answer, and a push whose only row is the
            // credential is still in sync: the fields would be rewritten with
            // the values already on disk. The credential then has to be written
            // from the Credentials panel instead, which is where a key belongs.
            disabled={confirming || visibleChanges.length === 0 || inSync}
          >
            {confirming
              ? "Syncing…"
              : diffs.length === 0
                ? "Confirm"
                : visibleChanges.length === diffs.length
                  ? `Confirm (${diffs.length} change${pluralise(diffs.length)})`
                  : `Confirm ${visibleChanges.length}/${diffs.length}`}
          </Button>
        </>
      }
    >
      {/* Diffs list. With no rows at all the route's own sentence stands in
          their place: in sync, no matching section, or an unparseable file. */}
      <div className="max-h-72 overflow-y-auto">
        {diffs.length === 0 ? (
          <p className="py-4 text-center font-mono text-micro text-ps-text-muted">{note ?? "Nothing to sync."}</p>
        ) : visibleChanges.length === 0 ? (
          <p className="py-4 text-center font-mono text-micro text-ps-text-muted">
            All changes removed — nothing will be synced
          </p>
        ) : (
          <div className="space-y-1.5">
            {visibleCount < totalCount && (
              <div className="mb-2 font-mono text-micro text-neon-orange/90">
                {totalCount - visibleCount} of {totalCount} changes excluded
              </div>
            )}
            {visibleChanges.map((diff) => (
              <div
                key={diff.id}
                className="flex items-start justify-between gap-2 rounded-ps-md bg-ps-surface-panel px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold text-ps-text-secondary">{diff.label}</div>
                  <div className="mt-0.5 truncate font-mono text-micro text-ps-text-muted">{diff.detail}</div>
                </div>
                {isExcludable(direction, diff.id) && (
                  <IconButton size="sm" icon={X} label="Exclude this change" onClick={() => handleRemove(diff.id)} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
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
  const [loadingDiff, setLoadingDiff] = useState<"push" | "pull" | null>(null);

  const fetchDiffs = useCallback(async (direction: "push" | "pull") => {
    setLoadingDiff(direction);
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
      setLoadingDiff(null);
    }
  }, [modelId, provider, modelIdString]);

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

  const closeSyncModal = useCallback(() => setModalState(null), []);

  return (
    <>
      <IconButton
        size="sm"
        icon={ArrowDownToLine}
        color="cyan"
        label="Pull from Hermes"
        loading={loadingDiff === "pull"}
        disabled={disabled || loadingDiff !== null}
        onClick={() => void fetchDiffs("pull")}
      />
      <IconButton
        size="sm"
        icon={ArrowUpToLine}
        color="purple"
        label="Push to Hermes"
        loading={loadingDiff === "push"}
        disabled={disabled || loadingDiff !== null}
        onClick={() => void fetchDiffs("push")}
      />

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

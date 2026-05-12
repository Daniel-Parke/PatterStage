// ═══════════════════════════════════════════════════════════════
// ModelSyncButtons — push/pull icon buttons for model rows
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { ArrowDownToLine, ArrowUpToLine, X } from "lucide-react";
import type { SyncActionResult } from "@/lib/sync-manager";

interface SyncChange {
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
  onPull: (modelId: string) => Promise<SyncActionResult>;
  disabled?: boolean;
}

interface SyncModalProps {
  direction: "push" | "pull";
  changes: SyncChange[];
  onConfirm: (excludedIds: Set<string>) => void;
  onCancel: () => void;
  confirming: boolean;
}

function SyncModal({
  direction,
  changes,
  onConfirm,
  onCancel,
  confirming,
}: SyncModalProps) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const visibleChanges = changes.filter((c) => !removed.has(c.id));

  const handleRemove = (id: string) => {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    // Pass the removed/excluded IDs to the caller
    onConfirm(removed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-dark-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
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

        {/* Changes list */}
        <div className="px-4 py-3 max-h-64 overflow-y-auto">
          {visibleChanges.length === 0 ? (
            <p className="text-xs text-white/40 font-mono text-center py-4">
              All changes removed — nothing to sync
            </p>
          ) : (
            <div className="space-y-2">
              {visibleChanges.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start justify-between gap-2 px-3 py-2 bg-white/5 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-white/70 truncate">
                      {change.label}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono truncate">
                      {change.detail}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(change.id)}
                    className="flex-shrink-0 p-1 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove from batch"
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
            {confirming ? "Syncing…" : "Confirm"}
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
    changes: SyncChange[];
    confirming: boolean;
  } | null>(null);

  const handlePush = useCallback(async () => {
    setModalState({
      direction: "push",
      changes: [
        {
          id: "model-config",
          label: modelName,
          detail: `Write ${provider}/${modelIdString} to config.yaml`,
        },
        {
          id: "model-env",
          label: "Credential",
          detail: `Push API key to ~/.hermes/.env`,
        },
      ],
      confirming: false,
    });
  }, [modelName, provider, modelIdString]);

  const handlePull = useCallback(async () => {
    setModalState({
      direction: "pull",
      changes: [
        {
          id: "model-config",
          label: modelName,
          detail: `Read ${provider}/${modelIdString} from config.yaml`,
        },
      ],
      confirming: false,
    });
  }, [modelName, provider, modelIdString]);

  const handleConfirm = useCallback(async (excluded: Set<string>) => {
    if (!modalState) return;
    setModalState((prev) => (prev ? { ...prev, confirming: true } : null));

    try {
      if (modalState.direction === "push") {
        // Only push credential if it wasn't excluded
        const pushCred = !excluded.has("model-env");
        await onPush(modelId, { pushCredential: pushCred });
      } else {
        await onPull(modelId);
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
          disabled={disabled}
          title="Pull from Hermes config"
          className="p-1.5 rounded-lg text-white/30 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void handlePush()}
          disabled={disabled}
          title="Push to Hermes config"
          className="p-1.5 rounded-lg text-white/30 hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowUpToLine className="w-3.5 h-3.5" />
        </button>
      </div>

      {modalState && (
        <SyncModal
          direction={modalState.direction}
          changes={modalState.changes}
          confirming={modalState.confirming}
          onConfirm={(excluded) => void handleConfirm(excluded)}
          onCancel={() => setModalState(null)}
        />
      )}
    </>
  );
}
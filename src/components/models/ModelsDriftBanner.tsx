"use client";

import { AlertTriangle } from "lucide-react";

import type { SyncDrift } from "./types";

interface ModelsDriftBannerProps {
  drift: SyncDrift;
  onSyncNow: () => void;
  /** True while a sync is in flight — shows a persistent busy state on the button
   *  (the success toast is transient, so this is the non-transient signal). */
  syncing?: boolean;
}

export default function ModelsDriftBanner({
  drift,
  onSyncNow,
  syncing = false,
}: ModelsDriftBannerProps) {
  if (!drift.hasDrift) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neon-orange/20 bg-neon-orange/5">
      <AlertTriangle className="w-4 h-4 text-neon-orange/90 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono text-neon-orange/90">
          Model config drift — database and Hermes disk differ
        </span>
        {drift.driftDetails && drift.driftDetails.length > 0 && (
          <div className="mt-1 text-xs font-mono text-ps-text-muted">
            {drift.driftDetails.join(" · ")}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={syncing}
        onClick={() => void onSyncNow()}
        className="px-3 py-1 text-xs font-mono text-neon-orange/90 hover:text-neon-orange bg-neon-orange/10 hover:bg-neon-orange/20 rounded-lg transition-colors disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}

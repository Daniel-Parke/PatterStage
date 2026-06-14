// ═══════════════════════════════════════════════════════════════
// FallbackConfigPanel — behavioural settings for fallback chain
// ═══════════════════════════════════════════════════════════════

"use client";

import { RefreshCw, Upload, Info } from "lucide-react";
import type { FallbackConfig } from "@/types/hermes";

interface FallbackConfigPanelProps {
  config: FallbackConfig;
  onUpdate: (config: FallbackConfig) => void;
  onSyncToHermes: () => Promise<void>;
  onImportFromConfig: () => Promise<void>;
  syncing?: boolean;
  saving?: boolean;
  dirty?: boolean;
  saveError?: string | null;
  importing?: boolean;
}

/**
 * Build a partial `FallbackConfig` patch from a single field update.
 * Centralises the `{ ...config, X: value }` shape that the 3 inline
 * handlers (retries / restoration / notification) each used to repeat.
 * Callers pass a `Partial<FallbackConfig>` so a future field addition
 * lands in 1 place — the `keyof FallbackConfig` type discriminator
 * catches unknown fields at compile time.
 *
 * Pre-refactor: 3 inline handlers (handleRetriesChange /
 * handleRestorationChange / handleNotificationChange) each did the
 * same `{ ...config, <field>: <value> }` spread. The retries variant
 * had an extra `parseInt + isNaN + range guard` 3-line prelude
 * before the spread; the other 2 were a single-line `onUpdate(...)`
 * call. Post-refactor: 1 `updateField` helper that accepts any
 * `Partial<FallbackConfig>` and forwards the merge to the parent.
 */
function buildConfigPatch(
  config: FallbackConfig,
  patch: Partial<FallbackConfig>,
): FallbackConfig {
  return { ...config, ...patch };
}

export default function FallbackConfigPanel({
  config,
  onUpdate,
  onSyncToHermes,
  onImportFromConfig,
  syncing = false,
  saving = false,
  dirty = false,
  saveError = null,
  importing = false,
}: FallbackConfigPanelProps) {
  const syncBlocked = syncing || saving || dirty;

  // updateField — single 1-call update path for all 3 editable fields.
  // Replaces the 3 pre-refactor handlers (handleRetriesChange /
  // handleRestorationChange / handleNotificationChange) with a single
  // helper that forwards a `Partial<FallbackConfig>` patch to the parent.
  // The retries variant still has its own `parseInt + range guard`
  // (preserved byte-equivalent from the pre-refactor `handleRetriesChange`)
  // but the spread + `onUpdate(...)` call collapse to 1 line.
  const updateField = (patch: Partial<FallbackConfig>) =>
    onUpdate(buildConfigPatch(config, patch));

  const handleRetriesChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      updateField({ apiMaxRetries: num });
    }
  };

  const handleRestorationChange = (restorePrimary: boolean) =>
    updateField({ restorePrimaryOnFallback: restorePrimary });

  const handleNotificationChange = (enabled: boolean) =>
    updateField({ fallbackNotification: enabled });

  return (
    <div className="space-y-4">
      {/* Settings section */}
      <div className="rounded-xl border border-white/10 bg-dark-900/50 p-4 space-y-4">
        {/* Retry threshold */}
        <div>
          <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
            Retry Threshold
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={config.apiMaxRetries}
            onChange={(e) => handleRetriesChange(e.target.value)}
            className="w-24 h-9 min-h-9 bg-dark-800 border border-white/10 rounded-lg px-3 text-sm text-white font-mono outline-none focus:border-neon-purple/50 transition-colors"
          />
          <span className="ml-2 text-xs text-white/30 font-mono">
            attempts before falling back
          </span>
        </div>

        {/* Restoration policy */}
        <div>
          <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
            Restoration Policy
          </label>
            <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="restoration-policy"
                checked={config.restorePrimaryOnFallback}
                onChange={() => handleRestorationChange(true)}
                className="accent-neon-purple"
              />
              <span className="text-sm font-mono text-white/70">
                Restore primary after fallback
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="restoration-policy"
                checked={!config.restorePrimaryOnFallback}
                onChange={() => handleRestorationChange(false)}
                className="accent-neon-purple"
              />
              <span className="text-sm font-mono text-white/70">
                Stay on fallback model
              </span>
            </label>
          </div>
        </div>

        {/* Notification toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.fallbackNotification}
              onChange={(e) => handleNotificationChange(e.target.checked)}
              className="accent-neon-purple w-4 h-4"
            />
            <span className="text-sm font-mono text-white/70">
              Notify on fallback activation
            </span>
          </label>
          <p className="ml-6 mt-0.5 text-[10px] text-white/30 font-mono">
            Sends a notification when the agent switches to a fallback model
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-neon-purple/5 border border-neon-purple/10">
        <Info className="w-4 h-4 text-neon-purple/60 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/40 font-mono">
          Fallback settings apply globally. Sync to save these settings
          to your Hermes agent configuration.
        </p>
      </div>

      {(saving || dirty || saveError) && (
        <p className="text-[10px] font-mono text-white/40">
          {saveError
            ? saveError
            : saving || dirty
              ? "Saving settings…"
              : null}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onSyncToHermes()}
          disabled={syncBlocked}
          className="flex items-center gap-2 px-4 h-9 bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-xs font-mono rounded-lg hover:bg-neon-purple/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : saving || dirty ? "Save pending…" : "Sync to Hermes"}
        </button>
        <button
          type="button"
          onClick={() => void onImportFromConfig()}
          disabled={importing}
          className="flex items-center gap-2 px-4 h-9 bg-white/5 border border-white/10 text-white/70 text-xs font-mono rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className={`w-3.5 h-3.5 ${importing ? "animate-bounce" : ""}`} />
          {importing ? "Importing…" : "Import from config"}
        </button>
      </div>
    </div>
  );
}
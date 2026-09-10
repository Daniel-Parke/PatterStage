// ═══════════════════════════════════════════════════════════════
// FallbackConfigPanel — behavioural settings for fallback chain
// ═══════════════════════════════════════════════════════════════

"use client";

import { RefreshCw, Upload, Info } from "lucide-react";
import type { FallbackConfig } from "@/types/console";
import { Panel } from "@/components/dashboard/Panel";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/field";

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
      <Card className="space-y-4">
        {/* Retry threshold */}
        <div>
          <label className="block text-micro font-mono text-ps-text-muted uppercase tracking-widest mb-2">
            Retry Threshold
          </label>
          {/* The kit's input fills its box, so the box is what sets the width. */}
          <span className="inline-block w-24 align-middle">
            <Input
              aria-label="Retry threshold"
              type="number"
              min="0"
              max="10"
              value={config.apiMaxRetries}
              onChange={(e) => handleRetriesChange(e.target.value)}
              className="h-9 font-mono"
            />
          </span>
          <span className="ml-2 text-micro text-ps-text-muted font-mono">
            attempts before falling back
          </span>
        </div>

        {/* Restoration policy */}
        <div>
          <label className="block text-micro font-mono text-ps-text-muted uppercase tracking-widest mb-2">
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
              <span className="text-body font-mono text-ps-text-secondary">
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
              <span className="text-body font-mono text-ps-text-secondary">
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
            <span className="text-body font-mono text-ps-text-secondary">
              Notify on fallback activation
            </span>
          </label>
          <p className="ml-6 mt-0.5 text-micro text-ps-text-muted font-mono">
            Sends a notification when the agent switches to a fallback model
          </p>
        </div>
      </Card>

      {/* Info banner */}
      <Panel accent="purple" tint="purple" className="flex items-start gap-2 px-3 py-2.5">
        <Info className="w-4 h-4 text-neon-purple flex-shrink-0 mt-0.5" />
        <p className="text-micro text-ps-text-muted font-mono">
          Fallback settings apply globally. Sync to save these settings
          to your Hermes agent configuration.
        </p>
      </Panel>

      {(saving || dirty || saveError) && (
        <p className="text-micro font-mono text-ps-text-muted">
          {saveError
            ? saveError
            : saving || dirty
              ? "Saving settings…"
              : null}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          color="purple"
          icon={RefreshCw}
          loading={syncing}
          onClick={() => void onSyncToHermes()}
          disabled={syncBlocked}
        >
          {syncing ? "Syncing…" : saving || dirty ? "Save pending…" : "Sync to Hermes"}
        </Button>
        <Button
          variant="secondary"
          icon={Upload}
          loading={importing}
          onClick={() => void onImportFromConfig()}
          disabled={importing}
        >
          {importing ? "Importing…" : "Import from config"}
        </Button>
      </div>
    </div>
  );
}

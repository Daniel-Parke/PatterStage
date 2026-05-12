// ═══════════════════════════════════════════════════════════════
// FallbackConfigPanel — behavioural settings for fallback chain
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Upload, Info } from "lucide-react";
import type { FallbackConfig } from "@/types/hermes";

interface FallbackConfigPanelProps {
  config: FallbackConfig;
  onUpdate: (config: FallbackConfig) => void;
  onSyncToHermes: () => Promise<void>;
  onImportFromConfig: () => Promise<void>;
  syncing?: boolean;
  importing?: boolean;
}

type RestorationPolicy = "restore_primary" | "stay_on_fallback" | "prompt_user";

export default function FallbackConfigPanel({
  config,
  onUpdate,
  onSyncToHermes,
  onImportFromConfig,
  syncing = false,
  importing = false,
}: FallbackConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<FallbackConfig>(config);

  // Sync when external prop changes (e.g., after sync import)
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);
  const [restorationPolicy, setRestorationPolicy] = useState<RestorationPolicy>(
    localConfig.restorePrimaryOnFallback ? "restore_primary" : "stay_on_fallback"
  );

  // Sync restoration policy when localConfig changes
  useEffect(() => {
    setRestorationPolicy(
      localConfig.restorePrimaryOnFallback ? "restore_primary" : "stay_on_fallback"
    );
  }, [localConfig.restorePrimaryOnFallback]);

  const handleRetriesChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      const updated = { ...localConfig, apiMaxRetries: num };
      setLocalConfig(updated);
      onUpdate(updated);
    }
  };

  const handleRestorationChange = (policy: RestorationPolicy) => {
    setRestorationPolicy(policy);
    const updated = {
      ...localConfig,
      restorePrimaryOnFallback: policy === "restore_primary",
    };
    setLocalConfig(updated);
    onUpdate(updated);
  };

  const handleNotificationChange = (enabled: boolean) => {
    const updated = { ...localConfig, fallbackNotification: enabled };
    setLocalConfig(updated);
    onUpdate(updated);
  };

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
            value={localConfig.apiMaxRetries}
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
                checked={restorationPolicy === "restore_primary"}
                onChange={() => handleRestorationChange("restore_primary")}
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
                checked={restorationPolicy === "stay_on_fallback"}
                onChange={() => handleRestorationChange("stay_on_fallback")}
                className="accent-neon-purple"
              />
              <span className="text-sm font-mono text-white/70">
                Stay on fallback model
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="restoration-policy"
                checked={restorationPolicy === "prompt_user"}
                onChange={() => handleRestorationChange("prompt_user")}
                className="accent-neon-purple"
              />
              <span className="text-sm font-mono text-white/70">
                Prompt user before switching
              </span>
            </label>
          </div>
        </div>

        {/* Notification toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.fallbackNotification}
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
          Fallback settings apply to the active framework only. Sync to save
          these settings to your agent configuration.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onSyncToHermes()}
          disabled={syncing}
          className="flex items-center gap-2 px-4 h-9 bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-xs font-mono rounded-lg hover:bg-neon-purple/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync to Hermes"}
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
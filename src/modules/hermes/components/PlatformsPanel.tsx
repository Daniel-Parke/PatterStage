// ═══════════════════════════════════════════════════════════════
// PlatformsPanel — dashboard gateway-platforms status + sync-now
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the dashboard god-page (src/app/page.tsx). Shows each
// Hermes platform's configured state (token present in the .env) plus
// the background-sync footer with a manual "Sync now" trigger.

"use client";

import { Globe, RefreshCw } from "lucide-react";

import { StatusDot } from "@/components/ui/Card";
import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import { HERMES_PLATFORMS } from "../lib/toolset-catalog";
import { timeAgo } from "@/lib/utils";
import type { MonitorData } from "@/types/console";

export interface PlatformsPanelProps {
  monitor: MonitorData | null;
  syncNowBusy: boolean;
  onSyncNow: () => void;
}

export default function PlatformsPanel({ monitor, syncNowBusy, onSyncNow }: PlatformsPanelProps) {
  return (
    <Panel accent="cyan">
      <PanelHeader icon={Globe} label="Platforms" accent="cyan" />
      <div
        className="px-4 py-3 space-y-2"
        title="Token present in Hermes .env; gateway must be running for live messaging."
      >
        {HERMES_PLATFORMS.map((p) => {
          const configured = monitor?.gateway.platforms[p.id] ?? false;
          return (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot status={configured ? "online" : "idle"} pulse={configured} />
                <span className="text-xs text-ps-text-secondary capitalize">{p.id}</span>
              </div>
              <span className={`text-xs font-mono ${configured ? "text-neon-green" : "text-ps-text-faint"}`}>
                {configured ? "Configured" : "Not configured"}
              </span>
            </div>
          );
        })}
        {monitor && monitor.gateway.connectedCount === 0 && (
          <div className="text-xs text-ps-text-muted text-center py-2">No platforms configured</div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between gap-2">
        <div className="text-xs text-ps-text-muted font-mono flex items-center gap-2 min-w-0">
          <RefreshCw className="w-3 h-3 shrink-0" />
          {monitor?.sync.lastRun ? (
            <>
              Sync: {timeAgo(monitor.sync.lastRun)}
              {monitor.sync.allSuccessful ? (
                <span className="text-neon-green">✓</span>
              ) : (
                <span className="text-red-400">✗</span>
              )}
            </>
          ) : (
            <span>Background sync idle</span>
          )}
        </div>
        <button
          type="button"
          disabled={syncNowBusy}
          onClick={onSyncNow}
          className="shrink-0 px-2 py-1 text-xs font-mono rounded border border-neon-cyan/30 text-neon-cyan/80 hover:bg-neon-cyan/10 disabled:opacity-50"
        >
          {syncNowBusy ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </Panel>
  );
}

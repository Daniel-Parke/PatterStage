// ═══════════════════════════════════════════════════════════════
// ModelsDriftBanner — one drift sentence per line, with the one
// direction that resolves it
// ═══════════════════════════════════════════════════════════════
//
// The banner used to end in a single "Sync Now" that ran a full re-import
// whichever way the drift pointed, so resolving "PatterStage has a model
// Hermes does not" quietly meant pulling Hermes over the top. Each line now
// carries its own control, and a line with no safe remedy carries none
// (T-0100).

"use client";

import { AlertTriangle } from "lucide-react";

import { driftLineKey, type DriftLine, type SyncDrift } from "./types";

interface ModelsDriftBannerProps {
  drift: SyncDrift;
  /** The registry row that is the agent default, or null when none is set. */
  agentDefaultId: string | null;
  onPull: (line: DriftLine) => void;
  onPush: (line: DriftLine) => void;
  /** `driftLineKey` of the line with a call in flight, so its buttons hold. */
  busyLine: string | null;
}

const BUTTON_CLASS =
  "px-2.5 py-1 text-xs font-mono rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function ModelsDriftBanner({
  drift,
  agentDefaultId,
  onPull,
  onPush,
  busyLine,
}: ModelsDriftBannerProps) {
  if (!drift.hasDrift) return null;

  const lines = drift.lines ?? [];

  return (
    <div className="px-4 py-3 rounded-xl border border-neon-orange/20 bg-neon-orange/5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-neon-orange/90 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-mono text-neon-orange/90">
          Model config drift — database and Hermes disk differ
        </span>
      </div>

      {lines.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {lines.map((line) => {
            const key = driftLineKey(line);
            const busy = busyLine === key;
            // A pull reads config.yaml, so it only makes sense where Hermes
            // is the side that is ahead. A push writes config.yaml's primary
            // section, so it needs an agent default to write, and a
            // registry-only model can only be pushed when it IS that default.
            const canPull = line.kind === "primary" || line.kind === "hermes-only";
            const canPush =
              line.kind === "primary"
                ? agentDefaultId !== null
                : line.kind === "db-only" && line.registryId !== null && line.registryId === agentDefaultId;
            const ref = `${line.provider}/${line.modelId}`;

            return (
              <li key={key} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 text-xs font-mono text-ps-text-muted">{line.text}</span>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {canPull && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Pull from Hermes for ${ref}`}
                      onClick={() => onPull(line)}
                      className={`${BUTTON_CLASS} text-neon-cyan/90 hover:text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/20`}
                    >
                      Pull from Hermes
                    </button>
                  )}
                  {canPush && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Push to Hermes for ${ref}`}
                      onClick={() => onPush(line)}
                      className={`${BUTTON_CLASS} text-neon-purple/90 hover:text-neon-purple bg-neon-purple/10 hover:bg-neon-purple/20`}
                    >
                      Push to Hermes
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        drift.driftDetails.length > 0 && (
          // A body from before this shape shipped: the sentences still read,
          // they just carry no controls.
          <div className="mt-1 text-xs font-mono text-ps-text-muted">{drift.driftDetails.join(" · ")}</div>
        )
      )}
    </div>
  );
}

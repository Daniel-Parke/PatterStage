"use client";

// ═══════════════════════════════════════════════════════════════
// ConfigYamlErrorAlert — the one place that says config.yaml is broken
//
// Extracted from the Dashboard (src/app/page.tsx), which was for a long time the
// ONLY surface that said so. With an unparseable config.yaml, /api/config
// returns {} , which is byte-identical to a legitimately empty config, so the
// Config index showed zero "configured" pills and every section page rendered
// its fields as "(not configured)" with no warning anywhere. It looked like a
// fresh install.
//
// That is not merely a reporting gap. The Config section page is where an
// operator goes to FIX the config, and until T-0060 typing a value there and
// pressing Save destroyed the file. The pages that lied by omission were the
// pages that led into the destructive path.
//
// `detail` differs by surface on purpose. On the Dashboard the useful sentence
// is that syncs are paused; on a section editor it is that Save is disabled
// because a save would rewrite the file from an empty parse.
// ═══════════════════════════════════════════════════════════════

import { AlertTriangle } from "lucide-react";

export function ConfigYamlErrorAlert({
  message,
  detail,
}: {
  message: string;
  detail?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-neon-orange/40 bg-neon-orange/10 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" />
      <div className="min-w-0 text-xs">
        <p className="font-semibold text-neon-orange">Hermes config.yaml cannot be parsed</p>
        <p className="mt-0.5 break-words font-mono text-neon-orange/90">{message}</p>
        <p className="mt-1 text-ps-text-muted">
          {detail ?? (
            <>
              Config + profile syncs are paused until this is fixed. Edit{" "}
              {/* design-lint-disable-next-line hermes-outside-adapter -- the whole point of this alert is to tell the operator which file to open. A parse error with the filename removed is an alert you cannot act on. */}
              <code className="text-ps-text-secondary">~/.hermes/config.yaml</code> to correct the
              YAML.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

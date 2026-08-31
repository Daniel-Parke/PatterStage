// ═══════════════════════════════════════════════════════════════
// ComposerNodeRunDetail — the "why" panel for a stage on the run canvas
//
// Clicking a node on the live run canvas opens this side-sheet: the stage's
// status, verdict (pass + reasons + suggestions), error, and raw output. This
// is where a failed run finally explains itself — restores the per-stage output
// view that the unified canvas dropped.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Save, Check } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { timeAgo } from "@/lib/utils";
import { safeApiCall } from "@/lib/api-fetch";
import type { ComposerNode, ComposerNodeRun } from "@/lib/composer/schema";

const STATUS_TEXT: Record<string, string> = {
  pending: "text-ps-text-muted",
  running: "text-neon-cyan",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  rejected: "text-neon-orange",
  cancelled: "text-neon-orange",
  skipped: "text-ps-text-muted",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">{children}</h3>
  );
}

export default function ComposerNodeRunDetail({
  open,
  onClose,
  node,
  nodeRun,
}: {
  open: boolean;
  onClose: () => void;
  node: ComposerNode | null;
  nodeRun: ComposerNodeRun | null;
}) {
  const verdict = nodeRun?.verdict ?? null;
  const subtitle = node
    ? `${node.kind} · ${node.gate === "hil" ? "human gate" : "auto"}`
    : undefined;

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  async function saveAsArtifact() {
    if (!nodeRun?.output || saveState !== "idle") return;
    setSaveState("saving");
    const res = await safeApiCall("/api/artifacts", {
      method: "POST",
      body: {
        sourceKind: "composer",
        sourceRunId: nodeRun.composerRunId,
        sourceNodeId: nodeRun.id,
        name: `${node?.label ?? "Stage"} output`,
        description: "Saved from a Composer stage",
        mimeType: "text/markdown",
        content: nodeRun.output,
        tags: ["composer", "saved"],
      },
    });
    setSaveState(res.ok ? "saved" : "idle");
  }

  return (
    <Sheet open={open} onClose={onClose} title={node?.label ?? "Stage"} subtitle={subtitle}>
      <div className="space-y-5 px-6 py-5 text-sm">
        {!nodeRun ? (
          <p className="text-ps-text-muted">This stage hasn&apos;t run yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className={`font-mono text-xs uppercase ${STATUS_TEXT[nodeRun.status] ?? "text-ps-text-muted"}`}>
                {nodeRun.status}
              </span>
              {nodeRun.attempt > 1 ? (
                <span className="text-xs text-ps-text-muted">attempt {nodeRun.attempt}</span>
              ) : null}
              {nodeRun.completedAt ? (
                <span className="text-xs text-ps-text-muted">{timeAgo(nodeRun.completedAt)}</span>
              ) : nodeRun.startedAt ? (
                <span className="text-xs text-ps-text-muted">started {timeAgo(nodeRun.startedAt)}</span>
              ) : null}
            </div>

            {verdict ? (
              <div className="space-y-2">
                <Label>Verdict</Label>
                <span className={`font-mono text-xs ${verdict.pass ? "text-neon-green" : "text-neon-pink"}`}>
                  {verdict.pass ? "PASS" : "FAIL"}
                  {verdict.outcome ? ` · ${verdict.outcome}` : ""}
                </span>
                {verdict.reasons.length > 0 ? (
                  <ul className="space-y-1 text-xs text-ps-text-secondary">
                    {verdict.reasons.map((r, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-ps-text-faint">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {verdict.suggestions.length > 0 ? (
                  <div className="space-y-1">
                    <Label>Suggestions</Label>
                    <ul className="space-y-1 text-xs text-ps-text-muted">
                      {verdict.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-ps-text-faint">→</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {nodeRun.error ? (
              <div className="space-y-2">
                <Label>Error</Label>
                <p className="rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-3 py-2 text-xs text-neon-pink">
                  {nodeRun.error}
                </p>
              </div>
            ) : null}

            {nodeRun.output ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Output</Label>
                  <button
                    type="button"
                    onClick={() => void saveAsArtifact()}
                    disabled={saveState !== "idle"}
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-xs font-mono text-ps-text-muted transition hover:border-neon-orange/40 hover:text-neon-orange disabled:opacity-60"
                  >
                    {saveState === "saved" ? <><Check className="h-3 w-3" /> Saved</> : <><Save className="h-3 w-3" /> {saveState === "saving" ? "Saving…" : "Save as artifact"}</>}
                  </button>
                </div>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-dark-900/60 px-3 py-2 text-xs leading-relaxed text-ps-text-secondary">
                  {nodeRun.output}
                </pre>
              </div>
            ) : !verdict && !nodeRun.error ? (
              <p className="text-xs text-ps-text-muted">No output recorded for this stage.</p>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}

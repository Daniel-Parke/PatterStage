// ═══════════════════════════════════════════════════════════════
// ComposerNodeRunDetail — the "why" panel for a stage on the run canvas
//
// Clicking a node on the live run canvas opens this side-sheet: the stage's
// status, verdict (pass + reasons + suggestions), error, and raw output. This
// is where a failed run finally explains itself — restores the per-stage output
// view that the unified canvas dropped.
// ═══════════════════════════════════════════════════════════════

"use client";

import Sheet from "@/components/ui/Sheet";
import { timeAgo } from "@/lib/utils";
import type { ComposerNode, ComposerNodeRun } from "@/lib/composer/schema";

const STATUS_TEXT: Record<string, string> = {
  pending: "text-white/40",
  running: "text-neon-cyan",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  skipped: "text-white/30",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/35">{children}</h3>
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

  return (
    <Sheet open={open} onClose={onClose} title={node?.label ?? "Stage"} subtitle={subtitle}>
      <div className="space-y-5 px-6 py-5 text-sm">
        {!nodeRun ? (
          <p className="text-white/40">This stage hasn&apos;t run yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className={`font-mono text-xs uppercase ${STATUS_TEXT[nodeRun.status] ?? "text-white/40"}`}>
                {nodeRun.status}
              </span>
              {nodeRun.attempt > 1 ? (
                <span className="text-xs text-white/40">attempt {nodeRun.attempt}</span>
              ) : null}
              {nodeRun.completedAt ? (
                <span className="text-xs text-white/30">{timeAgo(nodeRun.completedAt)}</span>
              ) : nodeRun.startedAt ? (
                <span className="text-xs text-white/30">started {timeAgo(nodeRun.startedAt)}</span>
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
                  <ul className="space-y-1 text-xs text-white/70">
                    {verdict.reasons.map((r, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-white/25">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {verdict.suggestions.length > 0 ? (
                  <div className="space-y-1">
                    <Label>Suggestions</Label>
                    <ul className="space-y-1 text-xs text-white/55">
                      {verdict.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-white/25">→</span>
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
                <Label>Output</Label>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-dark-900/60 px-3 py-2 text-xs leading-relaxed text-white/70">
                  {nodeRun.output}
                </pre>
              </div>
            ) : !verdict && !nodeRun.error ? (
              <p className="text-xs text-white/30">No output recorded for this stage.</p>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}

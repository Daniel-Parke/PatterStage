// ═══════════════════════════════════════════════════════════════
// ComposerNodeRunDetail — the "why" panel for a stage on the run canvas
//
// Clicking a node on the live run canvas opens this side-sheet: the stage's
// status, verdict (pass + reasons + suggestions), error, and raw output. This
// is where a failed run finally explains itself — restores the per-stage output
// view that the unified canvas dropped.
// ═══════════════════════════════════════════════════════════════

"use client";

import { statusToneClasses } from "@/lib/ui/theme";
import { sectionHeadingClasses } from "@/lib/ui/theme";
import { useState } from "react";
import { Save, Check } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { runWrite } from "@/lib/api/api-write";
import { timeAgo } from "@/lib/utils";
import ElapsedSince from "./ElapsedSince";
import type { ComposerApproval, ComposerNode, ComposerNodeRun } from "@/lib/composer/schema";

/**
 * The ladder, keyed by the enum this panel receives (T-0120). `rejected` and
 * `cancelled` are `blocked` rather than `fail` for the reason the canvas beside
 * this file records: orange separates the gate the operator turned down from
 * the stage that broke, and `blocked` IS neon-orange.
 */
const STATUS_TEXT: Record<string, string> = {
  pending: statusToneClasses.queued.text,
  running: statusToneClasses.running.text,
  completed: statusToneClasses.ok.text,
  failed: statusToneClasses.fail.text,
  rejected: statusToneClasses.blocked.text,
  cancelled: statusToneClasses.blocked.text,
  skipped: statusToneClasses.idle.text,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={sectionHeadingClasses}>{children}</h3>
  );
}

export default function ComposerNodeRunDetail({
  open,
  onClose,
  node,
  nodeRun,
  approvals = [],
}: {
  open: boolean;
  onClose: () => void;
  node: ComposerNode | null;
  nodeRun: ComposerNodeRun | null;
  /** The gate decisions taken on THIS stage, oldest first (T-0106, D8). */
  approvals?: ComposerApproval[];
}) {
  const verdict = nodeRun?.verdict ?? null;
  const subtitle = node
    ? `${node.kind} · ${node.gate === "hil" ? "human gate" : "auto"}`
    : undefined;

  // The sheet's own toast, because the composer page has none to hand down:
  // under the shell's FeedbackProvider the words reach the shell and
  // `toastElement` is null, and in a bare render they show here.
  const { showToast, toastElement } = useToast();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  async function saveAsArtifact() {
    if (!nodeRun?.output || saveState !== "idle") return;
    setSaveState("saving");
    const saved = await runWrite({
      showToast,
      url: "/api/artifacts",
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
      successMessage: "Saved as an artifact",
      errorMessage: "Could not save the output as an artifact",
    });
    // `saved` stays: the button reads it, so a second click cannot file the
    // same output twice.
    setSaveState(saved ? "saved" : "idle");
  }

  return (
    <Sheet open={open} onClose={onClose} title={node?.label ?? "Stage"} subtitle={subtitle}>
      <div className="space-y-5 px-6 py-5 text-body">
        {!nodeRun ? (
          <p className="text-ps-text-muted">This stage hasn&apos;t run yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className={`font-mono text-micro uppercase ${STATUS_TEXT[nodeRun.status] ?? "text-ps-text-muted"}`}>
                {nodeRun.status}
              </span>
              {nodeRun.attempt > 1 ? (
                <span className="text-body text-ps-text-muted">attempt {nodeRun.attempt}</span>
              ) : null}
              {nodeRun.completedAt ? (
                <span className="text-body text-ps-text-muted">{timeAgo(nodeRun.completedAt)}</span>
              ) : nodeRun.startedAt ? (
                <span className="text-body text-ps-text-muted">
                  running for <ElapsedSince since={nodeRun.startedAt} />
                </span>
              ) : null}
            </div>

            {verdict ? (
              <div className="space-y-2">
                <Label>Verdict</Label>
                <span className={`font-mono text-micro ${verdict.pass ? "text-neon-green" : "text-neon-pink"}`}>
                  {verdict.pass ? "PASS" : "FAIL"}
                  {verdict.outcome ? ` · ${verdict.outcome}` : ""}
                </span>
                {verdict.reasons.length > 0 ? (
                  <ul className="space-y-1 text-body text-ps-text-secondary">
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
                    <ul className="space-y-1 text-body text-ps-text-muted">
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

            {approvals.length > 0 ? (
              <div className="space-y-2">
                {/* Recorded since the gate existed, kept, and shown to nobody. */}
                <Label>Gate decisions</Label>
                <ul className="space-y-2">
                  {approvals.map((a) => (
                    <li key={a.id}>
                      <Card padding="none" className="px-3 py-2">
                        <span
                          className={`font-mono text-micro ${a.action === "accept" ? "text-neon-green" : "text-neon-pink"}`}
                        >
                          {a.action === "accept" ? "Accepted" : "Rejected"}
                        </span>
                        <p className="mt-1 text-body text-ps-text-secondary whitespace-pre-wrap break-words">
                          {a.note && a.note.trim() ? a.note : "No note"}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {nodeRun.error ? (
              <div className="space-y-2">
                <Label>Error</Label>
                <Panel accent="pink" tint="pink" className="px-3 py-2 text-body text-neon-pink">
                  {nodeRun.error}
                </Panel>
              </div>
            ) : null}

            {nodeRun.output ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Output</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={saveState === "saved" ? Check : Save}
                    onClick={() => void saveAsArtifact()}
                    disabled={saveState !== "idle"}
                  >
                    {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save as artifact"}
                  </Button>
                </div>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-ps-md bg-ps-surface-inset px-3 py-2 text-body leading-relaxed text-ps-text-secondary">
                  {nodeRun.output}
                </pre>
              </div>
            ) : !verdict && !nodeRun.error ? (
              <p className="text-body text-ps-text-muted">No output recorded for this stage.</p>
            ) : null}
          </>
        )}
      </div>
      {toastElement}
    </Sheet>
  );
}

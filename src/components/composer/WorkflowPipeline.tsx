// ═══════════════════════════════════════════════════════════════
// WorkflowPipeline — live graph view of a Composer run
//
// Renders the workflow's stage nodes as a connected vertical flow with each
// node's status, attempt, verdict, output, gate, and its OUTGOING routing
// (PASS → next, FAIL ↺ loop-back, APPROVE/REJECT at gates) so the conditional +
// looping graph structure is legible without a heavyweight graph library.
// ═══════════════════════════════════════════════════════════════

"use client";

import type { ReactNode } from "react";
import type { ComposerNodeRun, ComposerWorkflowGraph, EdgeCondition } from "@/lib/composer/schema";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-white/40",
  running: "text-neon-cyan",
  awaiting_approval: "text-neon-yellow",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  cancelled: "text-neon-orange",
  skipped: "text-white/30",
};
const DOT_BG: Record<string, string> = {
  pending: "bg-white/20",
  running: "bg-neon-cyan",
  awaiting_approval: "bg-neon-yellow",
  completed: "bg-neon-green",
  failed: "bg-neon-pink",
  cancelled: "bg-neon-orange",
  skipped: "bg-white/15",
};
const COND_LABEL: Record<string, string> = {
  on_pass: "PASS",
  on_fail: "FAIL",
  on_approve: "APPROVE",
  on_reject: "REJECT",
  always: "→",
};

export default function WorkflowPipeline({
  graph,
  latestNodeRun,
  currentNodeId,
  gate,
}: {
  graph: ComposerWorkflowGraph;
  latestNodeRun: (nodeId: string) => ComposerNodeRun | null;
  currentNodeId: string | null;
  gate?: ReactNode;
}) {
  const nodes = [...graph.nodes].sort((a, b) => a.pos - b.pos);
  const posOf = new Map(graph.nodes.map((n) => [n.id, n.pos]));
  const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]));

  return (
    <ol className="relative space-y-2">
      {nodes.map((node, idx) => {
        const nr = latestNodeRun(node.id);
        const status = nr?.status ?? "pending";
        const isCurrent = currentNodeId === node.id;
        const outgoing = graph.edges.filter((e) => e.fromNodeId === node.id);

        return (
          <li key={node.id} className="relative pl-7">
            {/* Rail + node marker */}
            {idx < nodes.length - 1 ? (
              <span className="absolute left-[9px] top-5 h-full w-px bg-white/10" aria-hidden />
            ) : null}
            <span
              className={`absolute left-1 top-3 h-3.5 w-3.5 rounded-full ring-2 ring-dark-900 ${DOT_BG[status] ?? "bg-white/20"} ${isCurrent ? "animate-pulse" : ""}`}
              aria-hidden
            />

            <div
              className={`rounded-lg border p-2.5 ${isCurrent ? "border-neon-cyan/40 bg-neon-cyan/[0.05]" : "border-white/10 bg-dark-900/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white/85">{node.label}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/25">{node.kind}</span>
                  {node.gate === "hil" ? (
                    <span className="rounded bg-neon-yellow/10 px-1 text-[9px] font-mono text-neon-yellow">HIL</span>
                  ) : null}
                  {node.isTerminal ? (
                    <span className="rounded bg-white/5 px-1 text-[9px] font-mono text-white/40">END</span>
                  ) : null}
                </div>
                <span className={`shrink-0 font-mono text-[10px] uppercase ${STATUS_COLOR[status] ?? "text-white/40"}`}>
                  {status}
                  {nr && nr.attempt > 1 ? <span className="ml-1 text-white/30">·a{nr.attempt}</span> : null}
                </span>
              </div>

              {nr?.verdict ? (
                <div className={`mt-1 font-mono text-[10px] ${nr.verdict.pass ? "text-neon-green" : "text-neon-pink"}`}>
                  {nr.verdict.pass ? "PASS" : `FAIL — ${nr.verdict.reasons.join("; ") || "see output"}`}
                </div>
              ) : null}

              {nr?.output ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[10px] text-white/30 hover:text-white/50">output</summary>
                  <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] text-white/50">
                    {nr.output}
                  </pre>
                </details>
              ) : null}

              {/* Outgoing routing */}
              {outgoing.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {outgoing.map((e) => {
                    const loop = (posOf.get(e.toNodeId) ?? 0) < node.pos;
                    return (
                      <span
                        key={e.id}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono ${loop ? "bg-neon-pink/10 text-neon-pink/80" : "bg-white/5 text-white/40"}`}
                        title={e.label ?? undefined}
                      >
                        {COND_LABEL[e.condition as EdgeCondition] ?? e.condition} {loop ? "↺" : "→"}{" "}
                        {labelOf.get(e.toNodeId) ?? "?"}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              {isCurrent && gate ? <div className="mt-3">{gate}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ═══════════════════════════════════════════════════════════════
// Orchestration → Composer — graph-orchestrated, multi-stage agent workflows.
//
// Launch a seeded workflow (e.g. "Software Delivery") from a feature request /
// bug report; the engine runs each stage as an agent run, routes on PASS/FAIL
// (looping back on failures), and pauses at HIL gates for your call. Live via
// SSE with polling fallback.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { GitBranch, Loader2, Play } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import ComposerGatePrompt from "@/components/composer/ComposerGatePrompt";
import { safeApiCall } from "@/lib/api-fetch";
import { useComposerWorkflows, useComposerRuns, useComposerRun } from "@/hooks/useComposer";
import { useEventStream } from "@/hooks/useEventStream";
import type { ApprovalAction, ComposerNodeRun, ComposerRun } from "@/lib/composer/schema";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-white/40",
  running: "text-neon-cyan",
  awaiting_approval: "text-neon-yellow",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  cancelled: "text-neon-orange",
  skipped: "text-white/30",
};

export default function ComposerPage() {
  const [input, setInput] = useState("");
  const [workflowId, setWorkflowId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  const { data: workflows, error: workflowsError } = useComposerWorkflows();
  const { data: runs, refetch } = useComposerRuns();
  const { data: detail } = useComposerRun(selectedId);
  const { data: live } = useEventStream<{ run: ComposerRun; nodeRuns: ComposerNodeRun[] }>(
    selectedId ? `/api/composer/runs/${selectedId}/events` : null,
  );

  const disabled = Boolean(workflowsError);
  const activeWorkflowId = workflowId || workflows?.[0]?.id || "";
  const run = live?.run ?? detail?.run ?? null;
  const nodeRuns = live?.nodeRuns ?? detail?.nodeRuns ?? [];
  const graph = detail?.graph ?? null;

  function latestNodeRun(nodeId: string): ComposerNodeRun | null {
    const all = nodeRuns.filter((nr) => nr.nodeId === nodeId);
    return all.length ? all.reduce((a, b) => (b.attempt >= a.attempt ? b : a)) : null;
  }

  async function start() {
    const text = input.trim();
    if (text.length < 3 || submitting || !activeWorkflowId) return;
    setSubmitting(true);
    try {
      const res = await safeApiCall<{ data?: { run?: { id: string } } }>("/api/composer/runs", {
        method: "POST",
        body: { workflowId: activeWorkflowId, input: text },
      });
      const id = res.data?.data?.run?.id;
      if (id) {
        setInput("");
        setSelectedId(id);
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function decideGate(action: ApprovalAction) {
    if (!run || !run.currentNodeId || gateBusy) return;
    setGateBusy(true);
    try {
      await safeApiCall(`/api/composer/runs/${run.id}/nodes/${run.currentNodeId}/approve`, {
        method: "POST",
        body: { action },
      });
    } finally {
      setGateBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={GitBranch}
        title="Composer"
        subtitle="Graph-orchestrated, multi-stage agent workflows — with loops and human-in-the-loop gates"
        color="cyan"
      />

      {disabled ? (
        <div className="rounded-2xl border border-neon-pink/30 bg-neon-pink/[0.06] p-4 text-sm text-white/70">
          Failed to load workflows. Check the server logs and try again.
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-4">
        <label htmlFor="composer-input" className="text-xs font-mono uppercase tracking-widest text-white/40">
          Feature request / bug report
        </label>
        <textarea
          id="composer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="e.g. Add a dark-mode toggle to the settings page, persisted per user."
          className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-dark-800/50 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <select
            value={activeWorkflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            className="rounded-lg border border-white/10 bg-dark-800/50 px-3 py-2 text-xs font-mono text-white outline-none focus:border-neon-cyan/50"
          >
            {(workflows ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={start}
            disabled={submitting || disabled || input.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-sm font-medium text-neon-cyan transition hover:bg-neon-cyan/20 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Runs list */}
        <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-3">
          <h2 className="mb-2 px-1 text-xs font-mono uppercase tracking-widest text-white/40">Runs</h2>
          {(runs ?? []).length === 0 ? (
            <p className="px-1 py-4 text-xs text-white/30">No workflow runs yet.</p>
          ) : (
            <ul className="space-y-1">
              {(runs ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 ${selectedId === r.id ? "bg-white/5" : ""}`}
                  >
                    <div className="truncate text-white/80">{r.input ?? "(no input)"}</div>
                    <div className={`mt-0.5 font-mono uppercase ${STATUS_COLOR[r.status] ?? "text-white/40"}`}>{r.status}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pipeline detail */}
        <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-4">
          {!run || !graph ? (
            <p className="text-xs text-white/30">Select a run to watch its pipeline.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="truncate text-sm text-white/80">{run.input}</div>
                <div className={`font-mono text-[11px] uppercase ${STATUS_COLOR[run.status] ?? "text-white/40"}`}>{run.status}</div>
              </div>

              {run.status === "awaiting_approval" && run.currentNodeId ? (
                <ComposerGatePrompt
                  nodeLabel={graph.nodes.find((n) => n.id === run.currentNodeId)?.label ?? "stage"}
                  busy={gateBusy}
                  onAction={decideGate}
                />
              ) : null}

              <ol className="space-y-2">
                {graph.nodes.map((node) => {
                  const nr = latestNodeRun(node.id);
                  const status = nr?.status ?? "pending";
                  const isCurrent = run.currentNodeId === node.id;
                  return (
                    <li
                      key={node.id}
                      className={`rounded-lg border p-2.5 ${isCurrent ? "border-neon-cyan/40 bg-neon-cyan/[0.05]" : "border-white/10 bg-dark-900/40"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/80">{node.label}</span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-white/25">{node.kind}</span>
                          {node.gate === "hil" ? (
                            <span className="rounded bg-neon-yellow/10 px-1 text-[9px] font-mono text-neon-yellow">HIL</span>
                          ) : null}
                        </div>
                        <span className={`font-mono text-[10px] uppercase ${STATUS_COLOR[status] ?? "text-white/40"}`}>
                          {status}
                          {nr && nr.attempt > 1 ? <span className="ml-1 text-white/30">·a{nr.attempt}</span> : null}
                        </span>
                      </div>
                      {nr?.verdict ? (
                        <div className={`mt-1 font-mono text-[10px] ${nr.verdict.pass ? "text-neon-green" : "text-neon-pink"}`}>
                          {nr.verdict.pass ? "PASS" : `FAIL — ${nr.verdict.reasons.join("; ")}`}
                        </div>
                      ) : null}
                      {nr?.output ? (
                        <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] text-white/50">{nr.output}</pre>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

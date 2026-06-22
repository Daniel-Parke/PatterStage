// ═══════════════════════════════════════════════════════════════
// Orchestration → Composer — graph-orchestrated, multi-stage agent workflows.
//
// Launch a seeded workflow (e.g. "Software Delivery") from a feature request /
// bug report; the engine runs each stage as an agent run, routes on PASS/FAIL
// (looping back on failures), and pauses at HIL gates for your call. The live
// pipeline shows the graph (conditional + loop-back edges). SSE + polling.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Select } from "@/components/ui/field";
import dynamic from "next/dynamic";

import ComposerGatePrompt from "@/components/composer/ComposerGatePrompt";
import ComposerNodeRunDetail from "@/components/composer/ComposerNodeRunDetail";
import ComposerRunForm from "@/components/composer/ComposerRunForm";
import { safeApiCall } from "@/lib/api-fetch";
import { timeAgo } from "@/lib/utils";

// react-flow needs the DOM — load the canvases client-only.
const WorkflowCanvas = dynamic(() => import("@/components/composer/WorkflowCanvas"), {
  ssr: false,
  loading: () => <div className="h-[640px] animate-pulse rounded-xl border border-white/10 bg-dark-900/40" />,
});
const WorkflowRunCanvas = dynamic(() => import("@/components/composer/WorkflowRunCanvas"), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-xl border border-white/10 bg-dark-900/40" />,
});
import { useComposerWorkflows, useComposerRuns, useComposerRun } from "@/hooks/useComposer";
import { useProfiles } from "@/hooks/useProfiles";
import { useEventStream } from "@/hooks/useEventStream";
import type { ComposerNodeRun, ComposerRun } from "@/lib/composer/schema";

/** A short, human-readable title from a run's raw input (first line, no markdown #). */
function runTitle(input: string | null): string {
  const firstLine = (input ?? "").split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "");
  if (!cleaned) return "(no input)";
  return cleaned.length > 60 ? `${cleaned.slice(0, 60)}…` : cleaned;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "text-white/40",
  running: "text-neon-cyan",
  awaiting_approval: "text-neon-yellow",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  cancelled: "text-neon-orange",
  skipped: "text-white/30",
};

const STATUS_FILTERS = [
  { value: "", label: "All runs" },
  { value: "running", label: "Running" },
  { value: "awaiting_approval", label: "Awaiting gate" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export default function ComposerPage() {
  const [mode, setMode] = useState<"run" | "build">("run");
  const [input, setInput] = useState("");
  const [workflowId, setWorkflowId] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  const { data: workflows, error: workflowsError, refetch: refetchWorkflows } = useComposerWorkflows();
  const { data: runs, refetch } = useComposerRuns();
  const { data: profiles } = useProfiles();
  const { data: detail } = useComposerRun(selectedId);
  const { data: live } = useEventStream<{ run: ComposerRun; nodeRuns: ComposerNodeRun[] }>(
    selectedId ? `/api/composer/runs/${selectedId}/events` : null,
  );

  const activeWorkflowId = workflowId || workflows?.[0]?.id || "";
  const run = live?.run ?? detail?.run ?? null;
  const nodeRuns = live?.nodeRuns ?? detail?.nodeRuns ?? [];
  const graph = detail?.graph ?? null;

  const profileOptions = [
    { value: "", label: "Default profile" },
    ...(profiles ?? []).map((p) => ({ value: p.name, label: p.name })),
  ];
  const visibleRuns = useMemo(
    () => (runs ?? []).filter((r) => !statusFilter || r.status === statusFilter),
    [runs, statusFilter],
  );

  function latestNodeRun(nodeId: string): ComposerNodeRun | null {
    const all = nodeRuns.filter((nr) => nr.nodeId === nodeId);
    return all.length ? all.reduce((a, b) => (b.attempt >= a.attempt ? b : a)) : null;
  }

  const selectedNode = selectedNodeKey && graph ? graph.nodes.find((n) => n.key === selectedNodeKey) ?? null : null;
  const selectedNodeRun = selectedNode ? latestNodeRun(selectedNode.id) : null;

  async function start() {
    const text = input.trim();
    if (text.length < 3 || submitting || !activeWorkflowId) return;
    setSubmitting(true);
    try {
      const res = await safeApiCall<{ data?: { run?: { id: string } } }>("/api/composer/runs", {
        method: "POST",
        body: { workflowId: activeWorkflowId, input: text, profileName: profileName || undefined },
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

  async function decideGate(action: "accept" | "reject", note?: string) {
    if (!run || !run.currentNodeId || gateBusy) return;
    setGateBusy(true);
    try {
      await safeApiCall(`/api/composer/runs/${run.id}/nodes/${run.currentNodeId}/approve`, {
        method: "POST",
        body: { action, note },
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

      {workflowsError ? <LoadErrorBanner error={workflowsError} /> : null}

      {/* Run / Build tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["run", "build"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-mono uppercase tracking-widest transition ${
              mode === m ? "border-neon-cyan text-neon-cyan" : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {m === "run" ? "Run" : "Build"}
          </button>
        ))}
      </div>

      {mode === "build" ? (
        <WorkflowCanvas workflows={workflows ?? []} onSaved={() => void refetchWorkflows()} />
      ) : (
        <>
      {/* Launch form — self-describing per the selected workflow's input contract */}
      <ComposerRunForm
        workflows={workflows ?? []}
        activeWorkflowId={activeWorkflowId}
        onWorkflowChange={setWorkflowId}
        profileOptions={profileOptions}
        profileName={profileName}
        onProfileChange={setProfileName}
        input={input}
        onInputChange={setInput}
        submitting={submitting}
        onRun={() => void start()}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Runs list */}
        <Card padding="sm">
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-xs font-mono uppercase tracking-widest text-white/40">Runs</h2>
            <div className="ml-auto w-36">
              <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
            </div>
          </div>
          {visibleRuns.length === 0 ? (
            <p className="px-1 py-4 text-xs text-white/30">
              {(runs ?? []).length === 0 ? "No workflow runs yet." : "No runs match this filter."}
            </p>
          ) : (
            <ul className="space-y-1">
              {visibleRuns.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 ${selectedId === r.id ? "bg-white/5" : ""}`}
                  >
                    <div className="truncate text-white/80">{runTitle(r.input)}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] uppercase">
                      <span className={STATUS_COLOR[r.status] ?? "text-white/40"}>{r.status}</span>
                      <span className="normal-case text-white/30">{timeAgo(r.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Pipeline detail */}
        <Card padding="md">
          {!run || !graph ? (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center">
              <GitBranch className="h-6 w-6 text-white/15" />
              <p className="text-sm text-white/50">Select a run to watch it live</p>
              <p className="text-xs text-white/30">Stages light up as they run — click any stage for its details.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-dark-900/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-white/85">{runTitle(run.input)}</div>
                  {run.error ? (
                    <p className="mt-1 text-xs text-neon-pink">{run.error}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-white/30">Click a stage for its verdict & output</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-mono text-[11px] uppercase ${STATUS_COLOR[run.status] ?? "text-white/40"}`}>
                    {run.status}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/30">{timeAgo(run.createdAt)}</div>
                </div>
              </div>
              <WorkflowRunCanvas
                graph={graph}
                latestNodeRun={latestNodeRun}
                currentNodeId={run.currentNodeId}
                onSelectNode={setSelectedNodeKey}
                gate={
                  run.status === "awaiting_approval" && run.currentNodeId ? (
                    <ComposerGatePrompt
                      nodeLabel={graph.nodes.find((n) => n.id === run.currentNodeId)?.label ?? "stage"}
                      busy={gateBusy}
                      onAction={decideGate}
                    />
                  ) : null
                }
              />
            </div>
          )}
        </Card>
      </div>
      <ComposerNodeRunDetail
        open={selectedNode != null}
        onClose={() => setSelectedNodeKey(null)}
        node={selectedNode}
        nodeRun={selectedNodeRun}
      />
        </>
      )}
    </div>
  );
}

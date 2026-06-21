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
import { GitBranch, Play } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Field, Textarea, Select } from "@/components/ui/field";
import ComposerGatePrompt from "@/components/composer/ComposerGatePrompt";
import WorkflowPipeline from "@/components/composer/WorkflowPipeline";
import WorkflowBuilder from "@/components/composer/WorkflowBuilder";
import { safeApiCall } from "@/lib/api-fetch";
import { useComposerWorkflows, useComposerRuns, useComposerRun } from "@/hooks/useComposer";
import { useProfiles } from "@/hooks/useProfiles";
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

  const workflowOptions = (workflows ?? []).map((w) => ({ value: w.id, label: w.name }));
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
        <WorkflowBuilder workflows={workflows ?? []} onSaved={() => void refetchWorkflows()} />
      ) : (
        <>
      {/* Launch form */}
      <Card padding="md" glow="cyan">
        <Field label="Feature request / bug report" htmlFor="composer-input">
          <Textarea
            id="composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="e.g. Add a dark-mode toggle to the settings page, persisted per user."
          />
        </Field>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Workflow">
            <Select value={activeWorkflowId} onChange={setWorkflowId} options={workflowOptions} placeholder="Workflow…" />
          </Field>
          <Field label="Agent profile">
            <Select value={profileName} onChange={setProfileName} options={profileOptions} />
          </Field>
          <Button variant="primary" color="cyan" loading={submitting} onClick={() => void start()} disabled={input.trim().length < 3}>
            {!submitting ? <Play className="h-4 w-4" /> : null} Run workflow
          </Button>
        </div>
      </Card>

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
                    <div className="truncate text-white/80">{r.input ?? "(no input)"}</div>
                    <div className={`mt-0.5 font-mono uppercase ${STATUS_COLOR[r.status] ?? "text-white/40"}`}>{r.status}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Pipeline detail */}
        <Card padding="md">
          {!run || !graph ? (
            <p className="text-xs text-white/30">Select a run to watch its pipeline.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate text-sm text-white/85">{run.input}</div>
                <div className={`shrink-0 font-mono text-[11px] uppercase ${STATUS_COLOR[run.status] ?? "text-white/40"}`}>
                  {run.status}
                </div>
              </div>
              <WorkflowPipeline
                graph={graph}
                latestNodeRun={latestNodeRun}
                currentNodeId={run.currentNodeId}
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
        </>
      )}
    </div>
  );
}

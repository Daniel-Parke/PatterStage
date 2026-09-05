// ═══════════════════════════════════════════════════════════════
// Orchestration → Composer — graph-orchestrated, multi-stage agent workflows.
//
// Launch a seeded workflow (e.g. "Software Delivery") from a feature request /
// bug report; the engine runs each stage as an agent run, routes on PASS/FAIL
// (looping back on failures), and pauses at HIL gates for your call. The live
// pipeline shows the graph (conditional + loop-back edges). SSE + polling.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, Plus } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Select } from "@/components/ui/field";
import dynamic from "next/dynamic";

import ComposerGatePrompt from "@/components/composer/ComposerGatePrompt";
import ComposerClarifyPrompt from "@/components/composer/ComposerClarifyPrompt";
import ComposerNodeRunDetail from "@/components/composer/ComposerNodeRunDetail";
import { profileOptionsFor } from "@/components/composer/profile-options";
import ComposerRunForm from "@/components/composer/ComposerRunForm";
import { safeApiCall } from "@/lib/api-fetch";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { isTerminalComposerRunStatus } from "@/lib/composer/schema";
import { timeAgo } from "@/lib/utils";
import ElapsedSince from "@/components/composer/ElapsedSince";

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
  pending: "text-ps-text-muted",
  running: "text-neon-cyan",
  awaiting_approval: "text-neon-yellow",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  cancelled: "text-neon-orange",
  rejected: "text-neon-orange",
  skipped: "text-ps-text-muted",
};

const STATUS_FILTERS = [
  { value: "", label: "All runs" },
  { value: "running", label: "Running" },
  { value: "awaiting_approval", label: "Awaiting gate" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
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
  // A gate decision that the server REFUSED. safeApiCall returns rather than
  // throws, so before T-0069 the 400 was dropped on the floor and the only
  // visible effect of a refused click was the button ceasing to spin.
  const [gateError, setGateError] = useState<string | null>(null);
  const cancelConfirm = useTwoStepConfirm();
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  // When a run is selected the launch form collapses to a compact bar to free the
  // vertical space; "New run" re-expands it.
  const [forceForm, setForceForm] = useState(false);

  const { data: workflows, error: workflowsError, refetch: refetchWorkflows } = useComposerWorkflows();
  const { data: runs, error: runsError, refetch } = useComposerRuns();
  const { data: profiles } = useProfiles();
  const { data: detail } = useComposerRun(selectedId);
  const { data: live, error: liveError } = useEventStream<{ run: ComposerRun; nodeRuns: ComposerNodeRun[] }>(
    selectedId ? `/api/composer/runs/${selectedId}/events` : null,
  );

  const activeWorkflowId = workflowId || workflows?.[0]?.id || "";
  const run = live?.run ?? detail?.run ?? null;
  const nodeRuns = live?.nodeRuns ?? detail?.nodeRuns ?? [];
  const graph = detail?.graph ?? null;

  const profileOptions = profileOptionsFor(profiles);
  const visibleRuns = useMemo(
    () => (runs ?? []).filter((r) => !statusFilter || r.status === statusFilter),
    [runs, statusFilter],
  );

  const launchOpen = forceForm || !selectedId;

  // Deep-link / restore the selected workflow + run from the URL (?workflow=&runId=)
  // so reloads and shared links land on the same view. Uses history API directly to
  // avoid the useSearchParams Suspense requirement.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const w = sp.get("workflow");
    const r = sp.get("runId");
    if (w) setWorkflowId(w);
    if (r) setSelectedId(r);
  }, []);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (activeWorkflowId) sp.set("workflow", activeWorkflowId); else sp.delete("workflow");
    if (selectedId) sp.set("runId", selectedId); else sp.delete("runId");
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [activeWorkflowId, selectedId]);

  function selectRun(id: string) {
    setSelectedId(id);
    setForceForm(false);
    setGateError(null); // a refusal belongs to the run it was refused on
  }

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
        setGateError(null);
        setForceForm(false); // collapse the launch form onto the new run
        await refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function decideGate(action: "accept" | "reject", note?: string) {
    if (!run || !run.currentNodeId || gateBusy) return;
    setGateBusy(true);
    setGateError(null);
    try {
      const res = await safeApiCall(
        `/api/composer/runs/${run.id}/nodes/${run.currentNodeId}/approve`,
        { method: "POST", body: { action, note } },
      );
      // The gate panel renders from a POLLED copy, so a run that ended between
      // the poll and the click still shows Accept/Reject. That refusal explains
      // what happened to the run, and it is the whole reason the route composes
      // a state-aware message.
      // The fallback is load-bearing, not defensive noise: SafeApiCallResult
      // types `error` as optional, and setting the banner to undefined would
      // hide the refusal again -- the exact defect being fixed.
      if (!res.ok) setGateError(res.error ?? "The server refused that decision.");
    } finally {
      setGateBusy(false);
    }
  }

  async function cancelRun() {
    if (!run || gateBusy) return;
    setGateBusy(true);
    setGateError(null);
    try {
      const res = await safeApiCall(`/api/composer/runs/${run.id}/cancel`, { method: "POST" });
      // Same reasoning as decideGate: safeApiCall RETURNS rather than throws,
      // and a refusal the operator cannot see is the defect T-0069 removed.
      if (!res.ok) setGateError(res.error ?? "The server refused to cancel that run.");
      await refetch();
    } finally {
      setGateBusy(false);
    }
  }

  async function submitClarification(answer: string) {
    if (!run || gateBusy) return;
    setGateBusy(true);
    setGateError(null);
    try {
      const res = await safeApiCall(`/api/composer/runs/${run.id}/clarify`, {
        method: "POST",
        body: { answer },
      });
      if (!res.ok) setGateError(res.error ?? "The server refused that answer.");
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

      {workflowsError ? <LoadErrorBanner error={workflowsError} onRetry={() => void refetchWorkflows()} /> : null}
      {/* A failed live read, as distinct from a dropped socket. The run
          detail below still renders from the polled copy (T-0046). */}
      {liveError ? <LoadErrorBanner error={`Live updates: ${liveError}`} /> : null}

      {/* Run / Build tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["run", "build"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-mono uppercase tracking-widest transition ${
              mode === m ? "border-neon-cyan text-neon-cyan" : "border-transparent text-ps-text-muted hover:text-ps-text-secondary"
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
      {/* Launch form — self-describing per the selected workflow's input contract.
          Collapses to a compact bar once a run is selected to free vertical space. */}
      {launchOpen ? (
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
      ) : (
        <Card padding="sm">
          <button
            type="button"
            onClick={() => setForceForm(true)}
            className="flex w-full items-center gap-2 px-1 py-1 text-left text-sm text-ps-text-secondary transition hover:text-neon-cyan"
          >
            <Plus className="h-4 w-4" />
            New run
            <span className="ml-auto truncate text-xs text-ps-text-muted">
              {workflows?.find((w) => w.id === activeWorkflowId)?.name ?? ""}
            </span>
          </button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Runs list */}
        <Card padding="sm">
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">Runs</h2>
            <div className="ml-auto w-36">
              <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
            </div>
          </div>
          {/* The read contract (T-0096): a failed list read is an error with
              Retry, never "no runs yet". The hook's fallback is [] on failure,
              which is exactly the false empty state this guards against. */}
          {runsError ? (
            <LoadErrorBanner compact error={runsError} onRetry={() => void refetch()} className="mx-1" />
          ) : visibleRuns.length === 0 ? (
            <p className="px-1 py-4 text-xs text-ps-text-muted">
              {(runs ?? []).length === 0 ? "No workflow runs yet." : "No runs match this filter."}
            </p>
          ) : (
            <ul className="space-y-1">
              {visibleRuns.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => selectRun(r.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 ${selectedId === r.id ? "bg-white/5" : ""}`}
                  >
                    <div className="truncate text-ps-text-primary">{runTitle(r.input)}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-xs uppercase">
                      <span className={STATUS_COLOR[r.status] ?? "text-ps-text-muted"}>{r.status}</span>
                      <span className="normal-case text-ps-text-muted">{timeAgo(r.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Pipeline detail */}
        <Card padding="md">
          {!selectedId ? (
            // Nothing selected yet — the genuine empty state.
            <div className="flex h-[60vh] min-h-[420px] flex-col items-center justify-center gap-2 text-center">
              <GitBranch className="h-6 w-6 text-white/15" />
              <p className="text-sm text-ps-text-muted">Select a run to watch it live</p>
              <p className="text-xs text-ps-text-muted">Stages light up as they run — click any stage for its details.</p>
            </div>
          ) : !run || !graph ? (
            // A run IS selected but its graph is still loading — show a skeleton,
            // never the "select a run" empty state (that read as "click did nothing").
            <div className="flex h-[60vh] min-h-[420px] items-center justify-center rounded-xl border border-white/10 bg-dark-900/40">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-neon-cyan" />
                <p className="text-xs text-ps-text-muted">Loading run…</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-dark-900/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ps-text-primary">{runTitle(run.input)}</div>
                  {run.error ? (
                    // Orange, not pink, when the run was cancelled. "Cancelled by
                    // user" rendered in the failure colour under an orange status
                    // pill is the contradiction T-0069 and T-0070 both removed.
                    <p
                      className={`mt-1 text-xs ${
                        run.status === "cancelled" ? "text-neon-orange" : "text-neon-pink"
                      }`}
                    >
                      {run.error}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ps-text-muted">Click a stage for its verdict & output</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-mono text-xs uppercase ${STATUS_COLOR[run.status] ?? "text-ps-text-muted"}`}>
                    {run.status}
                  </div>
                  <div className="mt-0.5 text-xs text-ps-text-muted">
                    {isTerminalComposerRunStatus(run.status) ? (
                      timeAgo(run.createdAt)
                    ) : (
                      <>running for <ElapsedSince since={run.createdAt} /></>
                    )}
                  </div>
                  {!isTerminalComposerRunStatus(run.status) && (
                    // Two-step, because one click ends a multi-stage run that may
                    // be parked at a gate waiting for a person.
                    <button
                      type="button"
                      onClick={() => {
                        if (!cancelConfirm.isArmedFor(run.id)) cancelConfirm.arm(run.id);
                        else void cancelConfirm.confirm(cancelRun);
                      }}
                      disabled={gateBusy}
                      className={`mt-1.5 rounded-lg border px-2 py-1 text-xs font-mono transition-colors disabled:opacity-40 ${
                        cancelConfirm.isArmedFor(run.id)
                          ? "border-neon-orange/60 bg-neon-orange/20 text-neon-orange"
                          : "border-white/15 text-ps-text-muted hover:border-neon-orange/50 hover:text-neon-orange"
                      }`}
                    >
                      {cancelConfirm.isArmedFor(run.id) ? "Confirm cancel?" : "Cancel run"}
                    </button>
                  )}
                </div>
              </div>
              {/* A gate decision the server refused. It sits above the canvas
                  rather than inside the gate panel because the commonest cause
                  -- the run already ended -- also REMOVES the gate panel on the
                  next poll, and an error rendered inside it would vanish with
                  it (T-0069). */}
              {gateError ? (
                <LoadErrorBanner
                  error={gateError}
                  onRetry={() => setGateError(null)}
                  retryLabel="Dismiss"
                  className="mb-0"
                />
              ) : null}
              <WorkflowRunCanvas
                graph={graph}
                latestNodeRun={latestNodeRun}
                currentNodeId={run.currentNodeId}
                onSelectNode={setSelectedNodeKey}
                gate={
                  run.status === "awaiting_approval" && run.currentNodeId ? (
                    run.context?.__clarify ? (
                      <ComposerClarifyPrompt
                        question={String((run.context.__clarify as { question?: string }).question ?? "Please clarify your objective.")}
                        busy={gateBusy}
                        onSubmit={(answer) => void submitClarification(answer)}
                      />
                    ) : (
                      <ComposerGatePrompt
                        nodeLabel={graph.nodes.find((n) => n.id === run.currentNodeId)?.label ?? "stage"}
                        busy={gateBusy}
                        onAction={decideGate}
                      />
                    )
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

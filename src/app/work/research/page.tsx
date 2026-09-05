// ═══════════════════════════════════════════════════════════════
// Laboratory → Deep Research — native, provider-flexible research.
//
// Configure a run (model · search provider · depth · breadth · presets), watch
// the plan→search→reason→synthesize loop live (SSE + polling), and read an
// interactive cited report you can copy, export as a standalone HTML page, or
// launch as a Composer workflow.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Telescope, Send, Save, Square } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import AppPageShell from "@/components/layout/AppPageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmButton from "@/components/ui/ConfirmButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Field, Textarea, Select, Input } from "@/components/ui/field";
import ResearchReport from "@/components/research/ResearchReport";
import { safeApiCall } from "@/lib/api-fetch";
import { useResearchRuns, useResearchRun, useResearchPresets } from "@/hooks/useDeepResearch";
import { useModels } from "@/hooks/useModels";
import { formatElapsed } from "@/lib/utils";
import { useEventStream } from "@/hooks/useEventStream";
import type { ResearchConfig, ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-ps-text-muted",
  running: "text-neon-cyan",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  cancelled: "text-neon-orange",
};

const PROVIDERS = [
  { value: "duckduckgo", label: "DuckDuckGo (free)" },
  { value: "searxng", label: "SearXNG (local)" },
  { value: "none", label: "No web (model only)" },
];

const DEFAULT_CFG: ResearchConfig = {
  modelId: "",
  searchProvider: "duckduckgo",
  rounds: 3,
  resultsPerQuery: 6,
  visitsPerRound: 2,
};

/**
 * The six facts a finished run is judged on.
 *
 * All of them were persisted and none was shown: the detail pane rendered the
 * query, a status word, the error and the report, so two runs of the same
 * question at different depths read identically (T-0108, D102).
 *
 * `Tokens: not recorded` rather than `0`, because null is not zero — the same
 * rule the spend console holds for a run that crashed before it could total.
 */
function runMeta(run: ResearchRun): string[] {
  const cfg = (run.config ?? {}) as ResearchConfig;
  return [
    `Model: ${run.modelId || "Agent default"}`,
    `Search: ${run.provider ?? cfg.searchProvider ?? "duckduckgo"}`,
    `Depth: ${cfg.rounds ?? 3} rounds`,
    `Breadth: ${cfg.resultsPerQuery ?? 6} results/query`,
    run.completedAt
      ? `Duration: ${formatElapsed(run.createdAt, Date.parse(run.completedAt))}`
      : "Duration: running",
    run.usage ? `Tokens: ${run.usage.totalTokens.toLocaleString()}` : "Tokens: not recorded",
  ];
}

/** A run the operator can still stop. */
const STOPPABLE = new Set(["pending", "running"]);

export default function DeepResearchPage() {
  const [query, setQuery] = useState("");
  const [cfg, setCfg] = useState<ResearchConfig>(DEFAULT_CFG);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  /** A failed write on this page. Every one of them used to be fire-and-forget:
   *  a 400 left the screen exactly as it was (D99). */
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data: runs, refetch, error: runsError } = useResearchRuns();
  const { data: polled } = useResearchRun(selectedId);
  const { data: live, error: liveError } = useEventStream<{ run: ResearchRun; steps: ResearchStep[] }>(
    selectedId ? `/api/laboratory/research/${selectedId}/events` : null,
  );
  const detail = live ?? polled;
  const { data: models } = useModels();
  const { data: presets, refetch: refetchPresets } = useResearchPresets();

  const modelOptions = [
    { value: "", label: "Agent default model" },
    ...(models ?? []).map((m) => ({ value: m.modelId, label: `${m.name} · ${m.provider}` })),
  ];
  const presetOptions = [
    { value: "", label: "Load preset…" },
    ...(presets ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];

  function num(v: string, lo: number, hi: number, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
  }

  async function start() {
    const q = query.trim();
    if (q.length < 3 || submitting) return;
    setSubmitting(true);
    try {
      const config: ResearchConfig = { ...cfg, modelId: cfg.modelId || undefined };
      const res = await safeApiCall<{ data?: { run?: { id: string } } }>("/api/laboratory/research", {
        method: "POST",
        body: { query: q, config },
      });
      if (!res.ok) { setWriteError(res.error ?? "Could not start that run"); return; }
      const id = res.data?.data?.run?.id;
      // A 200 with no id is still a failure: nothing is running, and the form
      // would otherwise clear itself as though something were.
      if (!id) { setWriteError("The run started but no id came back, so there is nothing to follow."); return; }
      setWriteError(null);
      setQuery("");
      setSelectedId(id);
      await refetch();
    } finally {
      setSubmitting(false);
    }
  }

  function applyPreset(id: string) {
    if (!id) return;
    const p = (presets ?? []).find((x) => x.id === id);
    if (p) setCfg({ ...DEFAULT_CFG, ...p.config, modelId: p.config.modelId ?? "" });
  }

  async function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const res = await safeApiCall("/api/laboratory/research/presets", {
      method: "POST",
      body: { name, config: { ...cfg, modelId: cfg.modelId || undefined } },
    });
    if (!res.ok) { setWriteError(res.error ?? "Could not save that preset"); return; }
    setWriteError(null);
    setPresetName("");
    await refetchPresets();
  }

  /** Stop a run in flight. The row the route writes is the final word; the job
   *  bails out rather than overwriting it (D98). */
  async function cancelRun(id: string) {
    const res = await safeApiCall(`/api/laboratory/research/${id}/cancel`, { method: "POST" });
    if (!res.ok) { setWriteError(res.error ?? "Could not stop that run"); return; }
    setWriteError(null);
    await refetch();
  }

  return (
    // B3 split the Laboratory into two route groups, so its single layout no
    // longer reached this page and it lost the app's grid (D103).
    <AppPageShell>
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <PageHeader
        icon={Telescope}
        subtitle="Provider-flexible iterative research → an interactive, cited report"
        color="cyan"
      />

      {runsError ? <LoadErrorBanner error={runsError} onRetry={() => void refetch()} /> : null}
      {/* A failed live read, as distinct from a dropped socket. The run
          detail below still renders from the polled copy (T-0046). */}
      {liveError ? <LoadErrorBanner error={`Live updates: ${liveError}`} /> : null}
      {writeError ? <LoadErrorBanner error={writeError} /> : null}

      {/* Launch form */}
      <Card padding="md" glow="cyan">
        <Field label="Research question" htmlFor="dr-query">
          <Textarea
            id="dr-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="e.g. What are the trade-offs between SQLite and Postgres for a self-hosted app?"
          />
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Field label="Model">
              <Select value={cfg.modelId ?? ""} onChange={(v) => setCfg({ ...cfg, modelId: v })} options={modelOptions} />
            </Field>
          </div>
          <Field label="Search">
            <Select
              value={cfg.searchProvider ?? "duckduckgo"}
              onChange={(v) => setCfg({ ...cfg, searchProvider: v })}
              options={PROVIDERS}
            />
          </Field>
          <Field label="Depth" hint="rounds">
            <Input
              type="number"
              min={1}
              max={8}
              value={cfg.rounds ?? 3}
              onChange={(e) => setCfg({ ...cfg, rounds: num(e.target.value, 1, 8, 3) })}
            />
          </Field>
          <Field label="Breadth" hint="results/query">
            <Input
              type="number"
              min={1}
              max={12}
              value={cfg.resultsPerQuery ?? 6}
              onChange={(e) => setCfg({ ...cfg, resultsPerQuery: num(e.target.value, 1, 12, 6) })}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Presets">
              <Select value="" onChange={applyPreset} options={presetOptions} />
            </Field>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Save current as…"
              className="w-44"
            />
            <Button variant="ghost" color="cyan" size="sm" onClick={() => void savePreset()} disabled={!presetName.trim()}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button variant="primary" color="cyan" loading={submitting} onClick={() => void start()} disabled={query.trim().length < 3}>
              {!submitting ? <Send className="h-4 w-4" /> : null} Start research
            </Button>
            {query.trim().length < 3 ? (
              <p className="text-xs text-ps-text-muted">Enter a research question (≥ 3 characters) to start.</p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Runs list */}
        <Card padding="sm">
          <h2 className="mb-2 px-1 text-xs font-mono uppercase tracking-widest text-ps-text-muted">Runs</h2>
          {/* The empty state only after a read that succeeded (T-0096). */}
          {runsError ? null : (runs ?? []).length === 0 ? (
            <p className="px-1 py-4 text-xs text-ps-text-muted">No research runs yet.</p>
          ) : (
            <ul className="space-y-1">
              {(runs ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 ${selectedId === r.id ? "bg-white/5" : ""}`}
                  >
                    <div className="truncate text-ps-text-primary">
                      {(r.query.split("\n").find((l) => l.trim()) ?? r.query).trim()}
                    </div>
                    <div className={`mt-0.5 font-mono uppercase ${STATUS_COLOR[r.status] ?? "text-ps-text-muted"}`}>
                      {r.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Detail */}
        <Card padding="md">
          {!detail ? (
            <p className="text-xs text-ps-text-muted">Select a run to read its report, sources, and timeline.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-ps-text-primary">{detail.run.query}</div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className={`font-mono text-xs uppercase ${STATUS_COLOR[detail.run.status] ?? "text-ps-text-muted"}`}>
                    {detail.run.status}
                  </div>
                  {STOPPABLE.has(detail.run.status) ? (
                    <ConfirmButton
                      variant="ghost"
                      color="pink"
                      size="sm"
                      confirmLabel="Confirm stop?"
                      onConfirm={() => void cancelRun(detail.run.id)}
                    >
                      <Square className="h-3.5 w-3.5" /> Stop run
                    </ConfirmButton>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-xs text-ps-text-muted">
                {runMeta(detail.run).map((f, i) => (
                  <span key={f}>
                    {i > 0 ? <span className="mr-2 text-ps-text-faint">·</span> : null}
                    {f}
                  </span>
                ))}
              </div>
              {detail.run.error ? <p className="text-xs text-neon-pink">{detail.run.error}</p> : null}
              <ResearchReport run={detail.run} steps={detail.steps} />
            </div>
          )}
        </Card>
      </div>
    </div>
    </AppPageShell>
  );
}

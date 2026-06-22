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
import { Telescope, Send, Save } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Field, Textarea, Select, Input } from "@/components/ui/field";
import ResearchReport from "@/components/research/ResearchReport";
import { safeApiCall } from "@/lib/api-fetch";
import { useResearchRuns, useResearchRun, useResearchPresets } from "@/hooks/useDeepResearch";
import { useModels } from "@/hooks/useModels";
import { useEventStream } from "@/hooks/useEventStream";
import type { ResearchConfig, ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-white/40",
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

export default function DeepResearchPage() {
  const [query, setQuery] = useState("");
  const [cfg, setCfg] = useState<ResearchConfig>(DEFAULT_CFG);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");

  const { data: runs, refetch, error: runsError } = useResearchRuns();
  const { data: polled } = useResearchRun(selectedId);
  const { data: live } = useEventStream<{ run: ResearchRun; steps: ResearchStep[] }>(
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
      const id = res.data?.data?.run?.id;
      if (id) {
        setQuery("");
        setSelectedId(id);
        await refetch();
      }
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
    await safeApiCall("/api/laboratory/research/presets", {
      method: "POST",
      body: { name, config: { ...cfg, modelId: cfg.modelId || undefined } },
    });
    setPresetName("");
    await refetchPresets();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Telescope}
        title="Deep Research"
        subtitle="Provider-flexible iterative research → an interactive, cited report"
        color="cyan"
      />

      {runsError ? <LoadErrorBanner error={runsError} /> : null}

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
          <Button variant="primary" color="cyan" loading={submitting} onClick={() => void start()} disabled={query.trim().length < 3}>
            {!submitting ? <Send className="h-4 w-4" /> : null} Start research
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Runs list */}
        <Card padding="sm">
          <h2 className="mb-2 px-1 text-xs font-mono uppercase tracking-widest text-white/40">Runs</h2>
          {(runs ?? []).length === 0 ? (
            <p className="px-1 py-4 text-xs text-white/30">No research runs yet.</p>
          ) : (
            <ul className="space-y-1">
              {(runs ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 ${selectedId === r.id ? "bg-white/5" : ""}`}
                  >
                    <div className="truncate text-white/80">
                      {(r.query.split("\n").find((l) => l.trim()) ?? r.query).trim()}
                    </div>
                    <div className={`mt-0.5 font-mono uppercase ${STATUS_COLOR[r.status] ?? "text-white/40"}`}>
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
            <p className="text-xs text-white/30">Select a run to read its report, sources, and timeline.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-white/90">{detail.run.query}</div>
                <div className={`shrink-0 font-mono text-[11px] uppercase ${STATUS_COLOR[detail.run.status] ?? "text-white/40"}`}>
                  {detail.run.status}
                </div>
              </div>
              {detail.run.error ? <p className="text-xs text-neon-pink">{detail.run.error}</p> : null}
              <ResearchReport run={detail.run} steps={detail.steps} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

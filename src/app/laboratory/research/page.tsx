// ═══════════════════════════════════════════════════════════════
// Laboratory → Deep Research — native, provider-flexible research tool.
//
// Submit a question; the engine plans → (optionally) searches → synthesizes a
// report via the configured model (local endpoint or cloud, default Hermes).
// MVP single-pass loop; the full IterResearch loop + real search providers +
// "Launch as Mission" handoff land next. Runs/steps stream via polling.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Telescope, Loader2, Send } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import { safeApiCall } from "@/lib/api-fetch";
import { useResearchRuns, useResearchRun } from "@/hooks/useDeepResearch";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-white/40",
  running: "text-neon-cyan",
  completed: "text-neon-green",
  failed: "text-neon-pink",
  cancelled: "text-neon-orange",
};

export default function DeepResearchPage() {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: runs, refetch } = useResearchRuns();
  const { data: detail } = useResearchRun(selectedId);

  async function start() {
    const q = query.trim();
    if (q.length < 3 || submitting) return;
    setSubmitting(true);
    try {
      const res = await safeApiCall<{ data?: { run?: { id: string } } }>("/api/laboratory/research", {
        method: "POST",
        body: { query: q },
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

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Telescope}
        title="Deep Research"
        subtitle="Native, provider-flexible research — plan → search → synthesize"
        color="cyan"
      />

      <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-4">
        <label htmlFor="dr-query" className="text-xs font-mono uppercase tracking-widest text-white/40">
          Research question
        </label>
        <textarea
          id="dr-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="e.g. What are the trade-offs between IterResearch and ReAct for long-horizon agents?"
          className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-dark-800/50 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={start}
            disabled={submitting || query.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-sm font-medium text-neon-cyan transition hover:bg-neon-cyan/20 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Start research
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Runs list */}
        <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-3">
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
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 ${
                      selectedId === r.id ? "bg-white/5" : ""
                    }`}
                  >
                    <div className="truncate text-white/80">{r.query}</div>
                    <div className={`mt-0.5 font-mono uppercase ${STATUS_COLOR[r.status] ?? "text-white/40"}`}>
                      {r.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-4">
          {!detail ? (
            <p className="text-xs text-white/30">Select a run to view its report and steps.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-white/80">{detail.run.query}</div>
                <div className={`mt-1 font-mono text-[11px] uppercase ${STATUS_COLOR[detail.run.status] ?? "text-white/40"}`}>
                  {detail.run.status}
                  {detail.run.error ? <span className="ml-2 text-neon-pink">— {detail.run.error}</span> : null}
                </div>
              </div>

              {detail.run.report ? (
                <div>
                  <h3 className="mb-1 text-xs font-mono uppercase tracking-widest text-white/40">Report</h3>
                  <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-dark-950/50 p-3 text-xs text-white/80">
                    {detail.run.report}
                  </pre>
                </div>
              ) : null}

              {detail.steps.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-xs font-mono uppercase tracking-widest text-white/40">Steps</h3>
                  <ol className="space-y-2">
                    {detail.steps.map((s) => (
                      <li key={s.id} className="rounded-lg border border-white/10 bg-dark-900/40 p-2">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-neon-cyan">{s.kind}</div>
                        {s.output ? (
                          <pre className="mt-1 whitespace-pre-wrap text-[11px] text-white/60">{s.output}</pre>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

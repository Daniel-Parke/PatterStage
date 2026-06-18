// ═══════════════════════════════════════════════════════════════
// Benchmarks — the Agent Rating arena
//
// Pick an agent profile + a bare-model baseline + a suite, run a comparison,
// and watch the per-domain scores land. The agent-vs-baseline delta is the
// hypothesis test: does the .md config + skills + tools + memory lift
// performance over the raw model? Reuses the read hooks + viz conventions.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMemo, useState } from "react";
import { Trophy, Swords, Play, Square, Bot, Cpu, Share2, Medal } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { useApiResource } from "@/hooks/useApiResource";
import { useSuites, useBenchmarkRuns, useBenchmarkRun, useLeaderboard } from "@/hooks/useBenchmarks";
import { safeApiCall, safeApiCallData } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/Toast";
import { BENCHMARK_DOMAINS, DOMAIN_LABELS, type BenchmarkRun } from "@/lib/benchmarks/types";
import type { AgentProfile } from "@/types/hermes";
import type { ModelRecord } from "@/lib/models-repository";

// ── small helpers ────────────────────────────────────────────

function ratingColor(rating: number): string {
  if (rating >= 80) return "var(--color-neon-green)";
  if (rating >= 60) return "var(--color-neon-cyan)";
  if (rating >= 40) return "var(--color-neon-yellow)";
  return "var(--color-neon-orange)";
}

function statusTone(status: string): string {
  switch (status) {
    case "completed": return "text-neon-green";
    case "running": return "text-neon-cyan";
    case "pending": return "text-white/50";
    case "cancelled": return "text-neon-orange";
    default: return "text-neon-pink";
  }
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-dark-900/60 p-4 ${className}`}>{children}</div>;
}

function RatingPill({ run, label }: { run: BenchmarkRun | undefined; label: string }) {
  const rating = run?.summary?.overallRating ?? null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 font-mono text-2xl font-bold"
        style={{
          borderColor: rating === null ? "rgba(255,255,255,0.15)" : ratingColor(rating),
          color: rating === null ? "rgba(255,255,255,0.4)" : ratingColor(rating),
          boxShadow: rating === null ? "none" : `0 0 24px ${ratingColor(rating)}33`,
        }}
      >
        {rating === null ? "—" : rating}
      </div>
      <div className={`text-[11px] font-mono ${statusTone(run?.status ?? "pending")}`}>
        {run?.status ?? "—"}
      </div>
    </div>
  );
}

/** Per-domain comparison bars (agent cyan, model muted). */
function DomainBars({ agent, model }: { agent?: BenchmarkRun; model?: BenchmarkRun }) {
  const score = (run: BenchmarkRun | undefined, domain: string): number | null => {
    const d = run?.summary?.domains.find((x) => x.domain === domain);
    return d ? d.score : null;
  };
  const present = BENCHMARK_DOMAINS.filter((d) => score(agent, d) !== null || score(model, d) !== null);
  if (present.length === 0) return null;
  return (
    <div className="space-y-3">
      {present.map((domain) => {
        const a = score(agent, domain);
        const m = score(model, domain);
        return (
          <div key={domain}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-white/60">{DOMAIN_LABELS[domain]}</span>
              <span className="font-mono text-white/40">
                {a !== null ? `${Math.round(a * 100)}` : "—"}
                {model ? ` vs ${m !== null ? Math.round(m * 100) : "—"}` : ""}
              </span>
            </div>
            <div className="space-y-1">
              <Bar value={a} color="var(--color-neon-cyan)" />
              {model ? <Bar value={m} color="rgba(255,255,255,0.35)" /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round((value ?? 0) * 100)}%`, background: color }}
      />
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────

export default function BenchmarksPage() {
  const { showToast, toastElement } = useToast();
  const { suites } = useSuites();
  const { runs, error: runsError } = useBenchmarkRuns();
  const { entries: leaderboard } = useLeaderboard();

  const profilesR = useApiResource<AgentProfile[]>(["agent-profiles-lite"], "/api/agent/profiles", {
    select: (p) => (p as { profiles?: AgentProfile[] } | null)?.profiles,
    fallback: [],
    staleTime: 60_000,
  });
  const modelsR = useApiResource<ModelRecord[]>(["models-lite"], "/api/models", {
    select: (p) => (p as { models?: ModelRecord[] } | null)?.models,
    fallback: [],
    staleTime: 60_000,
  });
  const profiles = profilesR.data ?? [];
  const models = modelsR.data ?? [];

  const [suiteKey, setSuiteKey] = useState("");
  const [profileId, setProfileId] = useState("");
  const [modelId, setModelId] = useState("");
  const [repeats, setRepeats] = useState(3);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // default selections once data arrives
  const effectiveSuite = suiteKey || suites[0]?.key || "";
  const effectiveProfile = profileId || profiles[0]?.id || "";
  const effectiveModel = modelId || models[0]?.id || "";

  const pairRuns = useMemo(
    () => runs.filter((r) => r.pairId && r.pairId === activePairId),
    [runs, activePairId],
  );
  const agentRun = pairRuns.find((r) => r.targetKind === "agent");
  const modelRun = pairRuns.find((r) => r.targetKind === "model");

  // Live progress for in-flight runs (item counts).
  const agentDetail = useBenchmarkRun(agentRun && agentRun.status === "running" ? agentRun.id : null);
  const totalUnits = useMemo(() => {
    const meta = suites.find((s) => s.key === (agentRun?.suiteKey ?? effectiveSuite));
    return meta ? meta.itemCount * (agentRun?.repeats ?? repeats) : 0;
  }, [suites, agentRun, effectiveSuite, repeats]);
  const doneUnits = agentDetail.detail?.results.length ?? 0;

  async function runComparison() {
    if (!effectiveSuite || !effectiveProfile || !effectiveModel) {
      showToast("Pick a suite, an agent profile, and a baseline model.", "error");
      return;
    }
    setStarting(true);
    const profile = profiles.find((p) => p.id === effectiveProfile);
    const model = models.find((m) => m.id === effectiveModel);
    const res = await safeApiCall<{ data?: { pairId?: string } }>("/api/benchmarks/runs", {
      method: "POST",
      body: {
        suiteKey: effectiveSuite,
        mode: "compare",
        repeats,
        agentProfile: effectiveProfile,
        agentLabel: profile?.name ?? effectiveProfile,
        modelRef: effectiveModel,
        modelLabel: model?.name ?? effectiveModel,
      },
    });
    setStarting(false);
    if (!res.ok) {
      showToast(res.error ?? "Failed to start", "error");
      return;
    }
    const pairId = res.data?.data?.pairId ?? null;
    if (pairId) {
      setActivePairId(pairId);
      showToast("Benchmark comparison started.", "success");
    }
  }

  async function cancelRun(id: string) {
    const res = await safeApiCall(`/api/benchmarks/runs/${id}/cancel`, { method: "POST" });
    if (!res.ok) showToast(res.error ?? "Cancel failed", "error");
  }

  async function exportAgentCard() {
    if (!effectiveProfile) {
      showToast("Pick an agent profile first.", "error");
      return;
    }
    const payload = await safeApiCallData<{ card?: unknown }>(
      `/api/benchmarks/agent-card?profile=${encodeURIComponent(effectiveProfile)}&suite=${encodeURIComponent(effectiveSuite)}`,
    );
    if (!payload?.card) {
      showToast("No agent card available.", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(payload.card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-card-${effectiveProfile}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Agent card exported (redacted — no sensitive data).", "success");
  }

  const delta =
    agentRun?.summary && modelRun?.summary
      ? agentRun.summary.overallRating - modelRun.summary.overallRating
      : null;

  const inFlight = pairRuns.some((r) => r.status === "running" || r.status === "pending");

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      {toastElement}
      <PageHeader
        icon={Trophy}
        title="Benchmarks"
        subtitle="Measure your agent's capability and compare it against a bare-model baseline."
        color="purple"
      />

      {runsError ? <LoadErrorBanner error={runsError} /> : null}

      {/* ── Control panel ── */}
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Suite">
            <Select value={effectiveSuite} onChange={setSuiteKey}>
              {suites.map((s) => (
                <option key={s.key} value={s.key}>{s.name} v{s.version} · {s.itemCount} items</option>
              ))}
            </Select>
          </Field>
          <Field label="Agent profile">
            <Select value={effectiveProfile} onChange={setProfileId}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Baseline model">
            <Select value={effectiveModel} onChange={setModelId}>
              {models.length === 0 ? <option value="">No models configured</option> : null}
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Repeats">
            <Select value={String(repeats)} onChange={(v) => setRepeats(Number(v))}>
              {[1, 3, 5].map((n) => (
                <option key={n} value={n}>{n}×</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runComparison}
            disabled={starting || models.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-sm font-medium text-neon-cyan transition hover:bg-neon-cyan/20 disabled:opacity-40"
          >
            <Swords className="h-4 w-4" />
            {starting ? "Starting…" : "Run agent vs baseline"}
          </button>
          <button
            onClick={exportAgentCard}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            <Share2 className="h-4 w-4" />
            Export agent card
          </button>
          {models.length === 0 ? (
            <span className="text-[11px] text-white/40">Add a model in Config → Models to enable the baseline.</span>
          ) : null}
        </div>
      </Card>

      {/* ── Active comparison ── */}
      {activePairId && pairRuns.length > 0 ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/50">
              <Swords className="h-4 w-4 text-neon-cyan" /> Comparison
            </h2>
            {inFlight ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-white/40">
                  {doneUnits > 0 && totalUnits > 0 ? `${doneUnits}/${totalUnits}` : "running…"}
                </span>
                {pairRuns
                  .filter((r) => r.status === "running" || r.status === "pending")
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => cancelRun(r.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:text-neon-orange"
                    >
                      <Square className="h-3 w-3" /> Cancel {r.targetKind}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr]">
            <div className="flex items-center justify-center gap-6">
              <RatingPill run={agentRun} label="Agent" />
              <div className="flex flex-col items-center">
                <span className="text-[11px] uppercase tracking-wider text-white/30">Δ</span>
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: delta === null ? "rgba(255,255,255,0.3)" : delta >= 0 ? "var(--color-neon-green)" : "var(--color-neon-pink)" }}
                >
                  {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}
                </span>
              </div>
              <RatingPill run={modelRun} label="Baseline" />
            </div>
            <div>
              <DomainBars agent={agentRun} model={modelRun} />
              <div className="mt-3 flex items-center gap-4 text-[11px] text-white/40">
                <span className="flex items-center gap-1"><Bot className="h-3 w-3 text-neon-cyan" /> Agent</span>
                <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Baseline</span>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── Leaderboard ── */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/50">
          <Medal className="h-4 w-4 text-neon-yellow" /> Leaderboard
          <span className="text-white/25">· {leaderboard[0]?.rating?.suiteKey ?? effectiveSuite}</span>
        </h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-white/40">No rated agents yet. Run a comparison to put an agent on the board.</p>
        ) : (
          <ol className="space-y-1">
            {leaderboard.map((e) => (
              <li key={e.targetRef} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <span className="flex items-center gap-3">
                  <span className="w-5 text-center font-mono text-xs text-white/40">{e.rank}</span>
                  <Bot className="h-4 w-4 text-neon-cyan" />
                  <span className="text-sm text-white/80">{e.targetLabel}</span>
                  {e.rating?.bestDomain ? (
                    <span className="text-[11px] text-white/30">best: {e.rating.bestDomain.domain}</span>
                  ) : null}
                </span>
                <span className="font-mono text-sm font-bold" style={{ color: e.rating ? ratingColor(e.rating.rating) : "rgba(255,255,255,0.3)" }}>
                  {e.rating ? e.rating.rating : "—"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ── History ── */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/50">
          <Play className="h-4 w-4 text-neon-cyan" /> Recent runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-white/40">No benchmark runs yet. Start a comparison above.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {runs.slice(0, 30).map((r) => (
              <button
                key={r.id}
                onClick={() => r.pairId && setActivePairId(r.pairId)}
                className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  {r.targetKind === "agent" ? <Bot className="h-4 w-4 text-neon-cyan" /> : <Cpu className="h-4 w-4 text-white/40" />}
                  <span className="text-white/80">{r.targetLabel ?? r.targetRef}</span>
                  <span className="text-white/30">· {r.suiteKey} v{r.suiteVersion}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={`font-mono text-[11px] ${statusTone(r.status)}`}>{r.status}</span>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: r.summary ? ratingColor(r.summary.overallRating) : "rgba(255,255,255,0.3)" }}
                  >
                    {r.summary ? r.summary.overallRating : "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── tiny form primitives ─────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-dark-900/80 px-3 py-2 text-sm text-white/90 outline-none focus:border-neon-cyan/40"
    >
      {children}
    </select>
  );
}

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
import { Trophy, Swords, Play, Square, Bot, Cpu, Share2, Medal, ShieldCheck, AlertTriangle, Boxes, Copy } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Button from "@/components/ui/Button";
import { Field, Select, Toggle, ChipGroup } from "@/components/ui/field";
import StatRadar from "@/components/viz/StatRadar";
import { useApiResource } from "@/hooks/useApiResource";
import { useSuites, useBenchmarkRuns, useBenchmarkRun, useLeaderboard, useBenchmarkCatalog, useBenchmarkSetups } from "@/hooks/useBenchmarks";
import type { AgentSetupEntry } from "@/hooks/useBenchmarks";
import { safeApiCall, safeApiCallData } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/Toast";
import { STATS, STAT_LABELS, STAT_BLURB, type BenchmarkRun, type StatCard } from "@/lib/benchmarks/types";
import type { AgentProfile } from "@/types/hermes";
import type { ModelRecord } from "@/lib/models-repository";

type Aug = { skills: boolean; tools: boolean; memory: boolean };

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

/** Brain + augmentation chips for one side of a comparison. */
function UnitChips({ run }: { run: BenchmarkRun | undefined }) {
  if (!run) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">{run.modelLabel ?? "brain"}</span>
      {run.usedSkills ? <Chip label="skills" /> : null}
      {run.usedTools ? <Chip label="tools" /> : null}
      {run.usedMemory ? <Chip label="memory" /> : null}
      {run.execMode === "model" ? <span className="text-[10px] text-white/30">brain only</span> : null}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="rounded bg-neon-cyan/10 px-1.5 py-0.5 text-[10px] text-neon-cyan">{label}</span>;
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
      <UnitChips run={run} />
    </div>
  );
}

/** 6-stat JRPG card comparison (agent cyan vs baseline muted). */
function StatBars({ agent, model }: { agent?: BenchmarkRun; model?: BenchmarkRun }) {
  const stat = (run: BenchmarkRun | undefined, key: string): number | null => {
    const s = run?.summary?.stats as Record<string, number> | undefined;
    return s && typeof s[key] === "number" ? s[key] : null;
  };
  const any = STATS.some((s) => stat(agent, s) !== null || stat(model, s) !== null);
  if (!any) return null;
  return (
    <div className="space-y-3">
      {STATS.map((s) => {
        const a = stat(agent, s);
        const m = stat(model, s);
        return (
          <div key={s} title={STAT_BLURB[s]}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-white/60">
                {STAT_LABELS[s]}
                {(() => {
                  const n = (agent?.summary?.statSamples as Record<string, number> | undefined)?.[s];
                  return typeof n === "number" ? <span className="ml-1.5 text-white/25" title={`backed by ${n} item${n === 1 ? "" : "s"}`}>n={n}</span> : null;
                })()}
              </span>
              <span className="font-mono text-white/40">
                {a !== null ? a : "—"}
                {model ? ` vs ${m !== null ? m : "—"}` : ""}
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

/** Bar value is 0–100 (stat scale). */
function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round(value ?? 0)}%`, background: color }}
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
  const [aug, setAug] = useState<Aug>({ skills: true, tools: true, memory: true });
  const [selSkills, setSelSkills] = useState<string[] | null>(null); // null = all
  const [selTools, setSelTools] = useState<string[] | null>(null); // null = all
  const [baselineMode, setBaselineMode] = useState<"brain" | "model">("brain");
  const { catalog } = useBenchmarkCatalog();
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // default selections once data arrives
  const effectiveSuite = suiteKey || suites[0]?.key || "";
  const effectiveProfile = profileId || profiles[0]?.id || "";
  const effectiveModel = modelId || models[0]?.id || "";
  const { setups } = useBenchmarkSetups(effectiveSuite || undefined);

  const pairRuns = useMemo(
    () => runs.filter((r) => r.pairId && r.pairId === activePairId),
    [runs, activePairId],
  );
  // Classify the pair by ROLE, not targetKind: a "same brain, brain-only"
  // baseline is itself a targetKind:"agent" run, so the old targetKind lookup
  // never found it (Baseline "—"). Prefer the persisted pairRole; fall back to
  // execMode/targetKind for legacy runs created before the role was recorded.
  const { agentRun, modelRun } = useMemo(() => {
    const byRole = (role: "agent" | "baseline") =>
      pairRuns.find((r) => r.config?.pairRole === role);
    const agent =
      byRole("agent") ??
      pairRuns.find((r) => r.execMode === "agentic") ??
      pairRuns.find((r) => r.targetKind === "agent") ??
      pairRuns[0];
    const model =
      byRole("baseline") ??
      pairRuns.find((r) => r.targetKind === "model") ??
      pairRuns.find((r) => r.id !== agent?.id);
    return { agentRun: agent, modelRun: model };
  }, [pairRuns]);

  // Live progress for in-flight runs (item counts).
  const agentDetail = useBenchmarkRun(agentRun && agentRun.status === "running" ? agentRun.id : null);
  const totalUnits = useMemo(() => {
    const meta = suites.find((s) => s.key === (agentRun?.suiteKey ?? effectiveSuite));
    return meta ? meta.itemCount * (agentRun?.repeats ?? repeats) : 0;
  }, [suites, agentRun, effectiveSuite, repeats]);
  const doneUnits = agentDetail.detail?.results.length ?? 0;

  /** Clone a ranked setup into the launch form (profile + augmentation + suite). */
  function cloneSetup(s: AgentSetupEntry) {
    setProfileId(s.profileRef);
    if (s.augmentation) setAug({ skills: s.augmentation.skills, tools: s.augmentation.tools, memory: s.augmentation.memory });
    setSelSkills(null);
    setSelTools(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`Cloned "${s.profileLabel}" setup into the form — review + run.`, "info");
  }

  async function runComparison() {
    if (!effectiveSuite || !effectiveProfile) {
      showToast("Pick a suite and an agent profile.", "error");
      return;
    }
    if (baselineMode === "model" && !effectiveModel) {
      showToast("Pick a baseline model (or switch the baseline to brain-only).", "error");
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
        augmentation: {
          skills: aug.skills,
          tools: aug.tools,
          memory: aug.memory,
          // Explicit per-component selection (null = all of the catalog).
          selectedSkills: aug.skills ? (selSkills ?? catalog.skills.map((s) => s.key)) : [],
          selectedTools: aug.tools ? (selTools ?? catalog.tools.map((t) => t.key)) : [],
        },
        // Baseline: same agent brain-only by default, or a chosen registry model.
        ...(baselineMode === "model"
          ? { modelRef: effectiveModel, modelLabel: model?.name ?? effectiveModel }
          : {}),
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
        subtitle="Benchmark your agent (its LLM + skills/tools/memory) against a brain-only baseline — a JRPG stat card."
        color="purple"
      />

      {runsError ? <LoadErrorBanner error={runsError} /> : null}

      {/* ── Control panel ── */}
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Suite">
            <Select
              ariaLabel="Suite"
              value={effectiveSuite}
              onChange={setSuiteKey}
              options={suites.map((s) => ({ value: s.key, label: `${s.name} v${s.version}`, hint: `${s.itemCount} items` }))}
            />
          </Field>
          <Field label="Agent profile">
            <Select
              ariaLabel="Agent profile"
              value={effectiveProfile}
              onChange={setProfileId}
              options={profiles.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <Field label="Baseline">
            <Select
              ariaLabel="Baseline"
              value={baselineMode === "brain" ? "brain" : effectiveModel}
              onChange={(v) => {
                if (v === "brain") setBaselineMode("brain");
                else {
                  setBaselineMode("model");
                  setModelId(v);
                }
              }}
              options={[
                { value: "brain", label: "Brain-only (same brain)" },
                ...models.map((m) => ({ value: m.id, label: `vs ${m.name}` })),
              ]}
            />
          </Field>
          <Field label="Repeats">
            <Select
              ariaLabel="Repeats"
              value={String(repeats)}
              onChange={(v) => setRepeats(Number(v))}
              options={[1, 3, 5].map((n) => ({ value: String(n), label: `${n}×` }))}
            />
          </Field>
        </div>

        {/* Agent augmentation — toggle off for a brain-only (reliable) run */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Agent augmentation</span>
          <Toggle label="Skills" checked={aug.skills} onChange={(v) => setAug((a) => ({ ...a, skills: v }))} />
          <Toggle label="Tools" checked={aug.tools} onChange={(v) => setAug((a) => ({ ...a, tools: v }))} />
          <Toggle label="Memory" checked={aug.memory} onChange={(v) => setAug((a) => ({ ...a, memory: v }))} />
          <span className="text-[11px] text-white/30">
            {aug.skills || aug.tools || aug.memory ? "agentic run (uses Hermes)" : "brain-only (fast, reliable)"}
          </span>
        </div>

        {/* Per-component selection — pick exactly which seed skills / tools to equip */}
        {aug.skills && catalog.skills.length > 0 ? (
          <div className="mt-2 pl-1">
            <ChipGroup
              label="Skills"
              options={catalog.skills.map((s) => ({ key: s.key, label: s.displayName }))}
              selected={selSkills}
              onChange={setSelSkills}
            />
          </div>
        ) : null}
        {aug.tools && catalog.tools.length > 0 ? (
          <div className="mt-2 pl-1">
            <ChipGroup
              label="Tools"
              options={catalog.tools.map((t) => ({ key: t.key, label: t.displayName }))}
              selected={selTools}
              onChange={setSelTools}
            />
          </div>
        ) : null}

        {/* Empty-catalog guidance — toggled on but nothing seeded to equip. */}
        {aug.skills && catalog.skills.length === 0 ? (
          <p className="mt-2 text-[11px] text-white/30">
            No seed skills available yet — the bundled skill pack hasn&apos;t been seeded.
          </p>
        ) : null}
        {aug.tools && catalog.tools.length === 0 ? (
          <p className="mt-2 text-[11px] text-white/30">
            No seed tool bundles available yet — the tool catalog hasn&apos;t been seeded.
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runComparison}
            disabled={starting}
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

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_auto_1fr]">
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
            <div className="flex items-center justify-center">
              <StatRadar
                card={(agentRun?.summary?.stats as StatCard | undefined) ?? null}
                compare={(modelRun?.summary?.stats as StatCard | undefined) ?? null}
              />
            </div>
            <div>
              <StatBars agent={agentRun} model={modelRun} />
              <div className="mt-3 flex items-center gap-4 text-[11px] text-white/40">
                <span className="flex items-center gap-1"><Bot className="h-3 w-3 text-neon-cyan" /> Agent</span>
                <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Baseline</span>
              </div>
            </div>
          </div>

          {/* Honest failure: a run where (nearly) every item errored is a
              FAILURE, not a low score — surface the reason, not a misleading card. */}
          {[agentRun, modelRun].map((r) =>
            r?.status === "failed" ? (
              <p key={`fail-${r.id}`} className="mt-4 flex items-start gap-2 rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-3 py-2 text-[11px] text-neon-pink/90">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>{r.config?.pairRole === "baseline" ? "Baseline" : "Agent"} run failed:</strong>{" "}
                  {r.error ?? "every item errored or timed out"}
                </span>
              </p>
            ) : r?.status === "completed" && (r.summary?.errorRate ?? 0) > 0.2 ? (
              <p key={`partial-${r.id}`} className="mt-2 text-[11px] text-neon-orange/80">
                {Math.round((r.summary?.errorRate ?? 0) * 100)}% of {r.config?.pairRole === "baseline" ? "baseline" : "agent"} items errored/timed-out — scores are partial.
              </p>
            ) : null,
          )}

          {/* Honesty: did the agentic run truly serve the toggled config, or
              fall back to the shared default agent (no local Hermes gateway)? */}
          {agentRun?.execMode === "agentic" && agentRun?.summary ? (
            agentRun.summary.togglesApplied === false ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-neon-orange/30 bg-neon-orange/5 px-3 py-2 text-[11px] text-neon-orange/90">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Agentic run fell back to the shared default agent — no local Hermes was available to spawn a per-profile gateway, so the skill/tool/memory toggles were not applied.
              </p>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-[11px] text-neon-green/80">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Fair test — a dedicated gateway served exactly the toggled config.
              </p>
            )
          ) : null}
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
                  {e.experience ? (
                    <span className="rounded bg-neon-purple/10 px-1.5 py-0.5 text-[10px] font-mono text-neon-purple/90" title={`${e.experience.xp} XP`}>
                      Lv{e.experience.level.level} · {e.experience.level.title}
                    </span>
                  ) : null}
                  {e.rating?.bestStat ? (
                    <span className="text-[11px] text-white/30">best: {e.rating.bestStat.stat}</span>
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

      {/* ── Agent setups (the local config database) ── */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/50">
          <Boxes className="h-4 w-4 text-neon-green" /> Agent setups
          <span className="text-white/25">· best-rated configurations</span>
        </h2>
        <p className="mb-3 text-[11px] text-white/30">
          Distinct profile + model + augmentation combos ranked by their best benchmark. Clone one to re-run it.
        </p>
        {setups.length === 0 ? (
          <p className="text-sm text-white/40">No setups yet. Run a comparison to record one.</p>
        ) : (
          <ul className="space-y-2">
            {setups.map((s: AgentSetupEntry) => (
              <li
                key={s.runId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-dark-900/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-5 text-center font-mono text-xs text-white/40">{s.rank}</span>
                  <Bot className="h-4 w-4 text-neon-cyan" />
                  <span className="text-sm text-white/85">{s.profileLabel}</span>
                  {s.experience ? (
                    <span className="rounded bg-neon-purple/10 px-1.5 py-0.5 text-[10px] font-mono text-neon-purple/90">
                      Lv{s.experience.level.level}
                    </span>
                  ) : null}
                  {s.augmentation ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-white/40">
                      {(["skills", "tools", "memory"] as const).map((k) => (
                        <span
                          key={k}
                          className={s.augmentation![k] ? "text-neon-green/80" : "text-white/20 line-through"}
                        >
                          {k}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {s.modelId ? <span className="text-[10px] font-mono text-white/25">· {s.modelId}</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold" style={{ color: ratingColor(s.bestRating) }}>
                    {s.bestRating}
                  </span>
                  <Button variant="ghost" color="cyan" size="sm" onClick={() => cloneSetup(s)}>
                    <Copy className="h-3.5 w-3.5" /> Clone
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
                  {r.execMode === "agentic" && r.summary ? (
                    r.summary.togglesApplied === false ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-neon-orange/70" aria-label="fell back to default agent" />
                    ) : r.summary.togglesApplied ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-neon-green/70" aria-label="fair test (dedicated gateway)" />
                    ) : null
                  ) : null}
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


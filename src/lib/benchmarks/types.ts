// ═══════════════════════════════════════════════════════════════
// benchmarks/types.ts — benchmark suite + run/result contracts
//
// Dependency-free (no @/lib/db) so it can be imported by the pure scoring
// engine, the suites, the repository, the runner and the API/Zod layer alike
// without dragging in the Jest db mock.
//
// SUITES (items + answer keys) are authored as version-controlled data in
// src/lib/benchmarks/suites/* — private + diffable + contamination-resistant.
// The DB only stores RUNS and per-item RESULTS.
// ═══════════════════════════════════════════════════════════════

// ── Capability domains (v1: all deterministic / auto-gradable) ──

export type BenchmarkDomain =
  | "maths"
  | "logic"
  | "reasoning"
  | "instruction"
  | "needle"
  | "consistency"
  // Judge-graded (LLM-as-judge) domains.
  | "honesty"
  | "safety";

export const BENCHMARK_DOMAINS: BenchmarkDomain[] = [
  "maths",
  "logic",
  "reasoning",
  "instruction",
  "needle",
  "consistency",
  "honesty",
  "safety",
];

// ── JRPG stat card (the capability headline) ──
// Derived from benchmark results. STR/DEX/INT/WIS are content-driven (items
// tag which they inform); SPEED + FORTITUDE are UNIVERSAL — computed from every
// run's latency/completion/error metadata regardless of content. Designed to
// scale: hundreds of niche suites just tag contributions and merge into one card.

export type Stat = "strength" | "dexterity" | "intelligence" | "wisdom" | "fortitude" | "speed";

export const STATS: Stat[] = ["strength", "dexterity", "intelligence", "wisdom", "fortitude", "speed"];

export const STAT_LABELS: Record<Stat, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  fortitude: "Fortitude",
  speed: "Speed",
};

export const STAT_BLURB: Record<Stat, string> = {
  strength: "Gets the job done — completes and passes tasks",
  dexterity: "Versatile across many different task types",
  intelligence: "Raw reasoning / model intelligence",
  wisdom: "Applies intelligence well (instructions, judgment)",
  fortitude: "Sustains hard tasks, recovers from failures",
  speed: "Fast start→finish (lightly quality-weighted)",
};

/** 0–100 per stat. */
export type StatCard = Record<Stat, number>;

// ── Graders (deterministic; LLM-as-judge added in a later phase) ──

/** How a consistency item extracts a canonical answer from each repeat. */
export type ConsistencyExtract = "mcq" | "numeric" | "normalized";

interface ExactGrader {
  kind: "exact";
  expected: string;
  caseSensitive?: boolean;
}
interface NumericGrader {
  kind: "numeric";
  expected: number;
  /** Absolute tolerance (default 1e-6), or relative when `relative` is true. */
  tolerance?: number;
  relative?: boolean;
}
interface McqGrader {
  kind: "mcq";
  expected: string;
  /** Allowed choice labels (default A–E). */
  choices?: string[];
}
interface ContainsGrader {
  kind: "contains";
  /** All needles must appear in the output to fully pass. */
  needles: string[];
  caseSensitive?: boolean;
}
interface RegexGrader {
  kind: "regex";
  pattern: string;
  flags?: string;
}
interface JsonSchemaGrader {
  kind: "json_schema";
  /** Top-level keys that must be present for a pass. */
  requiredKeys?: string[];
}
interface ConsistencyGrader {
  kind: "consistency";
  extract: ConsistencyExtract;
  /** Allowed choice labels when `extract === "mcq"`. */
  choices?: string[];
}
/**
 * LLM-as-judge: a strong model scores the RESPONSE against a criterion-separated
 * rubric (0..1). For subjective/open-ended/safety/honesty items that no
 * deterministic grader can score. Graded async (score-judge.ts), out of the
 * pure path. A judge failure is recorded as an ERROR (never a false zero).
 */
export interface JudgeGrader {
  kind: "judge";
  /** The rubric the judge applies (what a good answer must do). */
  criteria: string;
  /** Optional reference/ideal answer to ground the judgement. */
  reference?: string;
  /** Pass threshold on the 0..1 judge score (default 0.75). */
  passThreshold?: number;
}

export type Grader =
  | ExactGrader
  | NumericGrader
  | McqGrader
  | ContainsGrader
  | RegexGrader
  | JsonSchemaGrader
  | ConsistencyGrader
  | JudgeGrader;

// ── Suite + item definitions (code, not DB) ──

export interface BenchmarkItem {
  id: string;
  domain: BenchmarkDomain;
  /** The instruction/prompt sent to the target. */
  prompt: string;
  grader: Grader;
  /**
   * Which content stats this item informs (+weight). Only STR/DEX/INT/WIS are
   * tagged here; SPEED + FORTITUDE are universal (from run metadata). Untagged
   * items still feed Strength (completion) + Dexterity (breadth) + the
   * universal stats — they just don't add to Intelligence/Wisdom.
   */
  statTags?: Partial<Record<Stat, number>>;
  meta?: Record<string, unknown>;
}

export interface BenchmarkSuite {
  key: string;
  name: string;
  version: string;
  description: string;
  items: BenchmarkItem[];
}

// ── Run + result records (DB-backed) ──

export type BenchmarkRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type BenchmarkTargetKind = "agent" | "model";

/** How a run actually executed: brain-only (callLLM) vs full agentic (Hermes). */
export type BenchmarkExecMode = "model" | "agentic";

/** Which augmentation layers were enabled for a run (the "body" on the brain). */
export interface AugmentationConfig {
  skills: boolean;
  tools: boolean;
  memory: boolean;
  /** Specific bundled skill keys to equip (overrides the boolean; [] = none). */
  selectedSkills?: string[] | null;
  /** Specific tool-bundle keys to equip (overrides the boolean; [] = none). */
  selectedTools?: string[] | null;
}

/** Resolved configuration recorded on a run (parsed from config_json). */
export interface BenchmarkRunConfig {
  augmentation: AugmentationConfig;
  /** Provider model string of the brain (display/cost). */
  modelString?: string | null;
  /**
   * Role within a compare pair. The baseline of a "same brain, brain-only"
   * comparison is itself a `targetKind:"agent"` run, so the pair MUST be
   * classified by this role, not by targetKind. Absent on legacy/single runs.
   */
  pairRole?: "agent" | "baseline" | null;
}

export interface DomainScore {
  domain: BenchmarkDomain;
  itemCount: number;
  /** 0..1 mean item score for this domain. */
  score: number;
  /** Population variance of the per-item scores (run-to-run/item spread). */
  variance: number;
}

export interface BenchmarkSummary {
  /** 0..100 composite Agent Rating (mean of the 6 stats when present, else domain-weighted). */
  overallRating: number;
  /** 0..1 mean item score across all domains. */
  meanScore: number;
  /** Population variance of all per-item scores. */
  variance: number;
  itemsRun: number;
  repeats: number;
  /** The 6-stat JRPG card (the headline). */
  stats?: StatCard;
  /** How many items back each stat (confidence — more = more stable). */
  statSamples?: Partial<Record<Stat, number>>;
  /** Per-domain detail (internal grouping behind the stats). */
  domains: DomainScore[];
  /** Fraction of (item,repeat) executions that errored/timed-out. */
  errorRate?: number;
  totalCostUsd?: number;
  avgLatencyMs?: number;
  /**
   * Agentic runs only: true when a dedicated gateway served the toggled config
   * (a true fair test), false when it fell back to the shared default agent
   * (no local hermes binary). Undefined for brain-only runs.
   */
  togglesApplied?: boolean;
}

export interface BenchmarkRun {
  id: string;
  suiteKey: string;
  suiteVersion: string;
  targetKind: BenchmarkTargetKind;
  targetRef: string;
  targetLabel: string | null;
  repeats: number;
  seed: string | null;
  status: BenchmarkRunStatus;
  /** Groups an agent+model compare pair so the report can show the delta. */
  pairId: string | null;
  // ── the (Agent + LLM) unit + augmentation tags (migration 015) ──
  /** Registry model id of the brain this run used. */
  modelId: string | null;
  /** Display label for the brain. */
  modelLabel: string | null;
  /** Brain-only (callLLM) vs full agentic (Hermes). */
  execMode: BenchmarkExecMode | null;
  usedSkills: boolean | null;
  usedTools: boolean | null;
  usedMemory: boolean | null;
  config: BenchmarkRunConfig | null;
  summary: BenchmarkSummary | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkItemResult {
  id: string;
  benchmarkRunId: string;
  itemId: string;
  domain: BenchmarkDomain;
  repeatIndex: number;
  inputRunId: string | null;
  rawOutput: string | null;
  score: number | null;
  passed: boolean | null;
  grader: string | null;
  graderDetail: Record<string, unknown> | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  /** Skills observed/active for this item (tags, not exhaustive). */
  skillsUsed: string[] | null;
  /** Tools observed/active for this item (tags, not exhaustive). */
  toolsUsed: string[] | null;
  memoryUsed: boolean | null;
  createdAt: string;
}

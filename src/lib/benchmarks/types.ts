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
  | "consistency";

export const BENCHMARK_DOMAINS: BenchmarkDomain[] = [
  "maths",
  "logic",
  "reasoning",
  "instruction",
  "needle",
  "consistency",
];

export const DOMAIN_LABELS: Record<BenchmarkDomain, string> = {
  maths: "Maths",
  logic: "Logic",
  reasoning: "Reasoning",
  instruction: "Instruction-following",
  needle: "Needle-in-a-haystack",
  consistency: "Consistency",
};

// ── Graders (deterministic; LLM-as-judge added in a later phase) ──

export type GraderKind =
  | "exact"
  | "numeric"
  | "mcq"
  | "contains"
  | "regex"
  | "json_schema"
  | "consistency";

/** How a consistency item extracts a canonical answer from each repeat. */
export type ConsistencyExtract = "mcq" | "numeric" | "normalized";

export interface ExactGrader {
  kind: "exact";
  expected: string;
  caseSensitive?: boolean;
}
export interface NumericGrader {
  kind: "numeric";
  expected: number;
  /** Absolute tolerance (default 1e-6), or relative when `relative` is true. */
  tolerance?: number;
  relative?: boolean;
}
export interface McqGrader {
  kind: "mcq";
  expected: string;
  /** Allowed choice labels (default A–E). */
  choices?: string[];
}
export interface ContainsGrader {
  kind: "contains";
  /** All needles must appear in the output to fully pass. */
  needles: string[];
  caseSensitive?: boolean;
}
export interface RegexGrader {
  kind: "regex";
  pattern: string;
  flags?: string;
}
export interface JsonSchemaGrader {
  kind: "json_schema";
  /** Top-level keys that must be present for a pass. */
  requiredKeys?: string[];
}
export interface ConsistencyGrader {
  kind: "consistency";
  extract: ConsistencyExtract;
  /** Allowed choice labels when `extract === "mcq"`. */
  choices?: string[];
}

export type Grader =
  | ExactGrader
  | NumericGrader
  | McqGrader
  | ContainsGrader
  | RegexGrader
  | JsonSchemaGrader
  | ConsistencyGrader;

// ── Suite + item definitions (code, not DB) ──

export interface BenchmarkItem {
  id: string;
  domain: BenchmarkDomain;
  /** The instruction/prompt sent to the target. */
  prompt: string;
  grader: Grader;
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

export interface DomainScore {
  domain: BenchmarkDomain;
  itemCount: number;
  /** 0..1 mean item score for this domain. */
  score: number;
  /** Population variance of the per-item scores (run-to-run/item spread). */
  variance: number;
}

export interface BenchmarkSummary {
  /** 0..100 composite Agent Rating (domain-weighted mean × 100). */
  overallRating: number;
  /** 0..1 mean item score across all domains. */
  meanScore: number;
  /** Population variance of all per-item scores. */
  variance: number;
  itemsRun: number;
  repeats: number;
  domains: DomainScore[];
  totalCostUsd?: number;
  avgLatencyMs?: number;
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
  createdAt: string;
}

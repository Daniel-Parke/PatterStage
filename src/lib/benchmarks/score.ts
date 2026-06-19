// ═══════════════════════════════════════════════════════════════
// benchmarks/score.ts — pure grading + aggregation engine
//
// No DB, no IO — every function is deterministic so it can be unit-tested
// directly (mirrors stats/derive.ts). The runner feeds raw outputs in;
// gradeOutput() scores one (item, repeat); summarize() rolls per-item /
// per-domain scores up into a BenchmarkSummary (per-domain mean + variance +
// a 0–100 overall Agent Rating).
//
// Most graders score a single output independently. CONSISTENCY is the
// exception: a per-repeat output cannot be scored alone — instead each repeat
// contributes a CANONICAL answer, and the item score is the modal-agreement
// fraction across its repeats (computed in summarize()).
// ═══════════════════════════════════════════════════════════════

import type { ItemMetrics } from "./metrics";
import type {
  BenchmarkDomain,
  BenchmarkSummary,
  ConsistencyExtract,
  DomainScore,
  Grader,
  Stat,
} from "./types";
import { BENCHMARK_DOMAINS } from "./types";

export interface GradeResult {
  /** 0..1 per-repeat score, or null when deferred to aggregation (consistency). */
  score: number | null;
  passed: boolean | null;
  /** Extracted canonical answer (consistency agreement + transparency). */
  canonical: string | null;
  detail: Record<string, unknown>;
}

// ── Text / answer extraction helpers ─────────────────────────

/** Collapse whitespace, trim, optionally case-fold. */
export function normalizeText(s: string, caseSensitive = false): string {
  const t = s.replace(/\s+/g, " ").trim();
  return caseSensitive ? t : t.toLowerCase();
}

/**
 * Lenient canonical form: normalized + repeatedly stripped wrapping quotes and
 * trailing sentence punctuation (so "Tokyo." / "\"Tokyo\"." / "Tokyo" all
 * collapse to the same token). Used by the CONSISTENCY normalizer, where the
 * goal is agreement, not strict format compliance. The strict `exact` grader
 * deliberately does NOT use this (format-compliance items must reject stray
 * punctuation).
 */
export function canonicalExact(s: string, caseSensitive = false): string {
  let t = normalizeText(s, caseSensitive);
  let prev: string;
  do {
    prev = t;
    t = t
      .replace(/^["'`]+/, "")
      .replace(/["'`]+$/, "")
      .replace(/[.!]+$/, "")
      .trim();
  } while (t !== prev);
  return t;
}

/** Last number in the text (handles "the answer is 42." and "1,234.5"). */
export function extractNumber(s: string): number | null {
  const cleaned = s.replace(/(\d),(?=\d{3}\b)/g, "$1");
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const n = Number(matches[matches.length - 1]);
  return Number.isFinite(n) ? n : null;
}

/** Extract a single MCQ choice label, preferring answer markers, then last standalone. */
export function extractMcq(output: string, choices?: string[]): string | null {
  const allowed = (choices ?? ["A", "B", "C", "D", "E"]).map((c) => c.toUpperCase());
  const cls = allowed.map((c) => escapeRegex(c)).join("");
  const up = output.toUpperCase();
  // Tier 1 — explicit answer marker ("answer is B", "answer: B").
  const marked = up.match(new RegExp(`ANSWER\\b[^A-Z0-9]{0,15}([${cls}])\\b`));
  if (marked) return marked[1];
  // Tier 2 — parenthesised / punctuated choice ("(B)", "B)", "B.", "B:").
  const paren = up.match(new RegExp(`\\(([${cls}])\\)`));
  if (paren) return paren[1];
  const punct = up.match(new RegExp(`\\b([${cls}])[).:]`));
  if (punct) return punct[1];
  // Tier 3 — last standalone allowed letter (final answers tend to come last).
  const all = up.match(new RegExp(`\\b[${cls}]\\b`, "g"));
  if (all && all.length > 0) return all[all.length - 1];
  return null;
}

/** Best-effort JSON parse: direct, then a fenced ```json block, then first {...}. */
export function tryParseJson(output: string): unknown {
  const attempts: string[] = [output];
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1]);
  const braced = output.match(/\{[\s\S]*\}/);
  if (braced) attempts.push(braced[0]);
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractCanonical(extract: ConsistencyExtract, output: string, choices?: string[]): string | null {
  switch (extract) {
    case "mcq":
      return extractMcq(output, choices);
    case "numeric": {
      const n = extractNumber(output);
      return n === null ? null : String(n);
    }
    case "normalized":
      return canonicalExact(output) || null;
  }
}

// ── Grade one (item, repeat) output ──────────────────────────

export function gradeOutput(grader: Grader, output: string): GradeResult {
  switch (grader.kind) {
    case "exact": {
      // Strict (format-compliance): trim + collapse whitespace + optional case
      // fold only — no punctuation stripping, so "READY." fails "READY".
      const got = normalizeText(output, grader.caseSensitive);
      const exp = normalizeText(grader.expected, grader.caseSensitive);
      const passed = got === exp;
      return { score: passed ? 1 : 0, passed, canonical: got, detail: { expected: exp, got } };
    }
    case "numeric": {
      const got = extractNumber(output);
      if (got === null) {
        return { score: 0, passed: false, canonical: null, detail: { reason: "no number found" } };
      }
      const tol = grader.tolerance ?? 1e-6;
      const diff = Math.abs(got - grader.expected);
      const limit = grader.relative ? Math.abs(grader.expected) * tol : tol;
      const passed = diff <= limit;
      return {
        score: passed ? 1 : 0,
        passed,
        canonical: String(got),
        detail: { expected: grader.expected, got, diff, limit },
      };
    }
    case "mcq": {
      const got = extractMcq(output, grader.choices);
      const exp = grader.expected.toUpperCase();
      const passed = got === exp;
      return { score: passed ? 1 : 0, passed, canonical: got, detail: { expected: exp, got } };
    }
    case "contains": {
      const hay = normalizeText(output, grader.caseSensitive);
      const present = grader.needles.map((n) => ({
        needle: n,
        found: hay.includes(normalizeText(n, grader.caseSensitive)),
      }));
      const hits = present.filter((p) => p.found).length;
      const total = grader.needles.length;
      const passed = total > 0 && hits === total;
      return {
        score: total > 0 ? hits / total : 0,
        passed,
        canonical: null,
        detail: { present, hits, total },
      };
    }
    case "regex": {
      let passed = false;
      try {
        passed = new RegExp(grader.pattern, grader.flags).test(output);
      } catch {
        // invalid pattern → fail closed
      }
      return { score: passed ? 1 : 0, passed, canonical: null, detail: { pattern: grader.pattern } };
    }
    case "json_schema": {
      const parsed = tryParseJson(output);
      if (parsed === undefined) {
        return { score: 0, passed: false, canonical: null, detail: { reason: "not valid JSON" } };
      }
      const req = grader.requiredKeys ?? [];
      const missing = req.filter((k) => !(isPlainObject(parsed) && k in parsed));
      const passed = missing.length === 0;
      return { score: passed ? 1 : 0, passed, canonical: null, detail: { requiredKeys: req, missing } };
    }
    case "consistency": {
      const canonical = extractCanonical(grader.extract, output, grader.choices);
      // Score is deferred to aggregation (modal agreement across repeats).
      return { score: null, passed: null, canonical, detail: { extract: grader.extract, canonical } };
    }
  }
}

// ── Aggregation ──────────────────────────────────────────────

export interface ResultForAgg {
  domain: BenchmarkDomain;
  itemId: string;
  /** Per-repeat score (null for consistency). */
  score: number | null;
  /** Canonical answer (used by consistency agreement). */
  canonical: string | null;
  // ── extra signals for the JRPG stat engine (stats.ts) ──
  /** Which content stats this item informs (+weight). */
  statTags?: Partial<Record<Stat, number>>;
  /** Wall-clock latency for this (item,repeat). */
  latencyMs?: number | null;
  /** Whether this execution errored / timed out (feeds Fortitude). */
  errored?: boolean;
  /** Agentic trajectory metrics (tool calls, recovery, steps); null brain-only. */
  metrics?: ItemMetrics | null;
}

/** Per-domain weight in the overall Agent Rating (equal by default). */
export const DOMAIN_WEIGHTS: Record<BenchmarkDomain, number> = {
  maths: 1,
  logic: 1,
  reasoning: 1,
  instruction: 1,
  needle: 1,
  consistency: 1,
};

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function populationVariance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

/** Fraction of canonical answers that agree with the modal answer (0 when none extracted). */
export function modalAgreement(canonicals: Array<string | null>): number {
  const valid = canonicals.filter((c): c is string => c !== null && c !== "");
  if (valid.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const c of valid) counts.set(c, (counts.get(c) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return top / valid.length;
}

export interface SummarizeOptions {
  totalCostUsd?: number;
  avgLatencyMs?: number;
}

/**
 * Roll per-(item,repeat) results up into a BenchmarkSummary. For every domain
 * the score is the mean of its item scores; an item score is the mean of its
 * per-repeat scores (deterministic domains) or the modal-agreement fraction
 * across its repeats (consistency). The overall Agent Rating is the
 * domain-weighted mean × 100.
 */
export function summarize(
  results: ResultForAgg[],
  repeats: number,
  opts: SummarizeOptions = {},
): BenchmarkSummary {
  // domain → itemId → results
  const byDomain = new Map<BenchmarkDomain, Map<string, ResultForAgg[]>>();
  for (const r of results) {
    let items = byDomain.get(r.domain);
    if (!items) {
      items = new Map();
      byDomain.set(r.domain, items);
    }
    const bucket = items.get(r.itemId) ?? [];
    bucket.push(r);
    items.set(r.itemId, bucket);
  }

  const domains: DomainScore[] = [];
  const allItemScores: number[] = [];

  for (const domain of BENCHMARK_DOMAINS) {
    const items = byDomain.get(domain);
    if (!items || items.size === 0) continue;
    const itemScores: number[] = [];
    for (const bucket of items.values()) {
      const itemScore =
        domain === "consistency"
          ? modalAgreement(bucket.map((b) => b.canonical))
          : mean(bucket.map((b) => b.score).filter((s): s is number => s !== null));
      itemScores.push(itemScore);
      allItemScores.push(itemScore);
    }
    domains.push({
      domain,
      itemCount: itemScores.length,
      score: mean(itemScores),
      variance: populationVariance(itemScores),
    });
  }

  // Domain-weighted overall (only over domains that actually ran).
  const weightSum = domains.reduce((a, d) => a + DOMAIN_WEIGHTS[d.domain], 0);
  const weighted = domains.reduce((a, d) => a + DOMAIN_WEIGHTS[d.domain] * d.score, 0);
  const meanScore = weightSum > 0 ? weighted / weightSum : 0;

  const itemCount = domains.reduce((a, d) => a + d.itemCount, 0);

  return {
    overallRating: Math.round(meanScore * 100),
    meanScore,
    variance: populationVariance(allItemScores),
    itemsRun: itemCount,
    repeats,
    domains,
    totalCostUsd: opts.totalCostUsd,
    avgLatencyMs: opts.avgLatencyMs,
  };
}

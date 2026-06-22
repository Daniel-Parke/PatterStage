// ═══════════════════════════════════════════════════════════════
// suites/core-capabilities-v1.ts — first private benchmark suite
//
// ORIGINAL, version-controlled items (NOT lifted from public datasets) so the
// suite stays contamination-resistant and the answer keys never ship to the
// browser. v1 covers only deterministic, auto-gradable domains; LLM-as-judge
// domains (honesty/safety/open-ended) arrive in a later phase.
//
// Keep items small but real — a handful per domain — so a full run is quick
// and cheap while still discriminating between a bare model and a configured
// agent. Bump `version` (and add items) rather than editing answers in place,
// so historical runs stay reproducible.
// ═══════════════════════════════════════════════════════════════

import type { BenchmarkDomain, BenchmarkItem, BenchmarkSuite, Stat } from "../types";

// Default content-stat contributions per domain (Speed + Fortitude are universal
// and computed from run metadata, so they are not tagged here). Applied to each
// item unless it sets its own `statTags`.
const DOMAIN_STAT_DEFAULTS: Record<BenchmarkDomain, Partial<Record<Stat, number>>> = {
  maths: { intelligence: 1 },
  logic: { intelligence: 1 },
  reasoning: { intelligence: 0.7, wisdom: 0.3 },
  instruction: { wisdom: 1, strength: 0.3 },
  needle: { intelligence: 0.6, wisdom: 0.4 },
  consistency: {},
  honesty: { wisdom: 1 },
  safety: { wisdom: 1 },
};

/**
 * Build a long "log" haystack with a single planted fact, varying its position
 * (start / middle / end) to probe the lost-in-the-middle effect. Deterministic.
 */
function haystack(fact: string, position: "start" | "middle" | "end"): string {
  const pool = [
    "The quarterly logistics review noted no major disruptions across the network.",
    "Rainfall in the northern depots stayed within seasonal norms this period.",
    "Routine calibration of the conveyor sensors completed without incident.",
    "Staff rotations were unchanged and overtime remained below the threshold.",
    "The cafeteria switched suppliers for coffee but kept the same menu.",
    "A minor firmware update was scheduled for the loading-bay scanners.",
    "Energy usage tracked slightly under forecast for the second week running.",
    "The visitor log showed typical traffic with no flagged entries.",
    "Maintenance reported that the backup generator passed its monthly test.",
    "Inventory counts reconciled cleanly against the previous cycle.",
  ];
  const N = 48;
  const insertAt = position === "start" ? 4 : position === "middle" ? Math.floor(N / 2) : N - 4;
  const lines: string[] = [];
  for (let i = 0; i < N; i++) {
    if (i === insertAt) lines.push(`(${i + 1}) ${fact}`);
    else lines.push(`(${i + 1}) ${pool[i % pool.length]}`);
  }
  return lines.join("\n");
}

function needleItem(
  id: string,
  fact: string,
  question: string,
  needle: string,
  position: "start" | "middle" | "end",
): BenchmarkItem {
  return {
    id,
    domain: "needle",
    prompt:
      `Read the following operations log carefully, then answer the question.\n\n` +
      `<log>\n${haystack(fact, position)}\n</log>\n\n` +
      `Question: ${question}\nAnswer with just the value, nothing else.`,
    grader: { kind: "contains", needles: [needle] },
    meta: { position },
  };
}

const items: BenchmarkItem[] = [
  // ── Maths (numeric) ──
  {
    id: "maths-tank-drain",
    domain: "maths",
    prompt: "A water tank holds 240 litres and drains at 8 litres per minute. How many minutes until it is empty? Reply with just the number.",
    grader: { kind: "numeric", expected: 30 },
  },
  {
    id: "maths-widget-rate",
    domain: "maths",
    prompt: "A machine makes 18 widgets every 4 minutes. How many widgets does it make in one hour? Reply with just the number.",
    grader: { kind: "numeric", expected: 270 },
  },
  {
    id: "maths-rect-area",
    domain: "maths",
    prompt: "A rectangle is 14 cm by 9 cm. What is its area in square centimetres? Reply with just the number.",
    grader: { kind: "numeric", expected: 126 },
  },
  {
    id: "maths-order-of-ops",
    domain: "maths",
    prompt: "Compute 7 + 6 × 4 − 5. Reply with just the number.",
    grader: { kind: "numeric", expected: 26 },
  },

  // ── Logic (MCQ) ──
  {
    id: "logic-illicit-some",
    domain: "logic",
    prompt:
      "All gribbles are mottled. Some mottled things are loud. Does it follow that some gribbles are loud?\n" +
      "A) Yes, necessarily  B) No, not necessarily\nAnswer with just the letter.",
    grader: { kind: "mcq", expected: "B", choices: ["A", "B"] },
  },
  {
    id: "logic-modus-tollens",
    domain: "logic",
    prompt:
      "If it rained, then the ground is wet. The ground is not wet. Therefore:\n" +
      "A) It rained  B) It did not rain  C) Cannot be determined\nAnswer with just the letter.",
    grader: { kind: "mcq", expected: "B", choices: ["A", "B", "C"] },
  },
  {
    id: "logic-ordering",
    domain: "logic",
    prompt:
      "In a left-to-right line, X is immediately left of Y, and Z is immediately left of X. What is the order left to right?\n" +
      "A) Z X Y  B) X Y Z  C) Y X Z\nAnswer with just the letter.",
    grader: { kind: "mcq", expected: "A", choices: ["A", "B", "C"] },
  },

  // ── Reasoning (multi-step; numeric + MCQ) ──
  {
    id: "reasoning-change",
    domain: "reasoning",
    prompt:
      "A shop sells pens at 3 for £1.20. Marco buys 7 pens and pays with a £5 note. How much change does he get, in pounds? Reply with just the number.",
    grader: { kind: "numeric", expected: 2.2, tolerance: 0.001 },
  },
  {
    id: "reasoning-sequence",
    domain: "reasoning",
    prompt: "Consider the sequence 2, 6, 12, 20, 30, … What is the next term? Reply with just the number.",
    grader: { kind: "numeric", expected: 42 },
  },
  {
    id: "reasoning-ages",
    domain: "reasoning",
    prompt:
      "Tom is older than Jane. Jane is older than Sam. Sam is older than Lee. Who is the second youngest?\n" +
      "A) Sam  B) Jane  C) Lee\nAnswer with just the letter.",
    grader: { kind: "mcq", expected: "A", choices: ["A", "B", "C"] },
  },

  // ── Instruction-following (format compliance) ──
  {
    id: "instruction-json",
    domain: "instruction",
    prompt:
      'Return ONLY a JSON object (no markdown fences, no prose) with keys "name" (string) and "age" (number) describing a person named Ada who is 36. Output nothing else.',
    grader: { kind: "json_schema", requiredKeys: ["name", "age"] },
  },
  {
    id: "instruction-exact-word",
    domain: "instruction",
    prompt: "Reply with exactly the single word READY in uppercase, with no punctuation and nothing else.",
    grader: { kind: "exact", expected: "READY", caseSensitive: true },
  },
  {
    id: "instruction-csv",
    domain: "instruction",
    prompt:
      "Output the first three prime numbers as a comma-separated list with no spaces (for example a,b,c). Output only that list and nothing else.",
    grader: { kind: "regex", pattern: "^\\s*2,3,5\\s*$" },
  },

  // ── Needle-in-a-haystack (planted-fact retrieval; varied position) ──
  needleItem(
    "needle-vault-code",
    "Note: the access code for vault 7 is TANGERINE-49.",
    "What is the access code for vault 7?",
    "TANGERINE-49",
    "middle",
  ),
  needleItem(
    "needle-ticket",
    "Reminder: incident ticket OPS-3382 was escalated to the night shift.",
    "Which incident ticket was escalated to the night shift?",
    "OPS-3382",
    "start",
  ),
  needleItem(
    "needle-pallet",
    "Flag: pallet number Z-7741 was quarantined pending inspection.",
    "Which pallet number was quarantined pending inspection?",
    "Z-7741",
    "end",
  ),

  // ── Consistency (self-agreement across repeats) ──
  {
    id: "consistency-product",
    domain: "consistency",
    prompt: "What is 24 × 17? Reply with just the number.",
    grader: { kind: "consistency", extract: "numeric" },
  },
  {
    id: "consistency-capital",
    domain: "consistency",
    prompt: "What is the capital city of Japan? Reply with just the city name.",
    grader: { kind: "consistency", extract: "normalized" },
  },
  {
    id: "consistency-fraction",
    domain: "consistency",
    prompt: "Which is larger? A) 3/8  B) 5/16\nAnswer with just the letter.",
    grader: { kind: "consistency", extract: "mcq", choices: ["A", "B"] },
  },
];

export const coreCapabilitiesV1: BenchmarkSuite = {
  key: "core-capabilities",
  name: "Core Capabilities",
  version: "1.0.0",
  difficulty: "smoke",
  description:
    "A quick smoke test: deterministic, auto-graded basics across maths, logic, instruction-following, retrieval and self-consistency. Fast to run and easy — even mid-tier models score high here, so use Frontier to actually discriminate quality.",
  // Apply per-domain content-stat tags unless the item set its own.
  items: items.map((it) => ({ ...it, statTags: it.statTags ?? DOMAIN_STAT_DEFAULTS[it.domain] })),
};

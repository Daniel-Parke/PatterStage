// ═══════════════════════════════════════════════════════════════
// suites/applied-capabilities-v1.ts — second deterministic suite
//
// Original, version-controlled items (NOT from public datasets) that broaden the
// per-stat sample size so each of the 6 JRPG stats has enough observations for a
// stable mean + variance. Same deterministic/auto-gradable contract as
// core-capabilities-v1; answers are double-checked and unambiguous.
// ═══════════════════════════════════════════════════════════════

import type { BenchmarkDomain, BenchmarkItem, BenchmarkSuite, Stat } from "../types";

// Content-stat contributions per domain (Speed + Fortitude are universal).
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

function item(
  id: string,
  domain: BenchmarkDomain,
  prompt: string,
  grader: BenchmarkItem["grader"],
): BenchmarkItem {
  return { id, domain, prompt, grader, statTags: DOMAIN_STAT_DEFAULTS[domain] };
}

const NUM = (n: number, tol = 1e-6): BenchmarkItem["grader"] => ({ kind: "numeric", expected: n, tolerance: tol });

const items: BenchmarkItem[] = [
  // ── maths (numeric, unambiguous) ──
  item("ac-m1", "maths", "A train travels 60 km in 45 minutes. What is its average speed in km/h? Answer with just the number.", NUM(80)),
  item("ac-m2", "maths", "What is 15% of 240? Answer with just the number.", NUM(36)),
  item("ac-m3", "maths", "A rectangle has length 12 and width 7. What is its perimeter? Answer with just the number.", NUM(38)),
  item("ac-m4", "maths", "A shirt costs $40 and is discounted by 25%. What is the sale price in dollars? Answer with just the number.", NUM(30)),
  item("ac-m5", "maths", "A book has 200 pages. You read one quarter of it on Monday and half of the remainder on Tuesday. How many pages are left? Answer with just the number.", NUM(75)),

  // ── logic (mcq, single clear answer) ──
  item("ac-l1", "logic", "All cats are mammals. All mammals are animals. Which statement must be true? (A) All animals are cats (B) All cats are animals (C) No cats are animals (D) Some mammals are not animals. Answer with the letter only.", { kind: "mcq", expected: "B" }),
  item("ac-l2", "logic", "If it is raining then the ground is wet. The ground is NOT wet. What can we conclude? (A) It is raining (B) It is not raining (C) The ground will never be wet (D) Nothing can be concluded. Answer with the letter only.", { kind: "mcq", expected: "B" }),
  item("ac-l3", "logic", "Five people finish a race. Anna beats Ben. Ben beats Cara. Dan beats Anna. Cara beats Eve. Who finished last? (A) Anna (B) Ben (C) Cara (D) Eve. Answer with the letter only.", { kind: "mcq", expected: "D" }),

  // ── reasoning (multi-step → numeric) ──
  item("ac-r1", "reasoning", "Tom has twice as many apples as Sara. Together they have 18 apples. How many apples does Tom have? Answer with just the number.", NUM(12)),
  item("ac-r2", "reasoning", "A water tank fills at 5 litres per minute and drains at 2 litres per minute. Starting empty, how many minutes until it holds 30 litres? Answer with just the number.", NUM(10)),
  item("ac-r3", "reasoning", "If today is Wednesday, what day of the week will it be in 10 days? Answer with just the day name.", { kind: "contains", needles: ["Saturday"] }),

  // ── instruction-following (format compliance) ──
  item("ac-i1", "instruction", "Reply with exactly the word READY and nothing else.", { kind: "exact", expected: "READY" }),
  item("ac-i2", "instruction", "Output a single JSON object with exactly the keys \"name\" and \"age\". Use any values. Output only the JSON.", { kind: "json_schema", requiredKeys: ["name", "age"] }),
  item("ac-i3", "instruction", "Respond with exactly three words separated by single spaces, no punctuation. Any three words are fine.", { kind: "regex", pattern: "^\\w+\\s\\w+\\s\\w+$" }),
  item("ac-i4", "instruction", "List the first three positive even numbers as a comma-separated list with no spaces, e.g. 2,4,6. Output only the list.", { kind: "exact", expected: "2,4,6" }),

  // ── needle-in-a-haystack (planted fact) ──
  item(
    "ac-n1",
    "needle",
    "Read the following notes and answer the question.\n\n<notes>\n" +
      ["Quarterly figures were within forecast.", "The new badge printer was installed on level 2.", "The maintenance access code is ZF-4417.", "Coffee supplier was changed but the menu is unchanged.", "Visitor numbers were typical for the season."].join("\n") +
      "\n</notes>\n\nQuestion: What is the maintenance access code? Answer with just the code.",
    { kind: "contains", needles: ["ZF-4417"] },
  ),

  // ── consistency (same deterministic answer across repeats) ──
  item("ac-c1", "consistency", "What is the capital of France? Answer with just the city name.", { kind: "consistency", extract: "normalized" }),
  item("ac-c2", "consistency", "What is 7 multiplied by 8? Answer with just the number.", { kind: "consistency", extract: "numeric" }),
];

export const appliedCapabilitiesV1: BenchmarkSuite = {
  key: "applied-capabilities",
  name: "Applied Capabilities",
  version: "1.0.0",
  description: "A second deterministic battery (maths, logic, multi-step reasoning, instruction-following, retrieval, consistency) that broadens per-stat sample size for a more stable card.",
  items,
};

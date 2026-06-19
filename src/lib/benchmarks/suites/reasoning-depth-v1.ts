// ═══════════════════════════════════════════════════════════════
// suites/reasoning-depth-v1.ts — harder multi-step reasoning (a 2nd suite)
//
// Original, deterministic items that probe deeper reasoning than the core
// suite. Demonstrates the framework scaling to many suites: the holistic stat
// card merges this suite's card with Core Capabilities (and any future niche
// suites) into one per-agent card.
// ═══════════════════════════════════════════════════════════════

import type { BenchmarkDomain, BenchmarkItem, BenchmarkSuite, Stat } from "../types";

const DOMAIN_STAT_DEFAULTS: Record<BenchmarkDomain, Partial<Record<Stat, number>>> = {
  maths: { intelligence: 1 },
  logic: { intelligence: 1 },
  reasoning: { intelligence: 0.7, wisdom: 0.3 },
  instruction: { wisdom: 1, strength: 0.3 },
  needle: { intelligence: 0.6, wisdom: 0.4 },
  consistency: {},
};

const items: BenchmarkItem[] = [
  {
    id: "rd-water-jug",
    domain: "reasoning",
    prompt:
      "You have a 5-litre jug and a 3-litre jug and unlimited water. Measure exactly 4 litres in the 5-litre jug. How many litres are in the 5-litre jug at the end? Reply with just the number.",
    grader: { kind: "numeric", expected: 4 },
  },
  {
    id: "rd-day-of-week",
    domain: "reasoning",
    prompt: "If today is Wednesday, what day of the week will it be 100 days from now? Reply with just the day name.",
    grader: { kind: "exact", expected: "Friday" },
  },
  {
    id: "rd-snail-well",
    domain: "reasoning",
    prompt:
      "A snail climbs 3 metres up a 10-metre well each day and slips back 2 metres each night. On which day does it first reach the top? Reply with just the number.",
    grader: { kind: "numeric", expected: 8 },
  },
  {
    id: "rd-clock-angle",
    domain: "maths",
    prompt:
      "A clock reads 3:15. What is the smaller angle, in degrees, between the hour hand and the minute hand? Reply with just the number.",
    grader: { kind: "numeric", expected: 7.5, tolerance: 0.1 },
  },
  {
    id: "rd-syllogism",
    domain: "logic",
    prompt:
      "All Bloops are Razzies. No Razzies are Lazzies. Therefore:\nA) Some Bloops are Lazzies  B) No Bloops are Lazzies  C) Cannot be determined\nAnswer with just the letter.",
    grader: { kind: "mcq", expected: "B", choices: ["A", "B", "C"] },
  },
  {
    id: "rd-train-meet",
    domain: "maths",
    prompt:
      "Two trains are 300 km apart on the same track heading toward each other. One travels at 70 km/h, the other at 80 km/h. After how many hours do they meet? Reply with just the number.",
    grader: { kind: "numeric", expected: 2 },
  },
];

export const reasoningDepthV1: BenchmarkSuite = {
  key: "reasoning-depth",
  name: "Reasoning Depth",
  version: "1.0.0",
  description: "Harder multi-step maths, logic, and lateral-reasoning puzzles with deterministic answers.",
  items: items.map((it) => ({ ...it, statTags: it.statTags ?? DOMAIN_STAT_DEFAULTS[it.domain] })),
};

/** @jest-environment node */
// Pure grading + aggregation engine (benchmarks/score.ts) + suite answer-key sanity.

import {
  gradeOutput,
  summarize,
  normalizeText,
  canonicalExact,
  extractNumber,
  extractMcq,
  tryParseJson,
  modalAgreement,
  type ResultForAgg,
} from "@/lib/benchmarks/score";
import { coreCapabilitiesV1 } from "@/lib/benchmarks/suites/core-capabilities-v1";
import type { Grader } from "@/lib/benchmarks/types";

describe("extraction helpers", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeText("  Hello   World ")).toBe("hello world");
    expect(normalizeText("Hello", true)).toBe("Hello");
  });

  it("canonicalizes for exact match (quotes + trailing period)", () => {
    expect(canonicalExact('"Tokyo".')).toBe("tokyo");
    expect(canonicalExact("READY", true)).toBe("READY");
  });

  it("extracts the last number, ignoring thousands separators", () => {
    expect(extractNumber("The answer is 42.")).toBe(42);
    expect(extractNumber("first 7 then finally 1,234.5")).toBe(1234.5);
    expect(extractNumber("no digits here")).toBeNull();
  });

  it("extracts MCQ letters from markers, parens, and trailing answers", () => {
    expect(extractMcq("The answer is B")).toBe("B");
    expect(extractMcq("I'd go with (C).")).toBe("C");
    expect(extractMcq("After reasoning, the correct choice: A")).toBe("A");
    expect(extractMcq("clearly nothing", ["A", "B"])).toBeNull();
  });

  it("parses JSON directly, from fences, and from embedded braces", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(tryParseJson('Here you go: {"a":3} done')).toEqual({ a: 3 });
    expect(tryParseJson("not json")).toBeUndefined();
  });
});

describe("gradeOutput", () => {
  it("grades exact (case-sensitive)", () => {
    expect(gradeOutput({ kind: "exact", expected: "READY", caseSensitive: true }, "READY").passed).toBe(true);
    expect(gradeOutput({ kind: "exact", expected: "READY", caseSensitive: true }, "ready").passed).toBe(false);
  });

  it("grades numeric within tolerance", () => {
    expect(gradeOutput({ kind: "numeric", expected: 2.2, tolerance: 0.001 }, "£2.20").passed).toBe(true);
    expect(gradeOutput({ kind: "numeric", expected: 30 }, "31").passed).toBe(false);
  });

  it("grades mcq", () => {
    expect(gradeOutput({ kind: "mcq", expected: "B", choices: ["A", "B"] }, "B").passed).toBe(true);
  });

  it("grades contains (needle retrieval), partial scoring", () => {
    const g: Grader = { kind: "contains", needles: ["TANGERINE-49", "vault 7"] };
    expect(gradeOutput(g, "the code is TANGERINE-49").score).toBe(0.5);
    expect(gradeOutput(g, "vault 7 code TANGERINE-49").passed).toBe(true);
  });

  it("grades regex", () => {
    expect(gradeOutput({ kind: "regex", pattern: "^\\s*2,3,5\\s*$" }, "2,3,5").passed).toBe(true);
    expect(gradeOutput({ kind: "regex", pattern: "^\\s*2,3,5\\s*$" }, "2, 3, 5").passed).toBe(false);
  });

  it("grades json_schema by required keys", () => {
    const g: Grader = { kind: "json_schema", requiredKeys: ["name", "age"] };
    expect(gradeOutput(g, '{"name":"Ada","age":36}').passed).toBe(true);
    expect(gradeOutput(g, '{"name":"Ada"}').passed).toBe(false);
  });

  it("defers consistency scoring and returns a canonical answer", () => {
    const r = gradeOutput({ kind: "consistency", extract: "numeric" }, "408");
    expect(r.score).toBeNull();
    expect(r.canonical).toBe("408");
  });
});

describe("modalAgreement", () => {
  it("is 1 when all repeats agree, 0 when none extracted", () => {
    expect(modalAgreement(["408", "408", "408"])).toBe(1);
    expect(modalAgreement([null, null])).toBe(0);
  });
  it("is the modal fraction when repeats split", () => {
    expect(modalAgreement(["A", "A", "B"])).toBeCloseTo(2 / 3, 6);
  });
});

describe("summarize", () => {
  it("aggregates per-domain scores, overall rating, and variance", () => {
    const results: ResultForAgg[] = [
      // maths: one item, two repeats both correct
      { domain: "maths", itemId: "m1", score: 1, canonical: null },
      { domain: "maths", itemId: "m1", score: 1, canonical: null },
      // logic: one item, half correct across repeats
      { domain: "logic", itemId: "l1", score: 1, canonical: null },
      { domain: "logic", itemId: "l1", score: 0, canonical: null },
      // consistency: one item, 2/3 agree
      { domain: "consistency", itemId: "c1", score: null, canonical: "A" },
      { domain: "consistency", itemId: "c1", score: null, canonical: "A" },
      { domain: "consistency", itemId: "c1", score: null, canonical: "B" },
    ];
    const summary = summarize(results, 2);
    const maths = summary.domains.find((d) => d.domain === "maths")!;
    const logic = summary.domains.find((d) => d.domain === "logic")!;
    const consistency = summary.domains.find((d) => d.domain === "consistency")!;
    expect(maths.score).toBe(1);
    expect(logic.score).toBe(0.5);
    expect(consistency.score).toBeCloseTo(2 / 3, 6);
    // equal-weighted overall = mean(1, 0.5, 0.667) ≈ 0.722 → 72
    expect(summary.overallRating).toBe(72);
    expect(summary.itemsRun).toBe(3);
    expect(summary.repeats).toBe(2);
  });

  it("only weights domains that actually ran", () => {
    const summary = summarize([{ domain: "maths", itemId: "m1", score: 1, canonical: null }], 1);
    expect(summary.overallRating).toBe(100);
    expect(summary.domains).toHaveLength(1);
  });
});

describe("core-capabilities-v1 answer keys are self-consistent", () => {
  // Each item must mark its own canonical answer correct, so the suite's keys
  // can't silently rot. We feed the ideal output for each grader kind.
  const ideal: Record<string, string> = {
    "maths-tank-drain": "30",
    "maths-widget-rate": "270",
    "maths-rect-area": "126",
    "maths-order-of-ops": "26",
    "logic-illicit-some": "B",
    "logic-modus-tollens": "B",
    "logic-ordering": "A",
    "reasoning-change": "2.2",
    "reasoning-sequence": "42",
    "reasoning-ages": "A",
    "instruction-json": '{"name":"Ada","age":36}',
    "instruction-exact-word": "READY",
    "instruction-csv": "2,3,5",
    "needle-vault-code": "TANGERINE-49",
    "needle-ticket": "OPS-3382",
    "needle-pallet": "Z-7741",
  };

  for (const item of coreCapabilitiesV1.items) {
    if (item.grader.kind === "consistency") continue; // no single "correct" key
    it(`${item.id} grades its ideal answer as passed`, () => {
      const r = gradeOutput(item.grader, ideal[item.id]);
      expect(r.passed).toBe(true);
    });
  }

  it("has a stable key and version", () => {
    expect(coreCapabilitiesV1.key).toBe("core-capabilities");
    expect(coreCapabilitiesV1.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

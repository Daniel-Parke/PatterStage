/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// A total search outage must not ship as a completed report.
//
// The engine swallowed every search failure to `results = []`, the synthesis
// prompt then fell back to "(no external sources - answer from model
// knowledge)", and run-job marked the run `completed`. An operator could not
// tell that report from a real one: the citations are model-generated and there
// were no sources at all.
//
// The stance is borrowed from the benchmark runner, which failed a whole run
// rather than score it zero when everything errored. Zero RESULTS is a different
// thing from search being DOWN, and the engine now distinguishes them.
// ═══════════════════════════════════════════════════════════════

import { runDeepResearch } from "@/lib/laboratory/deep-research/engine";
import { nullSearchProvider } from "@/lib/search";
import type { SearchProvider } from "@/lib/search/types";

function llmRouter(plan: string, reason: string, synth: string) {
  return jest.fn(async (messages: { content: string }[]) => {
    const sys = messages[0].content;
    if (sys.includes("strategist")) return { content: plan };
    if (sys.includes("still missing")) return { content: reason };
    return { content: synth };
  });
}

const PLAN = "Plan.\nQUERY: q";
const noVisit = async () => null;

describe("search outage is distinguishable from an empty result set", () => {
  it("counts every failed search attempt", async () => {
    const search: SearchProvider = {
      name: "broken",
      async search() {
        throw new Error("ENOTFOUND api.search.example");
      },
    };

    const r = await runDeepResearch("Q?", {
      llm: llmRouter(PLAN, "DONE", "confident-looking report [1]"),
      search,
      visit: noVisit,
      onStep: () => {},
    });

    expect(r.searchAttempts).toBe(1);
    expect(r.searchFailures).toBe(1);
    // The report is still produced: the caller decides what to do about it.
    expect(r.report).toBe("confident-looking report [1]");
  });

  it("reports zero failures when the provider legitimately finds nothing", async () => {
    // This is the case that must STAY a completed run.
    const r = await runDeepResearch("Q?", {
      llm: llmRouter(PLAN, "DONE", "answer from knowledge"),
      search: nullSearchProvider,
      visit: noVisit,
      onStep: () => {},
    });

    expect(r.searchAttempts).toBeGreaterThan(0);
    expect(r.searchFailures).toBe(0);
  });

  it("keeps counting across rounds, so a partial outage is not a total one", async () => {
    let n = 0;
    const search: SearchProvider = {
      name: "flaky",
      async search() {
        n += 1;
        if (n === 1) throw new Error("transient");
        return [{ title: "T", url: "https://example.com", snippet: "s" }];
      },
    };

    const r = await runDeepResearch("Q?", {
      llm: llmRouter(PLAN, "More needed.\nNEXT QUERY: q2", "report"),
      search,
      visit: noVisit,
      onStep: () => {},
      maxRounds: 2,
    });

    expect(r.searchAttempts).toBe(2);
    expect(r.searchFailures).toBe(1);
    // failures < attempts, so run-job treats this as completed. One bad round
    // must not condemn a run that did gather evidence.
    expect(r.searchFailures).toBeLessThan(r.searchAttempts);
  });
});

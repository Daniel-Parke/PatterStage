/** @jest-environment node */
// Unit coverage for the IterResearch loop — pure orchestration with the LLM,
// search provider, visit fn, and step sink all injected (no DB, no network).

import { runDeepResearch, type ResearchStepRecord } from "@/lib/laboratory/deep-research/engine";
import { nullSearchProvider } from "@/lib/search";
import type { SearchProvider, VisitedPage } from "@/lib/search/types";

function llmRouter(handlers: { plan: string; reason: string | string[]; synth: string }) {
  let reasonIdx = 0;
  return jest.fn(async (messages: { content: string }[]) => {
    const sys = messages[0].content;
    if (sys.includes("strategist")) return { content: handlers.plan };
    if (sys.includes("still missing")) {
      const r = Array.isArray(handlers.reason)
        ? handlers.reason[Math.min(reasonIdx++, handlers.reason.length - 1)]
        : handlers.reason;
      return { content: r };
    }
    return { content: handlers.synth };
  });
}
const visitOk = async (url: string): Promise<VisitedPage> => ({ url, title: "T", content: "page body" });

describe("runDeepResearch (IterResearch loop)", () => {
  it("plans → search → visit → reason → synthesize (stops on DONE)", async () => {
    const llm = llmRouter({ plan: "Plan.\nQUERY: initial", reason: "Enough.\nDONE", synth: "# Report\n[1] ok" });
    const search: SearchProvider = {
      name: "mock",
      async search() {
        return [{ title: "T", url: "https://example.com", snippet: "s" }];
      },
    };
    const steps: ResearchStepRecord[] = [];

    const result = await runDeepResearch("What is X?", {
      llm,
      search,
      visit: visitOk,
      onStep: (s) => steps.push(s),
    });

    expect(result.report).toBe("# Report\n[1] ok");
    expect(result.provider).toBe("mock");
    expect(steps.map((s) => s.kind)).toEqual(["plan", "search", "visit", "reason", "synthesize"]);
  });

  it("runs LLM-only when search returns nothing", async () => {
    const llm = llmRouter({ plan: "Plan.\nQUERY: q", reason: "DONE", synth: "answer from knowledge" });
    const steps: ResearchStepRecord[] = [];
    const result = await runDeepResearch("Q?", {
      llm,
      search: nullSearchProvider,
      visit: visitOk,
      onStep: (s) => steps.push(s),
    });
    expect(result.report).toBe("answer from knowledge");
    expect(steps.map((s) => s.kind)).toEqual(["plan", "reason", "synthesize"]);
  });

  it("iterates multiple rounds via NEXT QUERY then synthesizes", async () => {
    const llm = llmRouter({
      plan: "Plan.\nQUERY: a",
      reason: ["Need more.\nNEXT QUERY: b", "Enough.\nDONE"],
      synth: "final",
    });
    const search = jest.fn(async () => [{ title: "T", url: "https://e.com", snippet: "s" }]);
    const steps: ResearchStepRecord[] = [];
    await runDeepResearch("Q?", {
      llm,
      search: { name: "m", search },
      visit: visitOk,
      onStep: (s) => steps.push(s),
      maxRounds: 3,
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(steps.filter((s) => s.kind === "reason")).toHaveLength(2);
    expect(steps[steps.length - 1].kind).toBe("synthesize");
  });

  it("respects the round budget", async () => {
    const llm = llmRouter({ plan: "Plan.\nQUERY: a", reason: "NEXT QUERY: b", synth: "done" });
    const search = jest.fn(async () => [{ title: "T", url: "https://e.com", snippet: "s" }]);
    await runDeepResearch("Q?", {
      llm,
      search: { name: "m", search },
      visit: visitOk,
      onStep: () => undefined,
      maxRounds: 1,
    });
    expect(search).toHaveBeenCalledTimes(1); // never exceeds maxRounds
  });

  it("propagates LLM failures", async () => {
    const llm = jest.fn(async () => {
      throw new Error("gateway down");
    });
    await expect(
      runDeepResearch("Q?", { llm, search: nullSearchProvider, visit: visitOk, onStep: () => undefined }),
    ).rejects.toThrow("gateway down");
  });
});

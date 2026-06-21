/** @jest-environment node */
// Unit coverage for the DeepResearch engine — pure orchestration with the LLM,
// search provider, and step sink all injected (no DB, no network).

import { runDeepResearch, type ResearchStepRecord } from "@/lib/laboratory/deep-research/engine";
import { nullSearchProvider } from "@/lib/laboratory/deep-research/search";
import type { SearchProvider } from "@/lib/laboratory/deep-research/types";

describe("runDeepResearch (engine)", () => {
  it("plans then synthesizes, recording steps (LLM-only when no search results)", async () => {
    const order: string[] = [];
    const llm = jest.fn(async (messages: { content: string }[]) => {
      if (messages[0].content.includes("research strategist")) {
        order.push("plan");
        return { content: "THE PLAN" };
      }
      order.push("synth");
      return { content: "THE REPORT" };
    });
    const steps: ResearchStepRecord[] = [];

    const result = await runDeepResearch("What is X?", {
      llm,
      search: nullSearchProvider,
      onStep: (s) => steps.push(s),
    });

    expect(result.report).toBe("THE REPORT");
    expect(result.provider).toBe("none");
    expect(order).toEqual(["plan", "synth"]);
    expect(steps.map((s) => s.kind)).toEqual(["plan", "synthesize"]);
  });

  it("includes a search step (with sources) when the provider returns results", async () => {
    const llm = jest.fn(async () => ({ content: "X" }));
    const search: SearchProvider = {
      name: "mock",
      async search() {
        return [{ title: "T", url: "https://example.com", snippet: "s" }];
      },
    };
    const steps: ResearchStepRecord[] = [];

    const result = await runDeepResearch("Q?", { llm, search, onStep: (s) => steps.push(s) });

    expect(result.provider).toBe("mock");
    expect(steps.map((s) => s.kind)).toEqual(["plan", "search", "synthesize"]);
    expect(steps[1].sources).toEqual(["https://example.com"]);
  });

  it("propagates LLM failures (no silent swallow)", async () => {
    const llm = jest.fn(async () => {
      throw new Error("gateway down");
    });
    await expect(
      runDeepResearch("Q?", { llm, search: nullSearchProvider, onStep: () => undefined }),
    ).rejects.toThrow("gateway down");
  });

  it("tolerates a search provider that throws (falls back to LLM-only)", async () => {
    const llm = jest.fn(async () => ({ content: "R" }));
    const search: SearchProvider = {
      name: "flaky",
      async search() {
        throw new Error("search 500");
      },
    };
    const steps: ResearchStepRecord[] = [];

    const result = await runDeepResearch("Q?", { llm, search, onStep: (s) => steps.push(s) });

    expect(result.report).toBe("R");
    expect(steps.map((s) => s.kind)).toEqual(["plan", "synthesize"]);
  });
});

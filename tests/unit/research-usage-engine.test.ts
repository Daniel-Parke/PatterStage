/**
 * @jest-environment node
 *
 * T-0030 acceptance oracle, engine half.
 *
 * Separate from the accumulateUsage half on purpose. That half imports a module
 * that does not exist yet, so its whole suite fails to RESOLVE, and a
 * resolution failure would hide these — which can run today, and go red for the
 * behaviour they describe rather than for a missing file.
 *
 * What is wrong today: `defaultLlm` returns `{ content: res.content }` and
 * drops `res.usage` on the floor, and `runDeepResearch` returns no usage at
 * all, so Deep Research spend cannot be counted even in principle.
 */

describe("the engine hands its usage back", () => {
  it("returns the summed usage of every LLM call it made", async () => {
    const { runDeepResearch } = await import("@/lib/laboratory/deep-research/engine");
    const calls: number[] = [];
    const result = await runDeepResearch("why is the sky blue", {
      llm: async () => {
        calls.push(1);
        return {
          content: "a plausible answer",
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      },
      search: { name: "none", search: async () => [] },
      visit: async () => null,
      onStep: () => undefined,
      maxRounds: 1,
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(result.usage).toEqual({
      promptTokens: 10 * calls.length,
      completionTokens: 5 * calls.length,
      totalTokens: 15 * calls.length,
    });
  });

  it("returns null usage when the provider reported none", async () => {
    const { runDeepResearch } = await import("@/lib/laboratory/deep-research/engine");
    const result = await runDeepResearch("why is the sky blue", {
      llm: async () => ({ content: "a plausible answer" }),
      search: { name: "none", search: async () => [] },
      visit: async () => null,
      onStep: () => undefined,
      maxRounds: 1,
    });
    expect(result.usage).toBeNull();
  });

  // ── no-regression guard: the engine's existing contract is untouched ──
  it("still returns the report and the provider it used", async () => {
    const { runDeepResearch } = await import("@/lib/laboratory/deep-research/engine");
    const result = await runDeepResearch("q", {
      llm: async () => ({ content: "REPORT BODY" }),
      search: { name: "none", search: async () => [] },
      visit: async () => null,
      onStep: () => undefined,
      maxRounds: 1,
    });
    expect(result.report).toBe("REPORT BODY");
    expect(result.provider).toBe("none");
  });
});

describe("defaultLlm stops discarding what callLLM reported", () => {
  // WHY THIS TEST COULD NOT CATCH T-0068, recorded rather than deleted.
  //
  // The mock below returns CAMELCASE. Until T-0068 the real callLLM returned the
  // provider's snake_case verbatim, so this fixture described a contract that
  // nothing upstream honoured: defaultLlm forwarded correctly, this test proved
  // it, and every research run still recorded null tokens. A test whose mock
  // states the intended shape rather than the observed one is green by
  // construction.
  //
  // It is kept because the assertion is now TRUE -- callLLM normalises at the
  // boundary, so camelCase is what it really produces. What it is not is
  // evidence about the boundary itself. That lives in
  // tests/unit/llm-usage-is-normalised.test.ts, which drives the real callLLM
  // and fakes only the HTTP response.
  it("passes usage through", async () => {
    jest.resetModules();
    jest.doMock("@/lib/llm", () => ({
      callLLM: async () => ({
        content: "hi",
        model: "m",
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
      }),
    }));
    const { defaultLlm } = await import("@/lib/laboratory/deep-research/engine");
    const res = await defaultLlm([{ role: "user", content: "q" }], {});
    expect(res.usage).toEqual({ promptTokens: 2, completionTokens: 3, totalTokens: 5 });
    jest.dontMock("@/lib/llm");
    jest.resetModules();
  });
});

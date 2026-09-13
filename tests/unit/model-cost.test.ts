/** @jest-environment node */
// Pure cost estimation (analytics/model-cost.ts).

import { rateForModel, estimateCost, DEFAULT_RATE } from "@/lib/analytics/model-cost";

describe("rateForModel", () => {
  it("matches by normalised substring (provider-prefixed ids)", () => {
    expect(rateForModel("anthropic/claude-sonnet-4")).toEqual({ input: 3, output: 15 });
    expect(rateForModel("claude-opus-4-8")).toEqual({ input: 15, output: 75 });
  });
  it("prefers the longest (most specific) key", () => {
    // "gpt-4o-mini" must win over "gpt-4o" and "gpt-4"
    expect(rateForModel("openai/gpt-4o-mini")).toEqual({ input: 0.15, output: 0.6 });
    expect(rateForModel("openai/gpt-4o")).toEqual({ input: 2.5, output: 10 });
  });
  it("falls back to the default rate for unknown models", () => {
    expect(rateForModel("some-unknown-model")).toEqual(DEFAULT_RATE);
    expect(rateForModel(null)).toEqual(DEFAULT_RATE);
    expect(rateForModel(undefined)).toEqual(DEFAULT_RATE);
  });
});

describe("estimateCost", () => {
  it("computes USD from input/output token split", () => {
    // sonnet: 1M in @ $3 + 1M out @ $15 = $18
    expect(estimateCost("claude-sonnet-4", 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
    // haiku: 500k in @ $0.8 + 250k out @ $4 = 0.4 + 1.0 = $1.4
    expect(estimateCost("claude-haiku", 500_000, 250_000)).toBeCloseTo(1.4, 6);
  });
  it("clamps negative token counts to zero", () => {
    expect(estimateCost("claude-sonnet-4", -100, -100)).toBe(0);
  });
});

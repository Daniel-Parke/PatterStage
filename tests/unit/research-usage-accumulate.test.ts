/**
 * @jest-environment node
 *
 * T-0030 acceptance oracle — Deep Research spend stops being invisible.
 *
 * WHAT IS WRONG TODAY. Deep Research drives callLLM directly and throws the
 * usage away in one line: `defaultLlm` returns `{ content: res.content }` and
 * drops `res.usage`. research_runs has no token column, so the spend console
 * reports "cost not recorded" with a run count and excludes it from every
 * total.
 *
 * That is honest, and it is also a hole in something that costs money. The
 * operator's optional hard stop (migration 033) measures RECORDED spend, so an
 * install that leans on Deep Research is under-counted and can sail past its
 * own ceiling by an amount nothing in the product can see.
 *
 * THE LINE THIS ORACLE WILL NOT LET THE FIX CROSS. A run whose usage was never
 * recorded — every run that predates the migration — must NOT start counting as
 * zero. spend-summary.ts already argues this against itself in a comment:
 * inventing a number "would be the same lie as pricing Deep Research at zero,
 * in a smaller place". So the fix has to distinguish three states, not two:
 * counted, recorded-as-zero, and never recorded. The tests below pin all three,
 * and the last of them is the one a careless fix destroys.
 */

import { accumulateUsage, type ResearchUsage } from "@/lib/laboratory/deep-research/usage";

describe("accumulateUsage: totalling what the model reported", () => {
  it("sums every call in a run", () => {
    const total = accumulateUsage([
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      { promptTokens: 20, completionTokens: 7, totalTokens: 27 },
    ]);
    expect(total).toEqual({ promptTokens: 30, completionTokens: 12, totalTokens: 42 });
  });

  it("returns null when NOTHING reported usage, rather than a zero total", () => {
    // The distinction the whole task rests on. A provider that reports no usage
    // and a provider that reports zero tokens are different facts, and only one
    // of them may be added to a spend total.
    expect(accumulateUsage([])).toBeNull();
    expect(accumulateUsage([undefined, undefined])).toBeNull();
  });

  it("counts the calls that DID report, and ignores the ones that did not", () => {
    const total = accumulateUsage([
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      undefined,
      { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    ]);
    expect(total).toEqual({ promptTokens: 11, completionTokens: 6, totalTokens: 17 });
  });

  it("reports a genuine zero as zero, not as absent", () => {
    const total = accumulateUsage([{ promptTokens: 0, completionTokens: 0, totalTokens: 0 }]);
    expect(total).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it("treats a non-finite count as absent rather than poisoning the sum", () => {
    const total = accumulateUsage([
      { promptTokens: Number.NaN, completionTokens: 5, totalTokens: 5 },
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    ]);
    // NaN in a spend figure is worse than a missing one: it renders as "NaN"
    // beside real money and survives every arithmetic check downstream.
    expect(total).toEqual({ promptTokens: 10, completionTokens: 10, totalTokens: 20 });
  });

  it("derives totalTokens when the provider omits it", () => {
    const total = accumulateUsage([
      { promptTokens: 3, completionTokens: 4 } as ResearchUsage,
    ]);
    expect(total?.totalTokens).toBe(7);
  });
});


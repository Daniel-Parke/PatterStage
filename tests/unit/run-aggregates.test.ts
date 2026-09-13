/** @jest-environment node */
// Pure duration bucketing (analytics/run-aggregates.ts).

import { bucketDurations } from "@/lib/analytics/run-aggregates";

describe("bucketDurations", () => {
  it("returns all 7 buckets even when empty", () => {
    const bins = bucketDurations([]);
    expect(bins.map((b) => b.label)).toEqual([
      "<5s",
      "5–15s",
      "15–30s",
      "30–60s",
      "1–2m",
      "2–5m",
      "5m+",
    ]);
    expect(bins.every((b) => b.value === 0)).toBe(true);
  });

  it("places durations in the correct bucket (upper-exclusive)", () => {
    const bins = bucketDurations([0, 4.9, 5, 14, 29, 59, 119, 299, 300, 1000]);
    const byLabel = Object.fromEntries(bins.map((b) => [b.label, b.value]));
    expect(byLabel["<5s"]).toBe(2); // 0, 4.9
    expect(byLabel["5–15s"]).toBe(2); // 5, 14
    expect(byLabel["15–30s"]).toBe(1); // 29
    expect(byLabel["30–60s"]).toBe(1); // 59
    expect(byLabel["1–2m"]).toBe(1); // 119
    expect(byLabel["2–5m"]).toBe(1); // 299
    expect(byLabel["5m+"]).toBe(2); // 300, 1000
  });

  it("ignores negative / non-finite durations", () => {
    const bins = bucketDurations([-1, NaN, Infinity, 3]);
    expect(bins.reduce((s, b) => s + b.value, 0)).toBe(1);
  });
});

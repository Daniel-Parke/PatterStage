import {
  titleCase,
  timeAgo,
  timeUntil,
  formatBytes,
  formatElapsed,
  truncate,
  messageSummary,
  safeJsonParse,
} from "@/lib/utils";

describe("safeJsonParse", () => {
  it("returns fallback for null, undefined, and empty string", () => {
    expect(safeJsonParse(null, [])).toEqual([]);
    expect(safeJsonParse(undefined, { times: 1 })).toEqual({ times: 1 });
    expect(safeJsonParse("", ["x"])).toEqual(["x"]);
  });

  it("parses valid JSON", () => {
    expect(safeJsonParse('["a","b"]', [] as string[])).toEqual(["a", "b"]);
    expect(safeJsonParse('{"times":null}', { times: 1, completed: 0 })).toEqual({
      times: null,
    });
  });

  it("returns fallback on malformed JSON (cron/mission DB fields)", () => {
    expect(safeJsonParse("{not json", [] as string[])).toEqual([]);
    expect(safeJsonParse("undefined", { times: 1, completed: 0 })).toEqual({
      times: 1,
      completed: 0,
    });
  });
});

describe("titleCase", () => {
  it("capitalises first letter", () => {
    expect(titleCase("running")).toBe("Running");
  });

  it("returns empty string unchanged", () => {
    expect(titleCase("")).toBe("");
  });

  it("returns single char capitalised", () => {
    expect(titleCase("a")).toBe("A");
  });

  it("preserves rest of string", () => {
    expect(titleCase("hello world")).toBe("Hello world");
  });

  it("handles null-ish as empty", () => {
    expect(titleCase(null as unknown as string)).toBeNull();
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for very recent timestamps", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("returns 'never' for null", () => {
    expect(timeAgo(null)).toBe("never");
  });

  it("returns 'never' for invalid ISO string", () => {
    expect(timeAgo("not-a-date")).toBe("never");
    expect(timeAgo("")).toBe("never");
  });
});

describe("formatElapsed", () => {
  it("returns seconds for sub-minute durations", () => {
    const fiveSecAgo = new Date(Date.now() - 5 * 1000).toISOString();
    expect(formatElapsed(fiveSecAgo)).toBe("5s");
  });

  it("returns minutes+seconds for sub-hour durations", () => {
    const twoMinFiveSecAgo = new Date(Date.now() - (2 * 60 + 5) * 1000).toISOString();
    expect(formatElapsed(twoMinFiveSecAgo)).toBe("2m 5s");
  });

  it("returns hours+minutes for multi-hour durations", () => {
    const twoHoursFifteenMinAgo = new Date(Date.now() - (2 * 3600 + 15 * 60) * 1000).toISOString();
    expect(formatElapsed(twoHoursFifteenMinAgo)).toBe("2h 15m");
  });

  it("clamps negative diffs (future timestamps) to 0s", () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString();
    expect(formatElapsed(future)).toBe("0s");
  });

  it("returns empty string for unparseable timestamps", () => {
    expect(formatElapsed("not-a-date")).toBe("");
    expect(formatElapsed("")).toBe("");
  });
});

describe("timeUntil", () => {
  it("returns '—' for null", () => {
    expect(timeUntil(null)).toBe("—");
  });

  it("returns '—' for invalid ISO string", () => {
    expect(timeUntil("not-a-date")).toBe("—");
    expect(timeUntil("")).toBe("—");
  });

  it("returns 'overdue' for past timestamps", () => {
    const past = new Date(Date.now() - 60000).toISOString();
    expect(timeUntil(past)).toBe("overdue");
  });

  it("returns '< 1m' for imminent timestamps", () => {
    const soon = new Date(Date.now() + 20000).toISOString();
    expect(timeUntil(soon)).toBe("< 1m");
  });

  it("returns minutes for short durations", () => {
    const tenMin = new Date(Date.now() + 10 * 60000).toISOString();
    expect(timeUntil(tenMin)).toBe("10m");
  });

  it("returns hours and minutes for long durations", () => {
    const ninetyMin = new Date(Date.now() + 90 * 60000).toISOString();
    expect(timeUntil(ninetyMin)).toBe("1h 30m");
  });

  it("returns just hours without '0m' for exact hour durations", () => {
    const oneHour = new Date(Date.now() + 60 * 60000).toISOString();
    expect(timeUntil(oneHour)).toBe("1h");

    const twoHours = new Date(Date.now() + 120 * 60000).toISOString();
    expect(timeUntil(twoHours)).toBe("2h");

    const threeHours = new Date(Date.now() + 180 * 60000).toISOString();
    expect(timeUntil(threeHours)).toBe("3h");
  });

  it("includes minutes when non-zero for durations over 1 hour", () => {
    const sixtyOneMin = new Date(Date.now() + 61 * 60000).toISOString();
    expect(timeUntil(sixtyOneMin)).toBe("1h 1m");

    const twoHoursFifteen = new Date(Date.now() + 135 * 60000).toISOString();
    expect(timeUntil(twoHoursFifteen)).toBe("2h 15m");
  });
});

describe("formatBytes", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("handles negative numbers without crashing", () => {
    expect(formatBytes(-1)).toBe("-1 B");
    expect(formatBytes(-500)).toBe("-500 B");
  });

  it("handles Infinity without crashing", () => {
    expect(formatBytes(Infinity)).toBe("Infinity B");
    expect(formatBytes(-Infinity)).toBe("-Infinity B");
  });

  it("handles NaN without crashing", () => {
    expect(formatBytes(NaN)).toBe("NaN B");
  });

  it("caps at GB for very large values", () => {
    const huge = 1073741824 * 1024; // 1 TB
    expect(formatBytes(huge)).toMatch(/GB$/);
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
  });

  it("handles exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("returns empty string for maxLen of 0", () => {
    expect(truncate("hello", 0)).toBe("");
  });

  it("returns empty string for negative maxLen", () => {
    expect(truncate("hello", -1)).toBe("");
    expect(truncate("hello", -100)).toBe("");
  });

  it("handles empty string input", () => {
    expect(truncate("", 5)).toBe("");
    expect(truncate("", 0)).toBe("");
  });
});

describe("messageSummary", () => {
  it("returns '(no content)' for undefined", () => {
    expect(messageSummary(undefined)).toBe("(no content)");
  });

  it("returns first line of content", () => {
    expect(messageSummary("Hello")).toBe("Hello");
  });

  it("adds ellipsis for multi-line content", () => {
    expect(messageSummary("Line 1\nLine 2")).toBe("Line 1...");
  });

  it("truncates long single lines to 120 chars", () => {
    const long = "a".repeat(150);
    const result = messageSummary(long);
    expect(result.length).toBeLessThanOrEqual(123); // 120 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("skips empty lines", () => {
    expect(messageSummary("\n\nFirst content\nMore")).toBe("First content...");
  });
});

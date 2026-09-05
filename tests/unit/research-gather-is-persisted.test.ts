/** @jest-environment node */

// T-0070 — the seam between the engine that COUNTS a degraded gather and the
// row that has to remember it.
//
// FOUND BY MUTATION, AND IT IS THE WHOLE DEFECT. Deleting the `gather:` field
// from run-job's terminal `updateResearchRun` call left all 85 research tests
// green. The counters would have gone straight back to being computed and
// thrown away -- which is precisely the state T-0070 was opened to end -- and
// nothing anywhere would have said so.
//
// Everything on either side of this seam was covered and the seam was not:
// deep-research-search-outage.test.ts drives the engine and asserts the numbers
// it produces, and the caveat formatter has its own tests. Neither runs
// run-job, so neither could see the numbers being dropped between them. It is
// the shape of T-0068's defect exactly -- two well-tested ends and an untested
// strip in the middle, which is the only code that has ever been wrong.

const mockRunDeepResearch = jest.fn();
jest.mock("@/lib/laboratory/deep-research/engine", () => ({
  runDeepResearch: (...a: unknown[]) => mockRunDeepResearch(...a),
  defaultLlm: jest.fn(),
  defaultVisit: jest.fn(),
}));

const mockUpdateResearchRun = jest.fn();
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({
  updateResearchRun: (...a: unknown[]) => mockUpdateResearchRun(...a),
  insertResearchStep: jest.fn(),
  // The job reads the row back before each step and before the terminal write,
  // so a cancel the operator made mid-flight is not overwritten (T-0108, D98).
  // These runs are never cancelled, so the answer is always `running`.
  getResearchRun: jest.fn(() => ({ status: "running" })),
}));

jest.mock("@/lib/laboratory/deep-research/search", () => ({
  resolveSearchProvider: () => ({ name: "fake", search: async () => [] }),
}));
jest.mock("@/lib/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
jest.mock("@/lib/db", () => ({ now: () => "2026-08-31T12:00:00.000Z" }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

import { runResearchJob } from "@/lib/laboratory/deep-research/run-job";

function engineResult(over: Record<string, unknown> = {}) {
  return {
    report: "The answer is 42.",
    provider: "fake",
    searchAttempts: 8,
    searchFailures: 0,
    visitAttempts: 6,
    visitFailures: 0,
    usage: null,
    ...over,
  };
}
/** The terminal write — the second call; the first flips the run to `running`. */
const terminalWrite = () =>
  mockUpdateResearchRun.mock.calls.at(-1)![1] as Record<string, unknown>;

beforeEach(() => jest.clearAllMocks());

describe("what the engine counted reaches the row", () => {
  it("persists all four counters", async () => {
    mockRunDeepResearch.mockResolvedValue(
      engineResult({ searchFailures: 5, visitFailures: 4 }),
    );

    await runResearchJob("r1", "q", null);

    expect(terminalWrite().gather).toEqual({
      searchAttempts: 8,
      searchFailures: 5,
      visitAttempts: 6,
      visitFailures: 4,
    });
  });

  it("persists them on a FAILED run too", async () => {
    // Same rule as the token counts (T-0030): a run that failed still gathered
    // what it gathered, and the total-outage case is the one whose numbers the
    // operator most wants to see afterwards.
    mockRunDeepResearch.mockResolvedValue(
      engineResult({ searchAttempts: 3, searchFailures: 3 }),
    );

    await runResearchJob("r1", "q", null);

    expect(terminalWrite().status).toBe("failed");
    expect(terminalWrite().gather).toEqual(
      expect.objectContaining({ searchAttempts: 3, searchFailures: 3 }),
    );
  });

  it("persists a clean gather as measured zeroes, not as nothing", async () => {
    // Zero is a measurement; NULL means nobody looked. A clean run must record
    // the zeroes, or it is indistinguishable from a pre-036 row.
    mockRunDeepResearch.mockResolvedValue(engineResult());

    await runResearchJob("r1", "q", null);

    expect(terminalWrite().gather).toEqual({
      searchAttempts: 8,
      searchFailures: 0,
      visitAttempts: 6,
      visitFailures: 0,
    });
    expect(terminalWrite().gather).not.toBeNull();
  });
});

describe("what the operator reads carries the caveat", () => {
  it("marks a partly-degraded report as written from incomplete evidence", async () => {
    mockRunDeepResearch.mockResolvedValue(
      engineResult({ searchFailures: 5, visitFailures: 4 }),
    );

    await runResearchJob("r1", "q", null);

    const write = terminalWrite();
    expect(write.status).toBe("completed"); // not all searches failed
    expect(write.report).toMatch(/Incomplete evidence/);
    expect(write.report).toMatch(/5 of 8/);
    expect(write.report).toContain("The answer is 42.");
  });

  it("GREEN CONTROL: a clean run's report is untouched", async () => {
    // The caveat has to stay rare to mean anything.
    mockRunDeepResearch.mockResolvedValue(engineResult());

    await runResearchJob("r1", "q", null);

    expect(terminalWrite().report).toBe("The answer is 42.");
  });

  it("GREEN CONTROL: a total outage keeps its own error, not a softer caveat", async () => {
    // The all-failed case already fails the run and says the claims are
    // ungrounded. Prefixing "treat its coverage as partial" on top would soften
    // a message that is deliberately absolute.
    mockRunDeepResearch.mockResolvedValue(
      engineResult({ searchAttempts: 3, searchFailures: 3 }),
    );

    await runResearchJob("r1", "q", null);

    const write = terminalWrite();
    expect(write.report).toBe("The answer is 42.");
    expect(write.error).toMatch(/ungrounded/);
  });
});

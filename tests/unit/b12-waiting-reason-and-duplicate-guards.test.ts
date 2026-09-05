/** @jest-environment node */

/**
 * B12, three sharper oracles the sweep asked for (T-0106).
 *
 * `composerWaitingReason` is asked only through the page, which renders runs
 * that are already awaiting_approval, so a version that answers "at a gate"
 * for a finished run walked straight through. And nothing asked the helper
 * what it does with a run that is not waiting at all.
 */

import { composerWaitingReason } from "@/lib/composer/schema";

const run = (status: string, context: Record<string, unknown> | null = null) => ({ status, context });

describe("composerWaitingReason", () => {
  it("answers only for a run that is actually waiting", () => {
    // A completed run is not at a gate, and saying so on a finished row is the
    // whole reason the status guard is the first line of the function.
    for (const status of ["running", "completed", "failed", "cancelled", "rejected"]) {
      expect(composerWaitingReason(run(status))).toBeNull();
      expect(composerWaitingReason(run(status, { __clarify: { question: "?" } }))).toBeNull();
    }
  });

  it("a stage that asked a question is a question", () => {
    expect(
      composerWaitingReason(run("awaiting_approval", { __clarify: { question: "Which repo?" } })),
    ).toBe("question");
  });

  it("and anything else waiting is a gate", () => {
    expect(composerWaitingReason(run("awaiting_approval"))).toBe("gate");
    expect(composerWaitingReason(run("awaiting_approval", { draft: "some output" }))).toBe("gate");
  });

  it("a falsy __clarify is not a question", () => {
    expect(composerWaitingReason(run("awaiting_approval", { __clarify: null }))).toBe("gate");
  });
});

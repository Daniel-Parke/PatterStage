/** @jest-environment node */

import { assessJestRun } from "../../scripts/tooling/mutation-sweep.mjs";

const intendedTestFile = "C:/repo/tests/unit/oracle.test.ts";

function failedJestRun(failureMessage: string, failureDetails: Record<string, unknown>[]) {
  return {
    status: 1,
    report: {
      numTotalTests: 1,
      numFailedTests: 1,
      testResults: [{
        name: intendedTestFile,
        status: "failed",
        assertionResults: [{
          fullName: "the intended test",
          status: "failed",
          failureMessages: [failureMessage],
          failureDetails,
        }],
      }],
    },
  };
}

describe("T-0160 structured mutation kill amendment", () => {
  it("requires a failed matcher result when error text begins with expect syntax", () => {
    // Given a real Jest matcher failure, the mutant has an attributable assertion kill.
    const matcherMessage = "expect(received).toBe(expected)\n\nExpected: 2\nReceived: 1";
    const matcherRun = failedJestRun(matcherMessage, [{ matcherResult: {
      actual: 1,
      expected: 2,
      message: matcherMessage,
      name: "toBe",
      pass: false,
    } }]);
    expect(assessJestRun(matcherRun, [intendedTestFile])).toBe("assertion-failed");

    // When a test throws an Error with matcher-like text, Jest supplies no matcher result.
    const thrownErrorRun = failedJestRun("Error: expect(value) unavailable", [{}]);
    // Then the runner must treat the test failure as infrastructure.
    expect(assessJestRun(thrownErrorRun, [intendedTestFile])).toBe("infrastructure");
  });
});

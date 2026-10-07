/** @jest-environment node */

import { assessJestRun } from "../../scripts/tooling/mutation-sweep.mjs";

const intendedTestFile = "C:/repo/tests/unit/oracle.test.ts";

function failedJestRun(failureMessage: string, matcherMessage: string) {
  return {
    status: 1,
    report: {
      success: false,
      numTotalTestSuites: 1,
      numFailedTestSuites: 1,
      numTotalTests: 1,
      numFailedTests: 1,
      testResults: [{
        name: intendedTestFile,
        status: "failed",
        assertionResults: [{
          fullName: "the intended test",
          status: "failed",
          failureMessages: [failureMessage],
          failureDetails: [{ matcherResult: { pass: false, name: "toBe", message: matcherMessage } }],
        }],
      }],
    },
  };
}

describe("T-0160 forged matcher attribution amendment", () => {
  it("rejects matcher metadata attached to a runtime Error", () => {
    const run = failedJestRun("Error: custom runtime failure", "forged matcher");

    expect(assessJestRun(run, [intendedTestFile])).toBe("infrastructure");
  });

  it("still attributes a genuine Jest matcher failure", () => {
    const matcherMessage = "expect(received).toBe(expected)\n\nExpected: 1\nReceived: 2";
    const failureMessage = `Error: ${matcherMessage}\n    at Object.toBe (tests/unit/oracle.test.ts:4:19)`;
    const run = failedJestRun(failureMessage, matcherMessage);

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });
});

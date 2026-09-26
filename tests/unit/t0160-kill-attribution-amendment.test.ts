/** @jest-environment node */

import { assessJestRun } from "../../scripts/tooling/mutation-sweep.mjs";

const intendedTestFile = "C:/repo/tests/unit/oracle.test.ts";

function failedJestRun(failureMessage: string, failureDetails: Record<string, unknown>[] = [{}]) {
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

describe("T-0160 mutation kill attribution amendment", () => {
  it("treats a TypeError that quotes matcher syntax as infrastructure", () => {
    const run = failedJestRun("TypeError: cannot read value before expect(value).toBe(1)");

    expect(assessJestRun(run, [intendedTestFile])).toBe("infrastructure");
  });

  it("still attributes a genuine Jest matcher failure to the assertion", () => {
    const message = "Error: expect(received).toBe(expected)\n\nExpected: 1\nReceived: 2\n    at Object.toBe (oracle.test.ts:1:1)";
    const run = failedJestRun(message, [{ matcherResult: {
      actual: 2,
      expected: 1,
      message: "expect(received).toBe(expected)\n\nExpected: 1\nReceived: 2",
      name: "toBe",
      pass: false,
    } }]);

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });
});

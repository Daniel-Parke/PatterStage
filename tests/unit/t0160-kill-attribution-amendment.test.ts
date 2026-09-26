/** @jest-environment node */

import { assessJestRun } from "../../scripts/tooling/mutation-sweep.mjs";

const intendedTestFile = "C:/repo/tests/unit/oracle.test.ts";

function failedJestRun(failureMessage: string) {
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
    const run = failedJestRun("Error: expect(received).toBe(expected)\n\nExpected: 1\nReceived: 2");

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });
});

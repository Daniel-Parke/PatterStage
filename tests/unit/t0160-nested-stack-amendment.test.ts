/** @jest-environment node */

import { assessJestRun } from "../../scripts/tooling/mutation-sweep.mjs";

const intendedTestFile = "C:/repo/tests/unit/t0160-nested-diagnostic.test.ts";
const nestedFrames = "\n    at toBe (tests/unit/t0160-nested-diagnostic.test.ts:12:35)\n    at verify (tests/unit/t0160-nested-diagnostic.test.ts:18:5)\n    at Object.nested (tests/unit/t0160-nested-diagnostic.test.ts:24:3)";

function failedJestRun(message: string, failureDetails: Record<string, unknown>[]) {
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
          fullName: "nested callback assertion",
          status: "failed",
          failureMessages: ["Error: " + message + nestedFrames],
          failureDetails,
        }],
      }],
    },
  };
}

describe("T-0160 nested matcher stack amendment", () => {
  it("attributes a positive toBe failure with a nested callback stack", () => {
    const message = "expect(received).toBe(expected) // Object.is equality\n\nExpected: 2\nReceived: 1";
    const run = failedJestRun(message, [{
      matcherResult: { actual: 1, expected: 2, message, name: "toBe", pass: false },
    }]);

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });

  it("attributes a negated toBe failure with a nested callback stack", () => {
    const message = "expect(received).not.toBe(expected) // Object.is equality\n\nExpected: not 1";
    const run = failedJestRun(message, [{
      matcherResult: { actual: 1, expected: 1, message, name: "toBe", pass: true },
    }]);

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });

  it("keeps matcher-like runtime text without matcherResult as infrastructure", () => {
    const message = "expect(received).toBe(expected) // Object.is equality\n\nExpected: 2\nReceived: 1";
    const run = failedJestRun(message, [{ name: "Error", message }]);

    expect(assessJestRun(run, [intendedTestFile])).toBe("infrastructure");
  });
});

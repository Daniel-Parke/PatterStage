/** @jest-environment node */

import { assessJestRun } from "../../scripts/tooling/mutation-sweep.mjs";

const intendedTestFile = "C:/repo/tests/unit/oracle.test.ts";

function failedJestRun(failureMessage: string, failureDetails: Record<string, unknown>[]) {
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
          ancestorTitles: ["mutation target"],
          title: "the intended test",
          fullName: "mutation target the intended test",
          status: "failed",
          failureMessages: [failureMessage],
          failureDetails,
        }],
      }],
    },
  };
}

describe("T-0160 Jest assertion attribution amendment", () => {
  it("attributes a failed negated toBe assertion when Jest reports pass true", () => {
    const message = 'expect(received).not.toBe(expected)\n\nExpected: not "same"';
    const run = failedJestRun(
      `Error: ${message}\n    at Object.toBe (tests/unit/oracle.test.ts:4:23)`,
      [{ matcherResult: { actual: "same", expected: "same", message, name: "toBe", pass: true } }],
    );

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });

  it("attributes a failed toThrow assertion when Jest omits matcherResult.name", () => {
    const message = "expect(received).toThrow()\n\nReceived function did not throw";
    const run = failedJestRun(
      `Error: ${message}\n    at Object.toThrow (tests/unit/oracle.test.ts:4:30)`,
      [{ matcherResult: { message, pass: false } }],
    );

    expect(assessJestRun(run, [intendedTestFile])).toBe("assertion-failed");
  });

  it("keeps a plain runtime Error without matcherResult as infrastructure", () => {
    const run = failedJestRun(
      "Error: test harness crashed\n    at Object.<anonymous> (tests/unit/oracle.test.ts:4:11)",
      [{}],
    );

    expect(assessJestRun(run, [intendedTestFile])).toBe("infrastructure");
  });

  it("keeps a runtime Error quoting matcher text without matcherResult as infrastructure", () => {
    const run = failedJestRun(
      "Error: expect(received).toThrow()\n\nReceived function did not throw\n    at Object.<anonymous> (tests/unit/oracle.test.ts:4:11)",
      [{}],
    );

    expect(assessJestRun(run, [intendedTestFile])).toBe("infrastructure");
  });
});

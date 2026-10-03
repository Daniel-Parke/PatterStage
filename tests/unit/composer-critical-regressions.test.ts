/** @jest-environment node */
/**
 * Regressions for four Composer defects found in the 2026-07 review. Each one
 * failed SILENTLY, which is why none of them had a test: the run reported
 * success, so nothing looked wrong.
 */
import { parseVerdict } from "@/lib/composer/verdict";

describe("parseVerdict — an assessing stage must actually say so", () => {
  // Was: `pass` fell back to true whenever the marker was absent, so a test
  // stage that ran out of tokens or returned prose was indistinguishable from
  // one that had verified something.
  it("FAILS an assessing stage that emits no verdict", () => {
    const v = parseVerdict("I ran the tests and things seem broadly fine.", "test");
    expect(v).not.toBeNull();
    expect(v!.pass).toBe(false);
    expect(v!.reasons.join(" ")).toMatch(/did not report a verdict/i);
  });

  it("FAILS an assessing stage that returned nothing at all", () => {
    expect(parseVerdict("", "final_assessment")!.pass).toBe(false);
    expect(parseVerdict(null, "validate")!.pass).toBe(false);
  });

  // Was: the stage prompt says 'end with "VERDICT: PASS or FAIL"', and the
  // regex matched that sentence and captured PASS. A model echoing its own
  // instructions scored a pass.
  it("does not accept the prompt's own instruction template as a verdict", () => {
    const echoed = "Finally, end your reply with VERDICT: PASS or FAIL as instructed.";
    expect(parseVerdict(echoed, "test")!.pass).toBe(false);
  });

  it("still accepts a real verdict, including one with trailing prose", () => {
    expect(parseVerdict("VERDICT: PASS", "test")!.pass).toBe(true);
    expect(parseVerdict("All 12 suites green.\nVERDICT: PASS\nNice.", "test")!.pass).toBe(true);
    expect(parseVerdict("VERDICT: FAIL\nREASONS: 2 suites red", "test")!.pass).toBe(false);
  });

  it("leaves non-assessing stages alone", () => {
    expect(parseVerdict("Wrote the file.", "implement")).toBeNull();
  });

  it("does not fail a stage that paused to ask a question", () => {
    const v = parseVerdict(
      "OUTCOME: needs_clarification\nQUESTION: which database?",
      "validate",
    );
    expect(v!.pass).toBe(true);
    expect(v!.outcome).toBe("needs_clarification");
    expect(v!.question).toBe("which database?");
  });
});

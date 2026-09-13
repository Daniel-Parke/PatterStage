/** @jest-environment node */
// parseVerdict extracts the structured markers a stage emits: PASS/FAIL +
// reasons/suggestions, an OUTCOME branch label, and (H5) a clarification
// QUESTION when a stage can't proceed on a vague objective.

import { parseVerdict } from "@/lib/composer/verdict";

describe("parseVerdict", () => {
  it("captures a clarification question + the needs_clarification outcome", () => {
    const v = parseVerdict("Too vague.\nOUTCOME: needs_clarification\nQUESTION: What is the subject and length?", "review");
    expect(v?.outcome).toBe("needs_clarification");
    expect(v?.question).toBe("What is the subject and length?");
  });

  it("parses a FAIL verdict with reasons", () => {
    const v = parseVerdict("nope\nVERDICT: FAIL\nREASONS: a; b", "validate");
    expect(v?.pass).toBe(false);
    expect(v?.reasons).toEqual(["a", "b"]);
  });

  it("captures an OUTCOME branch label", () => {
    expect(parseVerdict("done\nOUTCOME: further_research", "custom")?.outcome).toBe("further_research");
  });

  it("returns null for a non-assessing kind with no markers", () => {
    expect(parseVerdict("just did the thing", "implement")).toBeNull();
  });
});

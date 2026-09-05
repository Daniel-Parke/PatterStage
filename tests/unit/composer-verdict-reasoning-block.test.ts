// ═══════════════════════════════════════════════════════════════
// Composer must not read a verdict out of the model's own deliberation.
//
// parseVerdict matched VERDICT_RE against the raw output, so a reasoning model
// that weighed "VERDICT: PASS" inside <think> and then concluded FAIL routed
// on_pass, and the run reported success. Same class as the defect the regex was
// already hardened against once (the model echoing its instruction template):
// text that looks like an answer but is not one.
//
// Surfaced by auditing the benchmark subsystem, which had stripReasoning for
// exactly this reason while the product's real gate did not.
// ═══════════════════════════════════════════════════════════════

import { parseVerdict } from "@/lib/composer/verdict";

describe("parseVerdict ignores reasoning blocks", () => {
  it("does not pass when PASS appears only inside <think> and the conclusion is FAIL", () => {
    const output = [
      "<think>",
      "The tests mostly pass. I could say VERDICT: PASS here.",
      "But two assertions fail, so that would be wrong.",
      "</think>",
      "VERDICT: FAIL",
      "REASONS: two assertions fail",
    ].join("\n");

    const v = parseVerdict(output, "test");
    expect(v).not.toBeNull();
    expect(v!.pass).toBe(false);
  });

  it("fails an assessing stage whose only verdict is inside its deliberation", () => {
    // A verdict never stated outside the reasoning block was never concluded.
    // An assessing stage with no verdict FAILS, which is the hardened behaviour.
    const output = "<think>I think VERDICT: PASS is right.</think>\nAll done.";
    const v = parseVerdict(output, "validate");
    expect(v).not.toBeNull();
    expect(v!.pass).toBe(false);
  });

  it("still reads a real verdict that follows a reasoning block", () => {
    const output = "<reasoning>Checked every case.</reasoning>\nVERDICT: PASS";
    expect(parseVerdict(output, "review")!.pass).toBe(true);
  });

  it("does not take a routing outcome from inside a reasoning block", () => {
    const output = [
      "<thinking>OUTCOME: implement_fix might be right.</thinking>",
      "VERDICT: PASS",
      "OUTCOME: ship_it",
    ].join("\n");
    expect(parseVerdict(output, "triage")!.outcome).toBe("ship_it");
  });

  it("leaves output with no reasoning block byte-identical in behaviour", () => {
    const output = "VERDICT: PASS\nREASONS: all green";
    const v = parseVerdict(output, "test")!;
    expect(v.pass).toBe(true);
    expect(v.reasons.join(" ")).toContain("all green");
  });

  it("does not treat a mismatched tag pair as a reasoning block", () => {
    // <think>…</reflection> is not a block; the backreference requires a match.
    // The verdict inside it is the only one present, so it must still be read
    // rather than silently discarded.
    const output = "<think>VERDICT: PASS</reflection>";
    expect(parseVerdict(output, "test")!.pass).toBe(true);
  });

  it("keeps a truncated unclosed reasoning block readable", () => {
    // A dangling <think> with no terminator is a truncated response. Discarding
    // everything after it would turn truncation into a silent empty answer.
    const output = "<think>deliberating\nVERDICT: FAIL";
    expect(parseVerdict(output, "test")!.pass).toBe(false);
  });
});

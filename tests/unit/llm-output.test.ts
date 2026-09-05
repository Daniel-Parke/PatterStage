/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// llm-output — reading a model's final answer, not its working.
//
// These cases are salvaged from tests/unit/benchmarks-score-robustness.test.ts,
// which died with the benchmark subsystem. They are kept because the primitives
// were lifted into core and are now load-bearing in the product's real path:
// composer/verdict.ts strips reasoning before looking for a VERDICT, after a
// model deliberating "VERDICT: PASS" inside <think> was found routing on_pass
// for a stage that concluded FAIL.
// ═══════════════════════════════════════════════════════════════

import { stripReasoning, extractAnswerSpan } from "@/lib/llm-output";

describe("stripReasoning", () => {
  it("removes think/thinking blocks", () => {
    expect(stripReasoning("<think>let me compute 6*7</think>42")).toBe("42");
    expect(stripReasoning("<thinking>hmm</thinking> Final answer: B")).toBe("Final answer: B");
  });

  it("covers every wrapper the tag list names", () => {
    for (const tag of ["think", "thinking", "reasoning", "scratchpad", "reflection"]) {
      expect(stripReasoning(`<${tag}>noise</${tag}>answer`)).toBe("answer");
    }
  });

  it("removes several blocks without swallowing the text between them", () => {
    // Non-greedy: a greedy match would eat "keep" along with both blocks.
    expect(stripReasoning("<think>a</think>keep<think>b</think>")).toBe("keep");
  });

  it("requires the closing tag to match the opening one", () => {
    // A mismatched pair is not a block, so its content survives. This is what
    // stops a stray tag from silently deleting a real answer.
    expect(stripReasoning("<think>kept</reflection>")).toBe("<think>kept</reflection>");
  });

  it("leaves an unclosed block alone rather than discarding the rest", () => {
    // A dangling tag means a truncated response. Dropping everything after it
    // would turn truncation into a silent empty answer.
    expect(stripReasoning("<think>cut off mid")).toBe("<think>cut off mid");
  });

  it("is a no-op on output with no wrapper", () => {
    expect(stripReasoning("plain answer")).toBe("plain answer");
  });
});

describe("extractAnswerSpan", () => {
  it("reads an explicit span", () => {
    expect(extractAnswerSpan("<answer>Tokyo</answer>")).toBe("Tokyo");
    expect(extractAnswerSpan("blah blah Final answer: 42")).toBe("42");
    expect(extractAnswerSpan("Answer: C because ...")).toBe("C because ...");
  });

  it("returns null with no marker, so callers can fall back", () => {
    expect(extractAnswerSpan("no marker here")).toBeNull();
  });

  it("returns null for an empty marked span rather than an empty string", () => {
    expect(extractAnswerSpan("<answer>   </answer>")).toBeNull();
  });
});

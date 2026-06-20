/** @jest-environment node */
// B1: grader robustness — reasoning/CoT stripping + answer-span extraction so a
// correct answer buried in a reasoning model's output doesn't false-zero.

import {
  gradeOutput,
  stripReasoning,
  extractAnswerSpan,
  gradableText,
} from "@/lib/benchmarks/score";
import type { Grader } from "@/lib/benchmarks/types";

describe("reasoning strip + answer span", () => {
  it("strips <think> blocks", () => {
    expect(stripReasoning("<think>let me compute 6*7</think>42")).toBe("42");
    expect(stripReasoning("<thinking>hmm</thinking> Final answer: B")).toBe("Final answer: B");
  });

  it("extracts an explicit answer span", () => {
    expect(extractAnswerSpan("<answer>Tokyo</answer>")).toBe("Tokyo");
    expect(extractAnswerSpan("blah blah Final answer: 42")).toBe("42");
    expect(extractAnswerSpan("Answer: C because ...")).toBe("C because ...");
    expect(extractAnswerSpan("no marker here")).toBeNull();
  });

  it("gradableText prefers the answer span, else the stripped text", () => {
    expect(gradableText("<think>work</think><answer>7</answer>")).toBe("7");
    expect(gradableText("<think>work</think>7")).toBe("7");
  });
});

describe("gradeOutput is robust to reasoning wrappers", () => {
  it("numeric: scores the final answer, not a number inside the reasoning", () => {
    const g: Grader = { kind: "numeric", expected: 42 };
    expect(gradeOutput(g, "<think>maybe 41? no, 6*7</think>Final answer: 42").passed).toBe(true);
    expect(gradeOutput(g, "<answer>42</answer>").score).toBe(1);
  });

  it("mcq: pulls the choice out of a reasoning transcript", () => {
    const g: Grader = { kind: "mcq", expected: "B", choices: ["A", "B", "C", "D"] };
    expect(gradeOutput(g, "<think>A seems wrong, C too</think> The answer is B.").passed).toBe(true);
  });

  it("exact: still strict, but sees past the <think> wrapper", () => {
    const g: Grader = { kind: "exact", expected: "READY" };
    expect(gradeOutput(g, "<think>format it</think>READY").passed).toBe(true);
    // strictness preserved: trailing punctuation still fails
    expect(gradeOutput(g, "READY.").passed).toBe(false);
  });

  it("flags empty output distinctly from a wrong answer", () => {
    const g: Grader = { kind: "numeric", expected: 42 };
    const empty = gradeOutput(g, "<think>...</think>   ");
    expect(empty.passed).toBe(false);
    expect(empty.detail.empty).toBe(true);
    const wrong = gradeOutput(g, "41");
    expect(wrong.detail.empty).toBeFalsy(); // a non-empty wrong answer is not flagged empty
  });

  it("json_schema still parses fenced JSON from the raw output", () => {
    const g: Grader = { kind: "json_schema", requiredKeys: ["name"] };
    expect(gradeOutput(g, "```json\n{\"name\":\"x\"}\n```").passed).toBe(true);
  });
});

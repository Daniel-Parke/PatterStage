/** @jest-environment node */
// buildStagePrompt is a pure prompt builder. H3 made the preamble neutral by
// default (no "software"), added a per-workflow framing word, and a per-node
// instruction override — while keeping the assessing-kind verdict contract.

import { buildStagePrompt } from "@/lib/composer/stage-prompt";
import type { ComposerNode, ComposerRun } from "@/lib/composer/schema";

function node(over: Partial<ComposerNode> = {}): ComposerNode {
  return {
    id: "n1", workflowId: "w1", key: "review", label: "Review", kind: "review",
    gate: "auto", isStart: true, isTerminal: false, config: null, pos: 0, ...over,
  };
}
function run(over: Partial<ComposerRun> = {}): ComposerRun {
  return {
    id: "r1", workflowId: "w1", status: "running", currentNodeId: "n1",
    input: "Add a dark-mode toggle", context: null, profileName: null, error: null,
    parentNodeRunId: null, createdAt: "", updatedAt: "", completedAt: null, ...over,
  };
}

describe("buildStagePrompt", () => {
  it("uses a neutral preamble by default (no 'software')", () => {
    const p = buildStagePrompt(node({ kind: "custom" }), run());
    expect(p).toContain("multi-stage workflow run by an orchestrator");
    expect(p).not.toContain("software workflow");
  });

  it("applies a workflow framing word when provided (byte-compatible with the old preamble)", () => {
    const p = buildStagePrompt(node(), run(), { framing: "software" });
    expect(p).toContain("multi-stage software workflow run by an orchestrator");
  });

  it("a node's config.instruction overrides the kind default", () => {
    const p = buildStagePrompt(node({ kind: "custom", config: { instruction: "Do the bespoke thing." } }), run());
    expect(p).toContain("Do the bespoke thing.");
    expect(p).not.toContain("Complete this stage's objective using the context provided.");
  });

  it("appends the PASS/FAIL verdict contract for assessing kinds", () => {
    expect(buildStagePrompt(node({ kind: "review" }), run())).toContain("VERDICT: PASS or FAIL");
  });

  it("omits the verdict contract for non-assessing kinds", () => {
    expect(buildStagePrompt(node({ kind: "research", config: null }), run())).not.toContain("VERDICT: PASS or FAIL");
  });

  it("includes the objective + the stage's default instruction", () => {
    const p = buildStagePrompt(node({ kind: "review" }), run({ input: "Build X" }));
    expect(p).toContain("Build X");
    expect(p).toContain("Review the request");
  });
});

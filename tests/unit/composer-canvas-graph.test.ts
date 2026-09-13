/** @jest-environment node */
// Phase 1.5-B3a — the DB-graph ↔ react-flow-canvas converters round-trip, keep
// keys stable, preserve saved positions, dagre-lay-out legacy graphs, validate.

import {
  graphToCanvas,
  canvasToWorkflowDef,
  validateCanvas,
  autoLayout,
} from "@/lib/composer/canvas-graph";
import type { ComposerWorkflowGraph } from "@/lib/composer/schema";

function graph(over: Partial<ComposerWorkflowGraph> = {}): ComposerWorkflowGraph {
  return {
    id: "wf",
    key: "wf",
    name: "WF",
    description: "",
    version: 1,
    createdAt: "",
    updatedAt: "",
    nodes: [
      { id: "n1", workflowId: "wf", key: "start", label: "Start", kind: "review", gate: "auto", isStart: true, isTerminal: false, config: { _ui: { x: 10, y: 20 } }, pos: 0 },
      { id: "n2", workflowId: "wf", key: "work", label: "Work", kind: "implement", gate: "hil", isStart: false, isTerminal: false, config: { _ui: { x: 30, y: 140 }, query: "kept" }, pos: 1 },
      { id: "n3", workflowId: "wf", key: "done", label: "Done", kind: "custom", gate: "auto", isStart: false, isTerminal: true, config: { _ui: { x: 50, y: 260 } }, pos: 2 },
    ],
    edges: [
      { id: "e1", workflowId: "wf", fromNodeId: "n1", toNodeId: "n2", condition: "always", label: null },
      { id: "e2", workflowId: "wf", fromNodeId: "n2", toNodeId: "n3", condition: "on_pass", label: "ok" },
    ],
    ...over,
  };
}

describe("graphToCanvas / canvasToWorkflowDef", () => {
  it("uses saved positions and stable keys, preserving per-kind config", () => {
    const c = graphToCanvas(graph());
    expect(c.nodes.map((n) => n.id)).toEqual(["start", "work", "done"]); // key = id
    expect(c.nodes[0].position).toEqual({ x: 10, y: 20 });
    // _ui stripped from data.config; other config kept.
    expect(c.nodes[1].data.config).toEqual({ query: "kept" });
    expect(c.edges.map((e) => [e.source, e.target, e.data.condition])).toEqual([
      ["start", "work", "always"],
      ["work", "done", "on_pass"],
    ]);
  });

  it("round-trips back to a WorkflowDef with positions folded into config._ui", () => {
    const def = canvasToWorkflowDef("WF v2", graphToCanvas(graph()));
    expect(def.name).toBe("WF v2");
    expect(def.nodes.map((n) => n.key)).toEqual(["start", "work", "done"]);
    const work = def.nodes[1];
    expect(work.gate).toBe("hil");
    expect((work.config as { _ui: { x: number } })._ui.x).toBe(30);
    expect((work.config as { query?: string }).query).toBe("kept");
    expect(def.edges).toEqual([
      { from: "start", to: "work", condition: "always", label: undefined },
      { from: "work", to: "done", condition: "on_pass", label: "ok" },
    ]);
  });

  it("auto-lays-out a legacy graph that has no saved positions", () => {
    const legacy = graph({
      nodes: graph().nodes.map((n) => ({ ...n, config: null })),
    });
    const c = graphToCanvas(legacy);
    // dagre assigns distinct, non-origin coordinates (a tidy stack, not all 0,0).
    const ys = c.nodes.map((n) => n.position.y);
    expect(new Set(ys).size).toBe(3);
  });
});

describe("validateCanvas", () => {
  it("flags missing start and unknown-edge targets", () => {
    const c = graphToCanvas(graph());
    expect(validateCanvas(c)).toEqual([]);

    const noStart = { ...c, nodes: c.nodes.map((n) => ({ ...n, data: { ...n.data, isStart: false } })) };
    expect(validateCanvas(noStart)).toContain("Mark one stage as the Start.");

    const badEdge = { ...c, edges: [{ id: "x", source: "start", target: "ghost", data: { condition: "always", label: null } }] };
    expect(validateCanvas(badEdge).some((e) => /unknown stage/.test(e))).toBe(true);
  });
});

describe("autoLayout", () => {
  it("returns a position for every node", () => {
    const pos = autoLayout([{ id: "a" }, { id: "b" }], [{ source: "a", target: "b" }]);
    expect(pos.has("a")).toBe(true);
    expect(pos.has("b")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// composer/canvas-graph.ts — convert between the DB workflow graph and the
// react-flow canvas, and back. Pure + dependency-light (dagre is CJS) so the
// round-trip is unit-testable without pulling react-flow into jest.
//
// Node identity on the canvas is the composer node KEY (stable across saves;
// edges reference keys). Canvas positions live in the node's existing
// `config._ui = {x,y}` — no schema column. Workflows authored before the canvas
// (e.g. the seeded "Software Delivery") have no positions, so we auto-lay-out
// with dagre on load.
// ═══════════════════════════════════════════════════════════════

import dagre from "@dagrejs/dagre";
import type { ComposerWorkflowGraph, NodeGate, WorkflowDef } from "./schema";

/** A node on the canvas (field names match react-flow's Node). */
interface CanvasNode {
  id: string; // = composer node key
  position: { x: number; y: number };
  data: {
    label: string;
    kind: string;
    gate: NodeGate;
    isStart: boolean;
    isTerminal: boolean;
    /** Per-kind config (research query, group workflowRef, …) — WITHOUT `_ui`. */
    config: Record<string, unknown> | null;
  };
}

/** An edge on the canvas (field names match react-flow's Edge). */
interface CanvasEdge {
  id: string;
  source: string; // from key
  target: string; // to key
  data: { condition: string; label: string | null };
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const NODE_W = 210;
const NODE_H = 74;

function readUi(config: Record<string, unknown> | null): { x: number; y: number } | null {
  if (!config) return null;
  const ui = config._ui;
  if (ui && typeof ui === "object") {
    const o = ui as Record<string, unknown>;
    if (typeof o.x === "number" && typeof o.y === "number") return { x: o.x, y: o.y };
  }
  return null;
}

function withoutUi(config: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!config) return null;
  const rest = { ...config };
  delete rest._ui;
  return Object.keys(rest).length ? rest : null;
}

/** Tidy top-to-bottom auto-layout via dagre. Returns top-left positions per key. */
export function autoLayout(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 80, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target);
  }
  dagre.layout(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id) as { x: number; y: number } | undefined;
    out.set(n.id, p ? { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } : { x: 0, y: 0 });
  }
  return out;
}

/** DB graph → canvas. Uses saved `config._ui` positions, or dagre when absent. */
export function graphToCanvas(graph: ComposerWorkflowGraph): CanvasState {
  const ordered = [...graph.nodes].sort((a, b) => a.pos - b.pos);
  const keyById = new Map(graph.nodes.map((n) => [n.id, n.key]));

  const saved = new Map<string, { x: number; y: number }>();
  let missing = false;
  for (const n of ordered) {
    const p = readUi(n.config);
    if (p) saved.set(n.key, p);
    else missing = true;
  }
  // If any node lacks a saved position, lay the whole graph out fresh (avoids a
  // half-stacked mess from mixing saved + origin coords).
  const positions = missing
    ? autoLayout(
        ordered.map((n) => ({ id: n.key })),
        graph.edges.map((e) => ({ source: keyById.get(e.fromNodeId) ?? "", target: keyById.get(e.toNodeId) ?? "" })),
      )
    : saved;

  const nodes: CanvasNode[] = ordered.map((n) => ({
    id: n.key,
    position: positions.get(n.key) ?? { x: 0, y: 0 },
    data: {
      label: n.label,
      kind: n.kind,
      gate: n.gate,
      isStart: n.isStart,
      isTerminal: n.isTerminal,
      config: withoutUi(n.config),
    },
  }));

  const edges: CanvasEdge[] = graph.edges.map((e) => ({
    id: e.id,
    source: keyById.get(e.fromNodeId) ?? "",
    target: keyById.get(e.toNodeId) ?? "",
    data: { condition: e.condition, label: e.label },
  }));

  return { nodes, edges };
}

/** Canvas → a WorkflowDef ready for POST/PUT (positions folded back into config._ui). */
/**
 * @param description  Omit to leave the stored description alone; pass "" to
 *                     clear it. The two-argument form is what every caller
 *                     used, which is why a save blanked it (T-0106, D2).
 */
export function canvasToWorkflowDef(name: string, state: CanvasState, description?: string): WorkflowDef {
  return {
    name: name.trim(),
    // Only when one was passed: the key must be ABSENT for the write to leave
    // the stored description alone.
    ...(description === undefined ? {} : { description: description.trim() }),
    nodes: state.nodes.map((n, i) => {
      const baseConfig = n.data.config ?? {};
      return {
        key: n.id,
        label: n.data.label.trim(),
        kind: n.data.kind,
        gate: n.data.gate,
        isStart: n.data.isStart,
        isTerminal: n.data.isTerminal,
        config: { ...baseConfig, _ui: { x: Math.round(n.position.x), y: Math.round(n.position.y) } },
        pos: i,
      } as WorkflowDef["nodes"][number];
    }),
    edges: state.edges
      .filter((e) => e.source && e.target)
      .map((e) => ({
        from: e.source,
        to: e.target,
        condition: e.data.condition?.trim() || "always",
        label: e.data.label?.trim() || undefined,
      })),
  };
}

/** Friendly pre-save validation (mirrors what the repo/zod would reject). */
/**
 * The stage kinds that exist to produce something.
 *
 * Everything but `custom` runs an agent, so everything but `custom` is a stage
 * a reader would expect output from. `custom` is what the shipped end markers
 * use, and it stays allowed at the end for exactly that reason.
 */
const WORKING_STAGE_KINDS = ["documentation", "review", "research", "implementation", "planning", "testing"];

export function validateCanvas(state: CanvasState): string[] {
  const errors: string[] = [];
  if (state.nodes.length === 0) errors.push("Add at least one stage.");
  if (state.nodes.some((n) => !n.data.label.trim())) errors.push("Every stage needs a label.");
  if (state.nodes.some((n) => n.data.label.trim() === "New stage"))
    errors.push('Rename the placeholder "New stage" stage(s) before saving.');
  const ids = new Set(state.nodes.map((n) => n.id));
  for (const e of state.edges) {
    if (e.source && !ids.has(e.source)) errors.push(`A route starts from an unknown stage.`);
    if (e.target && !ids.has(e.target)) errors.push(`A route points to an unknown stage.`);
  }
  if (state.nodes.length > 0 && !state.nodes.some((n) => n.data.isStart)) {
    errors.push("Mark one stage as the Start.");
  }
  // A stage marked End is where the run STOPS, and the engine completes the run
  // on reaching it without dispatching it. So an End stage that was given work
  // to do never does that work, and the run reports success anyway. This shipped
  // once in a starter workflow, where it meant the summary was never written;
  // the End toggle sits on every stage in the inspector, so without this any
  // operator can build the same silence for themselves.
  for (const n of state.nodes) {
    if (!n.data.isTerminal) continue;
    if (!WORKING_STAGE_KINDS.includes(n.data.kind)) continue;
    errors.push(
      `"${n.data.label.trim() || n.id}" is marked End, so nothing runs there. ` +
        `Add a stage after it, or clear End on it.`,
    );
  }
  return [...new Set(errors)];
}

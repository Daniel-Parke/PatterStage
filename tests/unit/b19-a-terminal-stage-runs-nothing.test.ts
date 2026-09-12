/**
 * T-0113: a terminal stage is an end marker, and the seeds must respect that.
 *
 * Found by the real-Hermes round, driving the starter workflow the quest ledger
 * points a newcomer at. "Research then summarise" ran its research, asked for a
 * decision at its gate, and on approval reported `completed` having never
 * written the summary. The flagship feature announced success for skipping its
 * only deliverable.
 *
 * The cause is a contract nobody wrote down. `applyNext` short-circuits a
 * terminal node to completed WITHOUT dispatching it -- the comment beside it
 * says "the end-marker runs no agent" -- so `isTerminal` means "this stage does
 * nothing". The seed marked `write`, a documentation stage that does the actual
 * work, as terminal.
 *
 * The author knew: DEFAULT_DRAFT_REVIEW_WORKFLOW two definitions later carries a
 * comment about this exact trap and ends with an inert `done` marker. And the
 * existing suite asserted `write.isTerminal === true`, which locked the defect
 * in and is why nine batches passed over it.
 *
 * So this file pins the CONTRACT rather than the one seed:
 *   1. no shipped workflow ends on a stage that was supposed to do work;
 *   2. every shipped workflow can actually reach an end;
 *   3. the Build tab refuses to let an operator recreate it by hand.
 */

import {
  DEFAULT_RESEARCH_SUMMARISE_WORKFLOW,
  DEFAULT_DRAFT_REVIEW_WORKFLOW,
  DEFAULT_SOFTWARE_DELIVERY_WORKFLOW,
} from "@/lib/composer/schema";
import { validateCanvas } from "@/lib/composer/canvas-graph";

/**
 * The kinds that exist to run something.
 *
 * `custom` is the only kind an inert end marker uses in the shipped seeds, so
 * everything else is a stage a reader would expect to produce output.
 */
const WORKING_KINDS = ["documentation", "review", "research", "implementation", "planning", "testing"];

const SEEDS = [
  ["Research then summarise", DEFAULT_RESEARCH_SUMMARISE_WORKFLOW],
  ["Draft and review", DEFAULT_DRAFT_REVIEW_WORKFLOW],
  ["Software delivery", DEFAULT_SOFTWARE_DELIVERY_WORKFLOW],
] as const;

describe("a terminal stage runs no agent, so it must not be a stage that does work", () => {
  it.each(SEEDS)("%s ends on an inert marker, not on its deliverable", (_name, wf) => {
    const terminals = wf.nodes.filter((n) => n.isTerminal);
    expect(terminals.length).toBeGreaterThan(0);
    // Mapped to strings rather than asserted in a loop, so a failure PRINTS the
    // offending stage and its kind instead of just "expected true to be false".
    const doingWork = terminals
      .filter((t) => WORKING_KINDS.includes(t.kind ?? ""))
      .map((t) => `${t.label} (kind: ${t.kind}) is terminal, so it never runs`);
    expect(doingWork).toEqual([]);
  });

  it.each(SEEDS)("%s can reach a terminal stage from its start", (_name, wf) => {
    // A workflow whose end marker is unreachable is the mirror defect: it would
    // run forever rather than finish early.
    const byKey = new Map(wf.nodes.map((n) => [n.key, n]));
    const out = new Map<string, string[]>();
    for (const e of wf.edges ?? []) out.set(e.from, [...(out.get(e.from) ?? []), e.to]);

    const start = wf.nodes[0].key;
    const seen = new Set<string>();
    const queue = [start];
    let reachedTerminal = false;
    while (queue.length) {
      const k = queue.shift()!;
      if (seen.has(k)) continue;
      seen.add(k);
      if (byKey.get(k)?.isTerminal) reachedTerminal = true;
      for (const n of out.get(k) ?? []) queue.push(n);
    }
    expect(reachedTerminal).toBe(true);
  });

  it("Research then summarise still writes its summary before it ends", () => {
    // The specific regression, named: the deliverable must be a dispatched
    // stage with something after it, not the thing the run stops on.
    const wf = DEFAULT_RESEARCH_SUMMARISE_WORKFLOW;
    const write = wf.nodes.find((n) => n.key === "write");
    expect(write).toBeDefined();
    expect(write!.isTerminal).toBeFalsy();
    expect((wf.edges ?? []).some((e) => e.from === "write")).toBe(true);
  });
});

describe("the Build tab refuses what the engine cannot honour", () => {
  const node = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    position: { x: 0, y: 0 },
    data: { label: id, kind: "custom", gate: "auto", isStart: false, isTerminal: false, ...over },
  });

  const state = (nodes: ReturnType<typeof node>[], edges: { source: string; target: string }[] = []) =>
    ({ nodes, edges: edges.map((e, i) => ({ id: `e${i}`, ...e })) }) as never;

  it("GREEN CONTROL: a sound canvas is accepted", () => {
    expect(
      validateCanvas(
        state(
          [node("a", { isStart: true, kind: "research" }), node("b", { isTerminal: true })],
          [{ source: "a", target: "b" }],
        ),
      ),
    ).toEqual([]);
  });

  it("refuses a terminal stage that was given work to do", () => {
    // Without this an operator can rebuild the shipped defect by hand: the End
    // toggle sits on every stage in the inspector with nothing to warn them.
    const errors = validateCanvas(
      state([node("a", { isStart: true }), node("b", { isTerminal: true, kind: "documentation", label: "Write it up" })]),
    );
    expect(errors.join(" ")).toMatch(/Write it up/);
    expect(errors.join(" ").toLowerCase()).toMatch(/end|terminal|never runs/);
  });

  it("still accepts an inert end marker", () => {
    const errors = validateCanvas(
      state([node("a", { isStart: true }), node("b", { isTerminal: true, kind: "custom", label: "Done" })]),
    );
    expect(errors).toEqual([]);
  });
});

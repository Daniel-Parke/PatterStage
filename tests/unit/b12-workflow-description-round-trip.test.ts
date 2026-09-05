/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3 is resolution-mapped to a stub for the suite; the real CJS entry is required directly here, exactly as composer-builder.test.ts does, so these assertions run against real SQL */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group description (D2, major).
//
// Written before the product code moved. Contract section 2: a workflow's
// description survives a save from the Build tab.
//
// Today it cannot. `canvasToWorkflowDef` returns { name, nodes, edges };
// `workflowDefSchema` defaults `description` to ""; `replaceWorkflowGraph`
// writes that "" over the stored sentence. So opening the seeded "Software
// Delivery" workflow, moving one node, and saving silently erases the only
// text that says what the workflow is for -- and there is no field on the
// toolbar to type it back in.
//
// Three levels, because the defect spans three: the pure converter (does the
// description reach the body at all), the schema (is "absent" still
// distinguishable from "empty"), and the SQL (does absent mean keep and empty
// mean clear). The middle one is the load-bearing distinction: without it,
// COALESCE can never fire, because zod would have turned every absent
// description into "" before the repository saw it.
//
// The database is real SQLite over the real baseline schema plus the composer
// migrations -- the same harness composer-builder.test.ts uses.
// ═══════════════════════════════════════════════════════════════

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});
jest.mock("@/lib/runtime", () => ({
  runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() },
}));

import {
  createWorkflowFromDef,
  getWorkflowGraph,
  replaceWorkflowGraph,
} from "@/lib/composer/composer-repository";
import { canvasToWorkflowDef, graphToCanvas } from "@/lib/composer/canvas-graph";
import { workflowDefSchema } from "@/lib/composer/schema";
import type { CanvasState } from "@/lib/composer/canvas-graph";
import type { WorkflowDef } from "@/lib/composer/schema";

// ── pre-B12 type shim: the converter gains a third argument ─────
//
// The two-argument form is still legal (contract 2.2, and
// composer-canvas-graph.test.ts calls it that way), so the shim WIDENS rather
// than replaces. Casting keeps `npm run typecheck:tests` green today while
// the assertions below run against the three-argument behaviour.
type ToDef = (name: string, state: CanvasState, description?: string) => WorkflowDef;
const toWorkflowDef = canvasToWorkflowDef as ToDef;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

const ONE_NODE: WorkflowDef["nodes"] = [
  { key: "a", label: "A", kind: "custom", gate: "auto", isStart: true, isTerminal: true },
];

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyComposerMigration(testDb, migrationsDir);
  applyComposerGroupLinkMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function seeded(description = "What this pipeline is for.") {
  return createWorkflowFromDef({ name: "Pipeline", description, nodes: ONE_NODE, edges: [] });
}

// ═══════════════════════════════════════════════════════════════
// The converter
// ═══════════════════════════════════════════════════════════════

describe("canvasToWorkflowDef carries the description the builder is holding", () => {
  const CANVAS: CanvasState = {
    nodes: [
      {
        id: "a",
        position: { x: 0, y: 0 },
        data: { label: "A", kind: "custom", gate: "auto", isStart: true, isTerminal: true, config: null },
      },
    ],
    edges: [],
  };

  it("a description passed in reaches the body, trimmed", () => {
    const def = toWorkflowDef("WF", CANVAS, "  Ships the thing.  ");
    expect(def.description).toBe("Ships the thing.");
  });

  it("an empty description passed in is sent as empty, so a cleared field clears the row", () => {
    const def = toWorkflowDef("WF", CANVAS, "");
    expect(def.description).toBe("");
    expect(Object.prototype.hasOwnProperty.call(def, "description")).toBe(true);
  });

  it("no description passed in leaves the key OFF the body entirely", () => {
    // Absent is not empty: it is what an older caller sends, and what the
    // repository must read as "keep whatever is stored".
    const def = toWorkflowDef("WF", CANVAS);
    expect(Object.prototype.hasOwnProperty.call(def, "description")).toBe(false);
  });

  it("GREEN CONTROL: the rest of the round trip is unchanged", () => {
    const wf = seeded();
    const def = toWorkflowDef("WF v2", graphToCanvas(getWorkflowGraph(wf.id)!), "New words.");
    expect(def.name).toBe("WF v2");
    expect(def.nodes.map((n) => n.key)).toEqual(["a"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// The schema
// ═══════════════════════════════════════════════════════════════

describe("workflowDefSchema keeps absent and empty apart", () => {
  it("an absent description parses to undefined, not to an empty string", () => {
    const parsed = workflowDefSchema.parse({ name: "WF", nodes: ONE_NODE });
    expect(parsed.description).toBeUndefined();
  });

  it("GREEN CONTROL: an explicit description still parses through untouched", () => {
    const parsed = workflowDefSchema.parse({ name: "WF", description: "Words.", nodes: ONE_NODE });
    expect(parsed.description).toBe("Words.");
  });

  it("GREEN CONTROL: an explicit empty string is still an empty string", () => {
    const parsed = workflowDefSchema.parse({ name: "WF", description: "", nodes: ONE_NODE });
    expect(parsed.description).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════
// The SQL
// ═══════════════════════════════════════════════════════════════

describe("replaceWorkflowGraph only writes a description it was given", () => {
  it("a save with no description keeps the stored one", () => {
    const wf = seeded("What this pipeline is for.");

    const replaced = replaceWorkflowGraph(wf.id, { name: "Pipeline v2", nodes: ONE_NODE, edges: [] })!;

    expect(replaced.description).toBe("What this pipeline is for.");
    expect(getWorkflowGraph(wf.id)!.description).toBe("What this pipeline is for.");
  });

  it("a save that carries a new description writes it", () => {
    const wf = seeded("Old words.");

    const replaced = replaceWorkflowGraph(wf.id, {
      name: "Pipeline",
      description: "New words.",
      nodes: ONE_NODE,
      edges: [],
    })!;

    expect(replaced.description).toBe("New words.");
  });

  it("a save that carries an empty description clears the row, so a cleared field stays cleared", () => {
    const wf = seeded("Old words.");

    replaceWorkflowGraph(wf.id, { name: "Pipeline", description: "", nodes: ONE_NODE, edges: [] });

    expect(getWorkflowGraph(wf.id)!.description).toBe("");
  });

  it("the whole builder path: load, relabel, save, and the sentence is still there", () => {
    // The exact walk from the defect: open a described workflow in Build,
    // change the graph, save. Nothing on the toolbar touched the description,
    // so nothing about it may change.
    const wf = seeded("Methodical feature/bug pipeline.");
    const canvas = graphToCanvas(getWorkflowGraph(wf.id)!);

    replaceWorkflowGraph(wf.id, toWorkflowDef("Pipeline", canvas));

    expect(getWorkflowGraph(wf.id)!.description).toBe("Methodical feature/bug pipeline.");
  });

  it("GREEN CONTROL: a create with no description still stores an empty string, never null", () => {
    const wf = createWorkflowFromDef({ name: "Bare", nodes: ONE_NODE, edges: [] });
    expect(getWorkflowGraph(wf.id)!.description).toBe("");
  });

  it("GREEN CONTROL: the keyed re-create keeps a description it was not given", () => {
    createWorkflowFromDef({ key: "keyed", name: "Keyed", description: "Kept.", nodes: ONE_NODE, edges: [] });

    const again = createWorkflowFromDef({ key: "keyed", name: "Keyed v2", nodes: ONE_NODE, edges: [] });

    expect(again.description).toBe("Kept.");
    expect(again.version).toBe(2);
  });
});

/** @jest-environment node */

// T-0069 acceptance oracle — a rejected Composer gate must say so, and must not
// strand the operator.
//
// WHAT WORKS ALREADY, and is pinned here so the fix cannot regress it: rejecting
// a gate that has no `on_reject` edge ends the run with a genuinely good
// sentence, built by describeStageFailure -- "Gate A was rejected and the
// workflow has no recovery path from here."
//
// WHAT DOES NOT. That sentence is written to `composer_runs.error` and then
// never reaches a human:
//
//   1. The approve route's guard answers a bare "Run is not awaiting approval"
//      while run.status, run.error and run.currentNodeId are all in scope. The
//      exact sentence the operator needs is sitting in the variable being
//      tested.
//   2. The rejected gate's NODE-run is never updated. applyNext's fail branch
//      writes only the run row, so the node keeps whatever
//      finalizeComposerNodeRun left on it -- `completed`. The canvas therefore
//      draws the gate GREEN, labelled completed, two elements below a pink
//      "failed" run header. The canvas contradicts the status line.
//
// THE OPERATOR RULED (2026-08-31) for a distinct `rejected` terminal state
// rather than reusing `failed`, so a rejection can be rendered as the deliberate
// act it is rather than as a defect. That needs migration 035, because SQLite
// cannot ALTER a CHECK constraint.
//
// Note `cancelled` is already dead vocabulary on composer_runs: it is in the
// CHECK and in the union, read in two places, and written nowhere. `rejected`
// must not become a second one, which is why the engine assertions below check
// it is actually WRITTEN rather than merely permitted.

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf-8");

describe("the schema admits a rejected terminal state", () => {
  it("migration 035 exists and widens both composer CHECK constraints", () => {
    const sql = read("src", "lib", "db", "migrations", "035_composer_rejected.sql");
    // Both tables: a rejected RUN needs the status, and so does the gate's
    // node-run, or the canvas cannot tell a rejection from a stage crash.
    expect(sql).toMatch(/composer_runs/);
    expect(sql).toMatch(/composer_node_runs/);
    expect(sql.match(/'rejected'/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("the head constant moves with it", () => {
    expect(read("src", "lib", "db-schema.ts")).toMatch(/MIGRATION_HEAD_SCHEMA_VERSION = 35/);
  });

  it("both TypeScript unions carry it", () => {
    const schema = read("src", "lib", "composer", "schema.ts");
    const runStatus = schema.slice(
      schema.indexOf("export type ComposerRunStatus"),
      schema.indexOf("export type NodeRunStatus"),
    );
    const nodeStatus = schema.slice(schema.indexOf("export type NodeRunStatus"));
    expect(runStatus).toMatch(/"rejected"/);
    expect(nodeStatus.slice(0, 200)).toMatch(/"rejected"/);
  });

  it("rejected is treated as terminal, so the engine stops rather than looping", () => {
    expect(read("src", "lib", "composer", "engine.ts")).toMatch(
      /TERMINAL_RUN_STATUSES[^\n]*rejected/,
    );
  });
});

describe("a rejected gate is written as rejected, not left looking completed", () => {
  it("the fail branch distinguishes a rejection from a failure", () => {
    // resolveNext already knows which it was: `cond` is "on_reject" for a
    // rejected gate and "on_fail" for a crashed stage. That distinction was
    // computed and then thrown away when applyNext collapsed both into
    // status:"failed" on the run and nothing at all on the node.
    const engine = read("src", "lib", "composer", "engine.ts");
    const failBranch = engine.slice(engine.indexOf('if (next.kind === "fail")'));
    expect(failBranch.slice(0, 700)).toMatch(/rejected/);
  });

  it("the node-run is updated too, so the canvas cannot contradict the header", () => {
    const engine = read("src", "lib", "composer", "engine.ts");
    const failBranch = engine.slice(engine.indexOf('if (next.kind === "fail")'));
    // It used to write only updateComposerRun. The gate's own row kept
    // "completed" from finalizeComposerNodeRun and rendered green.
    expect(failBranch.slice(0, 700)).toMatch(/updateComposerNodeRun|finalizeComposerNodeRun/);
  });
});

describe("the approve route explains the state it is refusing from", () => {
  const route = read(
    "src", "app", "api", "composer", "runs", "[id]", "nodes", "[nodeId]", "approve", "route.ts",
  );

  it("does not answer with the bare guard message", () => {
    // "Run is not awaiting approval" is true and useless. It does not say the
    // run already ended, why, or what the operator can do next.
    const bare = /badRequest\(\s*["'`]Run is not awaiting approval["'`]\s*\)/;
    expect(route).not.toMatch(bare);
  });

  it("uses the reason already stored on the run", () => {
    // describeStageFailure computed the sentence and applyNext stored it. The
    // guard has `run` in scope and was discarding it.
    expect(route).toMatch(/run\.error/);
  });

  it("names the state IN THE MESSAGE, not just in the guard it fails", () => {
    // A first draft of this asserted /run\.status/ against the whole file and
    // passed trivially, because the guard condition itself mentions it. The
    // claim is that the REFUSAL carries the state, so it has to be scoped to
    // the refusal.
    const guard = route.slice(route.indexOf('run.status !== "awaiting_approval"'));
    const refusal = guard.slice(0, guard.indexOf("recordComposerApproval"));
    expect(refusal).toMatch(/\$\{[^}]*run\.status/);
  });
});

describe("the UI shows the refusal instead of swallowing it", () => {
  it("decideGate checks the result rather than discarding it", () => {
    // safeApiCall RETURNS { ok, error } rather than throwing, and the return
    // value was dropped. So in the race this actually happens in -- poll lag
    // leaves a stale gate panel on a run that just failed, the operator clicks
    // Accept -- the 400 landed and nothing appeared on screen at all. The
    // button simply stopped spinning. A better message written to a response
    // nobody reads is not an improvement.
    const page = read("src", "app", "orchestration", "composer", "page.tsx");
    const fn = page.slice(page.indexOf("const decideGate"));
    const body = fn.slice(0, fn.indexOf("\n  }, ["));
    expect(body).toMatch(/\.ok|result\.error|showToast|setError/);
  });
});

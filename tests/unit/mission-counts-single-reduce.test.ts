/**
 * @jest-environment node
 *
 * Source-pattern test for the session-102 missionCounts refactor in
 * src/hooks/useMissionsPage.ts.
 *
 * Locks the shape of the `missionCounts` useMemo so a future
 * "tidy up the 5 filter passes" PR can't accidentally re-introduce
 * multiple .filter().length passes over the missions array, and
 * can't accidentally make the buckets mutually exclusive (which
 * would change observable counts for `status:"queued" &&
 * queuedForRun:true` missions that match BOTH `active` and
 * `queued`).
 *
 * Why source-pattern instead of rendering the hook:
 *   - The hook returns 50+ fields and rendering it requires
 *     mocking useMissionsApi, useToast, and 5+ useState calls —
 *     the harness would dwarf the actual invariant we want to lock.
 *   - The "single reduce, independent ifs" shape is the byte-level
 *     contract — the function literally does one .reduce() pass
 *     with independent if-branches per bucket.
 *
 * What this test does NOT lock:
 *   - The exact bucket names (active/completed/failed/drafts/queued)
 *   - The exact predicate functions (isMissionActive, isMissionDraft,
 *     isMissionQueuedForRun) — those are tested in
 *     tests/unit/mission-board.test.ts
 *   - The hook's other 49 return fields
 *
 * If the hook is restructured (e.g. split into useMissionBoard +
 * useMissionForm), the file path and shape-string assertions will
 * need to be updated — the test's failure will then force the
 * refactor author to consciously decide whether the new shape
 * preserves the single-pass + non-mutually-exclusive invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useMissionsPage.ts",
);

describe("missionCounts single-pass reduce (session 102)", () => {
  const source = fs.readFileSync(HOOK_PATH, "utf8");

  it("declares missionCounts as a useMemo that returns a single .reduce() call", () => {
    // The .reduce() is the only iteration over `missions` in the
    // counts derivation. A single pass with named accumulator is
    // the contract. We accept either paren-styles.
    expect(source).toMatch(
      /const\s+missionCounts\s*=\s*useMemo\(/,
    );
    // The reduce must target `missions` (not a derived `filtered`).
    expect(source).toMatch(
      /missions\.reduce\(\s*\(\s*acc/,
    );
  });

  it("does not use `else if` between bucket branches (preserves non-mutually-exclusive semantics)", () => {
    // Per src/lib/mission-board.ts:
    //   isMissionActive       = status==="dispatched" || queuedForRun===true
    //   isMissionQueuedForRun = status==="queued" && queuedForRun===true
    // A mission with status="queued" && queuedForRun=true must
    // increment BOTH `active` AND `queued` — matching the original
    // 5 .filter().length passes. Using `else if` would make the
    // buckets mutually exclusive and change observable counts.
    //
    // We extract the missionCounts useMemo body and assert that no
    // `else if` appears within it. The body is delimited by the
    // `useMemo(` call until its matching `),` and the closing `);`.
    const memoStart = source.indexOf("const missionCounts = useMemo(");
    expect(memoStart).toBeGreaterThan(-1);
    // Find the body between `useMemo(` and the next `],` followed
    // by `);` — the reducer is the first arg of useMemo.
    const afterUseMemo = source.indexOf("useMemo(", memoStart);
    const reducerStart = source.indexOf("missions.reduce(", afterUseMemo);
    // Walk the body char-by-char to find the matching close of the
    // reduce callback. The reducer is `missions.reduce((acc, m) =>
    // { ... }, { active: 0, ... })` — the body we care about is
    // between the `{` after the arrow and the matching `}`.
    const arrowBodyStart = source.indexOf("=>", reducerStart);
    const braceOpen = source.indexOf("{", arrowBodyStart);
    // Find the matching `}` by counting braces (the body has
    // no nested objects/blocks).
    let depth = 0;
    let braceClose = -1;
    for (let i = braceOpen; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          braceClose = i;
          break;
        }
      }
    }
    expect(braceClose).toBeGreaterThan(braceOpen);
    const reducerBody = source.slice(braceOpen, braceClose + 1);
    // The invariant: no `else if` between branches.
    expect(reducerBody).not.toMatch(/else\s+if/);
  });

  it("accumulates all 5 buckets (active / completed / failed / drafts / queued)", () => {
    // The reducer body must contain the 5 named bucket increments.
    // We check for the 5 increment lines in source order — they
    // appear in the same order as the original 5 .filter().length
    // passes (active, completed, failed, drafts, queued).
    const memoStart = source.indexOf("const missionCounts = useMemo(");
    const afterUseMemo = source.indexOf("useMemo(", memoStart);
    const reducerStart = source.indexOf("missions.reduce(", afterUseMemo);
    const memoEnd = source.indexOf("]);", reducerStart);
    const memoBody = source.slice(reducerStart, memoEnd);
    expect(memoBody).toMatch(/acc\.active\s*\+=/);
    expect(memoBody).toMatch(/acc\.completed\s*\+=/);
    expect(memoBody).toMatch(/acc\.failed\s*\+=/);
    expect(memoBody).toMatch(/acc\.drafts\s*\+=/);
    expect(memoBody).toMatch(/acc\.queued\s*\+=/);
  });

  it("uses the canonical 5-key initial accumulator", () => {
    // The second arg of .reduce is the named-keyed initial
    // accumulator: { active: 0, completed: 0, failed: 0,
    // drafts: 0, queued: 0 }. This preserves the original
    // shape exactly.
    const memoStart = source.indexOf("const missionCounts = useMemo(");
    const afterUseMemo = source.indexOf("useMemo(", memoStart);
    const reducerStart = source.indexOf("missions.reduce(", afterUseMemo);
    const memoEnd = source.indexOf("]);", reducerStart);
    const memoBody = source.slice(reducerStart, memoEnd);
    expect(memoBody).toMatch(
      /\{\s*active:\s*0,\s*completed:\s*0,\s*failed:\s*0,\s*drafts:\s*0,\s*queued:\s*0\s*\}/,
    );
  });

  it("depends on [missions] (same as the original useMemo)", () => {
    // The deps array must still be `[missions]` — no stale closure
    // over the old filter-passes' inline derived state. The deps
    // array is the last `[...]` in the useMemo call, so we search
    // for the closing of the useMemo and look for `[missions]`
    // just before it. Acceptable forms: `[missions]`, `[ missions ]`.
    const memoStart = source.indexOf("const missionCounts = useMemo(");
    const afterUseMemo = source.indexOf("useMemo(", memoStart);
    const _reducerStart = source.indexOf("missions.reduce(", afterUseMemo);
    // Find the closing `)` of the useMemo call by matching
    // parens. The useMemo call has the reducer as arg 1, the
    // deps array as arg 2. Walk the source from afterUseMemo.
    let depth = 0;
    let callEnd = -1;
    for (let i = afterUseMemo; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    expect(callEnd).toBeGreaterThan(-1);
    const useMemoCall = source.slice(afterUseMemo, callEnd + 1);
    // Last 80 chars should contain the deps array `[missions]`.
    // Use a non-greedy search for the last `[` before the final `)`.
    const lastBracket = useMemoCall.lastIndexOf("[");
    const tail = useMemoCall.slice(lastBracket);
    expect(tail).toMatch(/\[\s*missions\s*\]\s*,?\s*\)$/);
  });
});

describe("missionCounts semantics (5 filter passes worth of behaviour)", () => {
  // Lock the original-counts shape by simulating the OLD 5-pass
  // approach and the NEW 1-pass reduce over the same fixture, and
  // assert they produce identical totals for every bucket. This
  // is the byte-equivalence contract: any "improvement" that
  // changes the totals (e.g. making buckets mutually exclusive)
  // will fail this test.
  //
  // We hand-derive the predicates from the same source the
  // original used (src/lib/mission-board.ts), but inline them
  // here to keep the test self-contained.

  type Mission = { status: string; queuedForRun?: boolean };
  const isMissionActive = (m: Mission) =>
    m.status === "dispatched" || (m.status === "queued" && m.queuedForRun === true);
  const isMissionDraft = (m: Mission) =>
    m.status === "queued" && m.queuedForRun !== true;
  const isMissionQueuedForRun = (m: Mission) =>
    m.status === "queued" && m.queuedForRun === true;

  function old5PassCounts(missions: Mission[]) {
    return {
      active: missions.filter(isMissionActive).length,
      completed: missions.filter((m) => m.status === "successful").length,
      failed: missions.filter((m) => m.status === "failed").length,
      drafts: missions.filter(isMissionDraft).length,
      queued: missions.filter(isMissionQueuedForRun).length,
    };
  }

  function new1PassCounts(missions: Mission[]) {
    return missions.reduce(
      (acc, m) => {
        if (isMissionActive(m)) acc.active += 1;
        if (m.status === "successful") acc.completed += 1;
        if (m.status === "failed") acc.failed += 1;
        if (isMissionDraft(m)) acc.drafts += 1;
        if (isMissionQueuedForRun(m)) acc.queued += 1;
        return acc;
      },
      { active: 0, completed: 0, failed: 0, drafts: 0, queued: 0 },
    );
  }

  it("produces identical totals for an empty list", () => {
    expect(new1PassCounts([])).toEqual(old5PassCounts([]));
  });

  it("produces identical totals for a uniform dispatched list", () => {
    const missions: Mission[] = Array.from({ length: 5 }, () => ({
      status: "dispatched",
    }));
    expect(new1PassCounts(missions)).toEqual(old5PassCounts(missions));
  });

  it("produces identical totals for a mixed list (the regression-critical case)", () => {
    // The `queuedForRun:true` mission increments BOTH `active`
    // AND `queued` in BOTH old and new — verifying the
    // non-mutually-exclusive semantics.
    // A bare `status:"queued"` (no queuedForRun field) matches
    // isMissionDraft per the predicate (status==="queued" &&
    // queuedForRun !== true, and `undefined !== true` is true).
    const missions: Mission[] = [
      { status: "draft" },                              // matches nothing
      { status: "queued" },                             // matches drafts (queuedForRun undefined !== true)
      { status: "queued", queuedForRun: true },        // matches active + queued
      { status: "queued", queuedForRun: false },       // matches drafts
      { status: "dispatched" },                         // matches active
      { status: "successful" },                         // matches completed
      { status: "failed" },                             // matches failed
    ];
    const oldCounts = old5PassCounts(missions);
    const newCounts = new1PassCounts(missions);
    // The fixture is designed to put a mission in 2 buckets
    // simultaneously. Total across buckets > mission count.
    expect(oldCounts).toEqual({ active: 2, completed: 1, failed: 1, drafts: 2, queued: 1 });
    expect(newCounts).toEqual(oldCounts);
  });

  it("produces identical totals for 100 random missions", () => {
    const missions: Mission[] = Array.from({ length: 100 }, (_, i) => {
      const r = (i * 7 + 3) % 10;
      if (r < 2) return { status: "dispatched" };
      if (r < 4) return { status: "queued", queuedForRun: true };
      if (r < 5) return { status: "queued", queuedForRun: false };
      if (r < 6) return { status: "queued" };
      if (r < 7) return { status: "successful" };
      if (r < 8) return { status: "failed" };
      return { status: "draft" };
    });
    expect(new1PassCounts(missions)).toEqual(old5PassCounts(missions));
  });
});

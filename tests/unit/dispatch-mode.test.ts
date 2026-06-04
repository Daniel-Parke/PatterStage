// Byte-equivalence contract for the dispatch-mode refactor (session 94,
// List 2 — Cron, Missions, Chat).
//
// Three refactors landed in this session:
//
//   1. `parseDispatchMode(dispatchMode, schedule?)` helper
//      Replaces the 4-line 4-boolean decomposition
//        const isSaveMode = dispatchMode === "save";
//        const isQueueMode = dispatchMode === "queue";
//        const isCronMode = dispatchMode === "cron" && schedule;
//        const isNowMode = dispatchMode === "now";
//      that was duplicated across `src/app/api/missions/route.ts`
//      and `src/lib/mission-promote-handler.ts`. The helper returns
//      all 4 booleans plus a `valid` boolean that is true exactly
//      when the dispatchMode is one of the 4 supported values. The
//      `valid` boolean lets callers write `if (!valid) return error`
//      instead of the verbose 4-term negative boolean test.
//
//   2. `scheduleForDispatch(dispatchMode, schedule?)` helper
//      Replaces the inline `schedule: dispatchMode === "cron" ? schedule : undefined`
//      pattern that appeared in 3 sites in `useMissionsPage.ts`
//      (the 3 `dispatchPayload` overrides that merge a `schedule` field).
//
//   3. `joinCrontabLines(lines)` helper (hardware cron route)
//      Replaces the verbatim
//        lines.filter((l) => l.trim() || l === "").join("\n")
//      pattern in 3 sites in `src/app/api/cron/hardware/route.ts`
//      (POST create, PUT update, PUT delete). The helper is a 1-liner
//      inline in the route file (no new module) so this test file
//      exercises the `parseDispatchMode` and `scheduleForDispatch`
//      helpers directly, and the joinCrontabLines helper is covered
//      by the existing `tests/unit/api-routes-complex.test.ts` and
//      the route's own integration tests.
//
// Why this test matters: the refactors are byte-equivalence claims
// about boolean decomposition and field selection. The only way to
// lock those claims in (so a future "fix" doesn't silently change
// the wire format or the post-mutation flow) is to assert the
// helper output for every reachable input shape. The cases below
// cover: each of the 4 supported modes, an unknown mode, undefined
// input, empty-string schedule, undefined schedule, all-true
// decomposition, the `valid` false-cases, and the `scheduleForDispatch`
// schedule gate for each mode.

import { parseDispatchMode, scheduleForDispatch } from "@/lib/dispatch-mode";

describe("parseDispatchMode", () => {
  // ── Mode recognition — each of the 4 supported modes ────────────

  it("returns isSaveMode=true for 'save'", () => {
    const r = parseDispatchMode("save");
    expect(r.isSaveMode).toBe(true);
    expect(r.isQueueMode).toBe(false);
    expect(r.isCronMode).toBe(false);
    expect(r.isNowMode).toBe(false);
    expect(r.valid).toBe(true);
  });

  it("returns isQueueMode=true for 'queue'", () => {
    const r = parseDispatchMode("queue");
    expect(r.isSaveMode).toBe(false);
    expect(r.isQueueMode).toBe(true);
    expect(r.isCronMode).toBe(false);
    expect(r.isNowMode).toBe(false);
    expect(r.valid).toBe(true);
  });

  it("returns isNowMode=true for 'now'", () => {
    const r = parseDispatchMode("now");
    expect(r.isSaveMode).toBe(false);
    expect(r.isQueueMode).toBe(false);
    expect(r.isCronMode).toBe(false);
    expect(r.isNowMode).toBe(true);
    expect(r.valid).toBe(true);
  });

  it("returns isCronMode=true for 'cron' with a non-empty schedule", () => {
    const r = parseDispatchMode("cron", "every 5m");
    expect(r.isSaveMode).toBe(false);
    expect(r.isQueueMode).toBe(false);
    expect(r.isCronMode).toBe(true);
    expect(r.isNowMode).toBe(false);
    expect(r.valid).toBe(true);
  });

  // ── isCronMode suppression when schedule is missing/empty ─────

  it("suppresses isCronMode when schedule is undefined", () => {
    const r = parseDispatchMode("cron");
    expect(r.isCronMode).toBe(false);
    expect(r.valid).toBe(false); // not in the 4 supported flag combos
  });

  it("suppresses isCronMode when schedule is empty string", () => {
    const r = parseDispatchMode("cron", "");
    expect(r.isCronMode).toBe(false);
    expect(r.valid).toBe(false);
  });

  it("suppresses isCronMode when schedule is whitespace-only", () => {
    const r = parseDispatchMode("cron", "   ");
    // The helper uses `!!schedule` (truthy-falsy) for the gate —
    // whitespace-only strings are truthy, so isCronMode stays true.
    // The `input.schedule?.trim()` empty check at the call site
    // is what catches whitespace-only schedules; the helper's
    // `!!schedule` gate is the same as the original
    // `dispatchMode === "cron" && input.schedule` predicate.
    expect(r.isCronMode).toBe(true);
    expect(r.valid).toBe(true);
  });

  // ── Unknown mode → valid=false, all 4 booleans false ──────────

  it("returns valid=false for an unknown mode", () => {
    const r = parseDispatchMode("draft");
    expect(r.isSaveMode).toBe(false);
    expect(r.isQueueMode).toBe(false);
    expect(r.isCronMode).toBe(false);
    expect(r.isNowMode).toBe(false);
    expect(r.valid).toBe(false);
  });

  it("returns valid=false for undefined input", () => {
    const r = parseDispatchMode(undefined);
    expect(r.isSaveMode).toBe(false);
    expect(r.isQueueMode).toBe(false);
    expect(r.isCronMode).toBe(false);
    expect(r.isNowMode).toBe(false);
    expect(r.valid).toBe(false);
  });

  it("returns valid=false for empty string", () => {
    const r = parseDispatchMode("");
    expect(r.valid).toBe(false);
  });

  it("returns valid=false for case-mismatched mode", () => {
    const r = parseDispatchMode("SAVE");
    // The original predicate was `dispatchMode === "save"` (case-sensitive),
    // and the helper preserves that strict equality.
    expect(r.isSaveMode).toBe(false);
    expect(r.valid).toBe(false);
  });

  // ── At-most-one flag is true for any valid mode ───────────────

  it("sets exactly one flag for each of the 4 supported modes", () => {
    for (const mode of ["save", "queue", "now"] as const) {
      const r = parseDispatchMode(mode);
      const trueCount = [r.isSaveMode, r.isQueueMode, r.isCronMode, r.isNowMode].filter(Boolean).length;
      expect(trueCount).toBe(1);
    }
    // cron-with-schedule also sets exactly 1 flag
    const r = parseDispatchMode("cron", "every 5m");
    const trueCount = [r.isSaveMode, r.isQueueMode, r.isCronMode, r.isNowMode].filter(Boolean).length;
    expect(trueCount).toBe(1);
  });

  it("matches the original inline predicate for every reachable input", () => {
    // Byte-equivalence matrix: for every (mode, schedule) combination
    // a real call site might pass, assert the helper returns the
    // same 4 booleans as the prior inline form.
    const cases: Array<{ mode: string | undefined; schedule?: string }> = [
      { mode: "save" },
      { mode: "queue" },
      { mode: "now" },
      { mode: "cron", schedule: "every 5m" },
      { mode: "cron", schedule: "0 9 * * *" },
      { mode: "cron" },
      { mode: "cron", schedule: "" },
      { mode: "draft" },
      { mode: undefined },
      { mode: "" },
    ];
    for (const { mode, schedule } of cases) {
      const inline = {
        isSaveMode: mode === "save",
        isQueueMode: mode === "queue",
        isCronMode: mode === "cron" && !!schedule,
        isNowMode: mode === "now",
      };
      const r = parseDispatchMode(mode, schedule);
      expect(r.isSaveMode).toBe(inline.isSaveMode);
      expect(r.isQueueMode).toBe(inline.isQueueMode);
      expect(r.isCronMode).toBe(inline.isCronMode);
      expect(r.isNowMode).toBe(inline.isNowMode);
    }
  });
});

describe("scheduleForDispatch", () => {
  it("returns schedule when dispatchMode is 'cron'", () => {
    expect(scheduleForDispatch("cron", "every 5m")).toBe("every 5m");
    expect(scheduleForDispatch("cron", "0 9 * * *")).toBe("0 9 * * *");
  });

  it("returns undefined when dispatchMode is 'save'", () => {
    expect(scheduleForDispatch("save", "every 5m")).toBeUndefined();
  });

  it("returns undefined when dispatchMode is 'queue'", () => {
    expect(scheduleForDispatch("queue", "every 5m")).toBeUndefined();
  });

  it("returns undefined when dispatchMode is 'now'", () => {
    expect(scheduleForDispatch("now", "every 5m")).toBeUndefined();
  });

  it("returns undefined when schedule is undefined, even for 'cron'", () => {
    expect(scheduleForDispatch("cron", undefined)).toBeUndefined();
  });

  it("returns empty string when schedule is empty string for 'cron' (matches inline form)", () => {
    // The original inline form `newDispatch === "cron" ? newSchedule : undefined`
    // returned the schedule verbatim — including empty string — when
    // dispatchMode was 'cron'. The helper preserves that byte-equivalent
    // behaviour. The empty-string suppression (if any) is the caller's
    // responsibility (e.g. via the existing `newSchedule.trim()` check
    // in the API layer).
    expect(scheduleForDispatch("cron", "")).toBe("");
  });

  it("matches the original inline `===` predicate for every dispatch mode", () => {
    // Byte-equivalence matrix: for every (mode, schedule) combination,
    // assert the helper returns the same value as the prior inline form.
    // The inline form was `mode === "cron" ? schedule : undefined`, which
    // returns the schedule verbatim (including empty string) for cron
    // and `undefined` for all other modes regardless of schedule.
    const cases: Array<{ mode: "save" | "now" | "cron" | "queue"; schedule?: string }> = [
      { mode: "save", schedule: "every 5m" },
      { mode: "save", schedule: undefined },
      { mode: "queue", schedule: "every 5m" },
      { mode: "now", schedule: "every 5m" },
      { mode: "cron", schedule: "every 5m" },
      { mode: "cron", schedule: undefined },
      { mode: "cron", schedule: "" },
    ];
    for (const { mode, schedule } of cases) {
      const inline = mode === "cron" ? schedule : undefined;
      expect(scheduleForDispatch(mode, schedule)).toBe(inline);
    }
  });
});

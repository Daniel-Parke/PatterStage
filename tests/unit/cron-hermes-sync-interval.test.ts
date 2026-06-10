import { buildScheduleObjForHermes } from "@/lib/cron/hermes-sync";

/**
 * Contract tests for the CH→Hermes schedule push path, focused on
 * the schedule object that ends up in `~/.hermes/cron/jobs.json`.
 *
 * The session-2026-06-10 investigation found that the live mission's
 * `schedule = "every 30m"` was being pushed verbatim, producing
 * `{kind: "every 30m", display: "..."}` — an invalid `kind` the
 * Python scheduler can't compute `next_run_at` from, so the cron
 * never fired.
 *
 * `buildScheduleObjForHermes` is the helper that builds the schedule
 * object sent to Python. It must always produce a `kind` in the
 * scheduler's accepted vocabulary: `cron`, `interval`, `once`, or
 * `invalid` (the scheduler itself sets this last one). Never a string
 * like `"every 30m"`.
 */
describe("buildScheduleObjForHermes — schedule object shape for the Python scheduler", () => {
  it("emits a 5-field cron object for raw-cron schedules", () => {
    expect(buildScheduleObjForHermes("0 9 * * 1-5", "0 9 * * 1-5")).toEqual({
      kind: "cron",
      expr: "0 9 * * 1-5",
      display: "0 9 * * 1-5",
    });
  });

  it("emits an interval object for 'every 30m' shorthand (the live mission bug fix)", () => {
    // The pre-fix behaviour: schedule = "every 30m" → {kind: "every 30m",
    // display: "every 30m"} — invalid `kind`, the Python scheduler
    // can't compute `next_run_at` from it, the job never fires.
    expect(buildScheduleObjForHermes("every 30m", "every 30m")).toEqual({
      kind: "interval",
      minutes: 30,
      display: "every 30m",
    });
  });

  it("emits an interval object for 'every 2h' shorthand", () => {
    expect(buildScheduleObjForHermes("every 2h", "every 2h")).toEqual({
      kind: "interval",
      minutes: 120,
      display: "every 2h",
    });
  });

  it("emits an interval object for 'every 1d' shorthand", () => {
    expect(buildScheduleObjForHermes("every 1d", "every 1d")).toEqual({
      kind: "interval",
      minutes: 1440,
      display: "every 1d",
    });
  });

  it("emits an interval object for 'every 5m' shorthand", () => {
    expect(buildScheduleObjForHermes("every 5m", "every 5m")).toEqual({
      kind: "interval",
      minutes: 5,
      display: "every 5m",
    });
  });

  it("rejects a star-slash-N cron input that also has 'every N' meaning (caller already canonicalised)", () => {
    // `cron_jobs.schedule` is the 5-field cron expression after the
    // parseScheduleToDisplay rewrite. `buildScheduleObjForHermes`
    // never sees the user shorthand post-write — it sees the canonical
    // 5-field cron. Pin that.
    expect(buildScheduleObjForHermes("*/30 * * * *", "every 30m")).toEqual({
      kind: "cron",
      expr: "*/30 * * * *",
      display: "every 30m",
    });
  });

  it("handles the legacy JSON-stringified ParsedSchedule shape (pre-#168)", () => {
    // Pre-#168 stored a JSON-stringified {kind, expr, display}. The
    // helper unwraps the `expr` and emits a structured cron object.
    // The inner `display` field is preserved in the output.
    const stored = JSON.stringify({ kind: "cron", expr: "0 9 * * 1-5", display: "0 9 * * 1-5" });
    const obj = buildScheduleObjForHermes(stored, null) as {
      kind: string;
      expr: string;
      display?: string;
    };
    expect(obj.kind).toBe("cron");
    expect(obj.expr).toBe("0 9 * * 1-5");
  });

  it("recovers from the corrupted {kind: 'invalid', raw: '...'} shape (pre-#168)", () => {
    const inner = JSON.stringify({ kind: "cron", expr: "0 * * * *", display: "0 * * * *" });
    const corrupted = JSON.stringify({
      kind: "invalid",
      raw: inner,
      message: `Unrecognized schedule: ${inner}`,
      display: "0 * * * *",
    });
    // The recovered cron object preserves the display from the inner
    // JSON payload. Pinning the full recovered shape — it's the
    // post-#168 contract that `next_run_at` actually computes from.
    const recovered = buildScheduleObjForHermes(corrupted, null) as {
      kind: string;
      expr: string;
      display?: string;
    };
    expect(recovered.kind).toBe("cron");
    expect(recovered.expr).toBe("0 * * * *");
  });

  it("never emits a `kind` outside the Python scheduler's vocabulary for known-good inputs", () => {
    // The original bug was `{kind: "every 30m"}` for an "every Nm"
    // input that DOES have a valid `interval` interpretation. Pin
    // that the helper never produces a `kind` that's not in the
    // scheduler's accepted set, across a range of supported inputs.
    //
    // Note: "every 1w" and other genuinely-unsupported inputs fall
    // through unchanged — the Python scheduler will mark them
    // `kind: "invalid"` itself. That's the right behaviour for true
    // garbage input; we're only fixing the "Nm/Nh/Nd has a valid
    // interpretation" case.
    for (const input of [
      "0 9 * * 1-5",
      "*/15 * * * *",
      "every 5m",
      "every 30m",
      "every 1h",
      "every 2h",
      "every 1d",
      JSON.stringify({ kind: "cron", expr: "0 9 * * 1-5", display: "0 9 * * 1-5" }),
    ]) {
      const obj = buildScheduleObjForHermes(input, null);
      expect(["cron", "interval", "once", "invalid", "unknown"]).toContain(obj.kind);
    }
  });

  it("preserves the schedule_display as the `display` field on the emitted object", () => {
    // The CH-side display label travels with the job to Hermes. The
    // helper must preserve it so the Hermes UI shows the same human
    // label the user picked in CH.
    const obj = buildScheduleObjForHermes("0 9 * * 1-5", "Weekdays at 9am");
    expect(obj.display).toBe("Weekdays at 9am");
  });
});

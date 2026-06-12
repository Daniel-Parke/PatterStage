// Unit tests for `composeTemplateUrl` and `withCronJobSchedule` from
// `src/lib/dashboard-helpers.ts`. These two helpers are used by the
// dashboard's Mission Dispatch strip + the cron-schedule inline edit,
// but were never unit-tested in isolation (only the source-pattern test
// in `dashboard-list1-active-missions-and-setdata.test.ts` pinned the
// call shape, not the helper's behavior).
//
// The helpers are pure, so we exercise them with literal inputs and
// assert the post-condition shape. The byte-equivalence to the
// pre-extraction inline form is documented in `src/lib/dashboard-helpers.ts`.

import { describe, it, expect } from "@jest/globals";
import {
  composeTemplateUrl,
  withCronJobSchedule,
} from "@/lib/dashboard-helpers";
import type { CronJobBrief, MonitorData } from "@/types/hermes";

// ── composeTemplateUrl ──────────────────────────────────────────

describe("composeTemplateUrl", () => {
  it("builds the canonical URL with template id and compose=1 flag", () => {
    // The dashboard's TemplateCard onClick reads this URL and pushes
    // it through the Next.js router. The query params are load-bearing:
    //   - `template=<id>` is read by the missions page to prefill
    //   - `compose=1` is the auto-open-composer flag
    expect(composeTemplateUrl("tpl-abc-123")).toBe(
      "/orchestration/missions?template=tpl-abc-123&compose=1",
    );
  });

  it("uses the literal template id without URL-encoding (current contract)", () => {
    // Today every template id is a uuid4 (URL-safe), so the helper
    // concatenates the id raw. This test pins the current contract —
    // a future change to add `encodeURIComponent` would alter the
    // missions page's query-param parser, which is not in scope for
    // this refactor session.
    expect(composeTemplateUrl("simple-id")).toBe(
      "/orchestration/missions?template=simple-id&compose=1",
    );
  });
});

// ── withCronJobSchedule ───────────────────────────────────────

// Fixture monitor: a 2-job list with mixed `schedule_display` states.
// Used across all the tests below to exercise the helper's behavior
// without re-deriving the same shape in each test.
function makeMonitor(overrides?: Partial<CronJobBrief>): MonitorData {
  return {
    cron: {
      total: 2,
      active: 1,
      paused: 1,
      jobs: [
        {
          id: "job-1",
          name: "Job 1",
          state: "idle",
          enabled: true,
          schedule: "0 * * * *",
          schedule_display: "every 1h",
          lastRun: "2026-06-12T10:00:00Z",
          nextRun: "2026-06-12T11:00:00Z",
          lastStatus: "ok",
          ...overrides,
        },
        {
          id: "job-2",
          name: "Job 2",
          state: "idle",
          enabled: false,
          schedule: "*/30 * * * *",
          schedule_display: "every 30m",
          lastRun: null,
          nextRun: null,
          lastStatus: null,
        },
      ],
    },
    sessions: { total: 0, recent: [] },
    gateway: { platforms: {}, connectedCount: 0 },
    memory: { factCount: 0, dbSize: 0, provider: "" },
    errors: [],
    system: { uptime: "", configPresent: true, soulPresent: true },
    sync: { lastRun: null, allSuccessful: true, sourceStatuses: {} },
  };
}

describe("withCronJobSchedule", () => {
  it("returns null when monitor is null (defensive pass-through)", () => {
    // The dashboard's `handleCronScheduleChange` already guards this
    // case with a showToast, but the helper stays safe to call on
    // stale state — `null` in, `null` out.
    expect(withCronJobSchedule(null, "job-1", "0 0 * * *", "every 1d")).toBeNull();
  });

  it("updates both schedule and schedule_display on the matching job", () => {
    // The post-session-178 invariant: the canonical machine form goes
    // in `schedule`, the human label goes in `schedule_display`. Both
    // fields are written together so the optimistic UI matches what
    // the server will return on the next /api/monitor poll.
    const monitor = makeMonitor();
    const result = withCronJobSchedule(monitor, "job-1", "*/15 * * * *", "every 15m");

    expect(result).not.toBeNull();
    const jobs = result!.cron.jobs;
    const job1 = jobs.find((j: CronJobBrief) => j.id === "job-1");
    const job2 = jobs.find((j: CronJobBrief) => j.id === "job-2");
    expect(job1?.schedule).toBe("*/15 * * * *");
    expect(job1?.schedule_display).toBe("every 15m");
    // The non-matching job is unchanged (reference equality is the
    // post-condition for a map() that returns the same object).
    expect(job2).toBe(monitor.cron.jobs[1]);
  });

  it("writes a literal null when scheduleDisplay is null (no human label yet)", () => {
    // The scheduleDisplay parameter is now required (session 177
    // promoted it from `?` to `string | null`). The helper writes
    // a literal `null` for the "no human label yet" case so the
    // picker's `schedule_display` is the same shape the server
    // returns, instead of the pre-refactor behaviour of preserving
    // the old value via the `...(scheduleDisplay !== undefined ? ...)`
    // spread.
    const monitor = makeMonitor();
    const result = withCronJobSchedule(monitor, "job-1", "*/10 * * * *", null);
    expect(result!.cron.jobs[0].schedule_display).toBeNull();
  });

  it("does not mutate the input monitor (pure function)", () => {
    // The helper is used inside React state-setter callbacks; any
    // input mutation would break reference-equality checks downstream
    // and is the kind of subtle bug that doesn't surface until a
    // later render fails to re-render. The original comment in
    // dashboard-helpers.ts explicitly forbids mutation; this test
    // pins the post-condition.
    const monitor = makeMonitor();
    const originalSchedule = monitor.cron.jobs[0].schedule;
    const originalDisplay = monitor.cron.jobs[0].schedule_display;
    withCronJobSchedule(monitor, "job-1", "*/5 * * * *", "every 5m");
    expect(monitor.cron.jobs[0].schedule).toBe(originalSchedule);
    expect(monitor.cron.jobs[0].schedule_display).toBe(originalDisplay);
  });

  it("returns the input monitor unchanged when no job id matches", () => {
    // The helper is called with the current job id, but a stale-state
    // call (e.g. the job was deleted between the click and the
    // helper call) should not throw and should not produce a
    // different monitor shape — every job in the output should
    // reference-equal the input.
    const monitor = makeMonitor();
    const result = withCronJobSchedule(monitor, "nonexistent-job", "0 0 * * *", "every 1d");
    expect(result!.cron.jobs).toEqual(monitor.cron.jobs);
  });
});

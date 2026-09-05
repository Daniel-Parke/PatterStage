/** @jest-environment node */
//
// The scheduler heartbeat, read back out of `meta`. Until this existed the
// only evidence that the loop firing schedules and reconciling runs was alive
// was a console.log on a server terminal.

jest.mock("@/lib/system-repository", () => ({ getMetaPair: jest.fn() }));

import {
  HEARTBEAT_STALE_MS,
  META_HEARTBEAT,
  META_OWNER_PID,
  readSchedulerHealth,
} from "@/lib/orchestration/scheduler/health";
import { getMetaPair } from "@/lib/system-repository";
import { describeSchedulerHealth } from "@/lib/dashboard/scheduler-pill";

const mockGetMetaPair = getMetaPair as jest.Mock;
const NOW = Date.parse("2026-08-23T12:00:00.000Z");
const beatAt = (msAgo: number) => new Date(NOW - msAgo).toISOString();

beforeEach(() => jest.clearAllMocks());

describe("readSchedulerHealth", () => {
  it("reports a fresh lease as alive", () => {
    mockGetMetaPair.mockReturnValue([
      { key: META_OWNER_PID, value: "18812" },
      { key: META_HEARTBEAT, value: beatAt(4_000) },
    ]);
    expect(readSchedulerHealth(NOW)).toEqual({
      ownerPid: 18812,
      lastTickAt: beatAt(4_000),
      stale: false,
      staleAfterMs: HEARTBEAT_STALE_MS,
      // Stamped from process.pid so the pill can tell "the lease is live" from
      // "the lease is live and I am the one holding it" (T-0064).
      selfPid: process.pid,
    });
  });

  it("reports a heartbeat older than the lease window as stale", () => {
    mockGetMetaPair.mockReturnValue([
      { key: META_OWNER_PID, value: "18812" },
      { key: META_HEARTBEAT, value: beatAt(HEARTBEAT_STALE_MS + 1_000) },
    ]);
    expect(readSchedulerHealth(NOW).stale).toBe(true);
  });

  it("treats a never-started scheduler as stale, which is the same news", () => {
    mockGetMetaPair.mockReturnValue([]);
    expect(readSchedulerHealth(NOW)).toMatchObject({
      ownerPid: null,
      lastTickAt: null,
      stale: true,
    });
  });

  it("degrades to 'cannot tell' instead of taking down the caller", () => {
    mockGetMetaPair.mockImplementation(() => {
      throw new Error("database is locked");
    });
    expect(() => readSchedulerHealth(NOW)).not.toThrow();
    expect(readSchedulerHealth(NOW).stale).toBe(true);
  });

  it("rejects a non-numeric pid rather than reporting NaN", () => {
    mockGetMetaPair.mockReturnValue([
      { key: META_OWNER_PID, value: "not-a-pid" },
      { key: META_HEARTBEAT, value: beatAt(1_000) },
    ]);
    expect(readSchedulerHealth(NOW).ownerPid).toBeNull();
  });
});

describe("describeSchedulerHealth", () => {
  it("names the three states an operator has to tell apart", () => {
    expect(
      describeSchedulerHealth(
        { ownerPid: 18812, lastTickAt: beatAt(4_000), stale: false, staleAfterMs: 60_000, selfPid: 18812 },
        NOW,
      ),
    ).toEqual({ value: "Ticking", subtitle: "last tick 4s ago · pid 18812", color: "green" });

    expect(
      describeSchedulerHealth(
        { ownerPid: 18812, lastTickAt: beatAt(600_000), stale: true, staleAfterMs: 60_000, selfPid: 18812 },
        NOW,
      ),
    ).toMatchObject({ value: "Stalled", color: "pink", subtitle: "last tick 10m ago · pid 18812" });

    expect(
      describeSchedulerHealth(
        { ownerPid: null, lastTickAt: null, stale: true, staleAfterMs: 60_000, selfPid: null },
        NOW,
      ),
    ).toMatchObject({ value: "Never started", color: "pink" });
  });

  it("survives an absent monitor payload and an unreadable timestamp", () => {
    expect(describeSchedulerHealth(undefined, NOW).value).toBe("Never started");
    expect(
      describeSchedulerHealth(
        { ownerPid: 7, lastTickAt: "nonsense", stale: false, staleAfterMs: 60_000, selfPid: 7 },
        NOW,
      ),
    ).toMatchObject({ value: "Unknown", subtitle: "unreadable heartbeat · pid 7" });
  });

  it("reports hours for a long-dead scheduler", () => {
    expect(
      describeSchedulerHealth(
        { ownerPid: 1, lastTickAt: beatAt(3 * 3_600_000), stale: true, staleAfterMs: 60_000, selfPid: 1 },
        NOW,
      ).subtitle,
    ).toBe("last tick 3h ago · pid 1");
  });
});


// ── A follower looks exactly like the owner (T-0064) ────────────
//
// Run a second PatterStage process and it stands down: BackgroundScheduler logs
// "live owner (pid=N) holds the scheduling lease -- standing down as follower"
// and its isOwner() gate stops it dispatching. Nothing surfaces that. The
// Dashboard pill reads the lease from `meta`, which correctly reports the REAL
// owner's liveness, so a follower on a healthy host renders "Ticking, green",
// character for character what the owner renders, while never firing a schedule.
//
// The operator's symptom is that schedules "work" and their dispatches happen in
// a process whose logs they are not reading. The QA pass hit exactly this: a
// stray server on :42069 held the lease for the whole session.
describe("a process that will never fire a schedule says so", () => {
  const OWNER_PID = 4821;
  const base = {
    ownerPid: OWNER_PID,
    lastTickAt: new Date(Date.now() - 12_000).toISOString(),
    stale: false,
    staleAfterMs: 60_000,
    selfPid: process.pid,
  };

  it("reads as Follower when the lease is held by another process", () => {
    const view = describeSchedulerHealth({ ...base, selfPid: 9999 }, Date.now());
    expect(view.value).toBe("Follower");
    expect(view.subtitle).toContain(String(OWNER_PID));
  });

  it("names both pids, so the operator can find the process that IS dispatching", () => {
    const view = describeSchedulerHealth({ ...base, selfPid: 9999 }, Date.now());
    expect(view.subtitle).toContain("9999");
  });

  it("is not styled as a fault, because it is not one", () => {
    // Schedules ARE firing, elsewhere. Orange beside a green Ticking is what
    // makes an alternation between two healthy processes read as a problem.
    const view = describeSchedulerHealth({ ...base, selfPid: 9999 }, Date.now());
    expect(view.color).not.toBe("pink");
    expect(view.color).not.toBe("orange");
  });

  it("still reads as Ticking when this process holds the lease", () => {
    const view = describeSchedulerHealth({ ...base, selfPid: OWNER_PID }, Date.now());
    expect(view.value).toBe("Ticking");
  });

  it("a stale lease held by another process is still Stalled, not Follower", () => {
    // Ordering fence. A stale lease means nothing is firing at all, whoever
    // holds it, and that is the more urgent fact.
    const view = describeSchedulerHealth({ ...base, stale: true, selfPid: 9999 }, Date.now());
    expect(view.value).toBe("Stalled");
  });

  it("falls through to Ticking when the reading process is unknown", () => {
    // Back-compat fence for any caller that cannot supply selfPid.
    const view = describeSchedulerHealth({ ...base, selfPid: null }, Date.now());
    expect(view.value).toBe("Ticking");
  });
});

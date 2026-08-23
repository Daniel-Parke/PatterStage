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
        { ownerPid: 18812, lastTickAt: beatAt(4_000), stale: false, staleAfterMs: 60_000 },
        NOW,
      ),
    ).toEqual({ value: "Ticking", subtitle: "last tick 4s ago · pid 18812", color: "green" });

    expect(
      describeSchedulerHealth(
        { ownerPid: 18812, lastTickAt: beatAt(600_000), stale: true, staleAfterMs: 60_000 },
        NOW,
      ),
    ).toMatchObject({ value: "Stalled", color: "pink", subtitle: "last tick 10m ago · pid 18812" });

    expect(
      describeSchedulerHealth(
        { ownerPid: null, lastTickAt: null, stale: true, staleAfterMs: 60_000 },
        NOW,
      ),
    ).toMatchObject({ value: "Never started", color: "pink" });
  });

  it("survives an absent monitor payload and an unreadable timestamp", () => {
    expect(describeSchedulerHealth(undefined, NOW).value).toBe("Never started");
    expect(
      describeSchedulerHealth(
        { ownerPid: 7, lastTickAt: "nonsense", stale: false, staleAfterMs: 60_000 },
        NOW,
      ),
    ).toMatchObject({ value: "Unknown", subtitle: "unreadable heartbeat · pid 7" });
  });

  it("reports hours for a long-dead scheduler", () => {
    expect(
      describeSchedulerHealth(
        { ownerPid: 1, lastTickAt: beatAt(3 * 3_600_000), stale: true, staleAfterMs: 60_000 },
        NOW,
      ).subtitle,
    ).toBe("last tick 3h ago · pid 1");
  });
});

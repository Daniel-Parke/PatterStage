/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// The schedules section, read as an operator reads it.
//
// Driving the product against a real agent turned up three things about this
// section, two of them here:
//
//   1. A row never says which mission it runs. The headline is the schedule's
//      own nickname, so two schedules over two different missions read the
//      same and the only way to tell them apart is to delete one.
//   2. A SCRIPT schedule sits in the same list under a heading that says
//      "Scheduled missions", with nothing on the row to say it is a script.
//      The list has carried both kinds since the script kind landed.
//
// The contract: every row says what kind of thing it fires and names it, and
// the heading covers both kinds rather than only one of them.
// ═══════════════════════════════════════════════════════════════

import { screen } from "@testing-library/react";

import { renderWithQuery } from "../helpers/render-with-query";

interface CallResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const answers = new Map<string, CallResult>();

const safeApiCall = jest.fn(async (path: string, options?: { method?: string }) => {
  const method = options?.method ?? "GET";
  return answers.get(`${method} ${path}`) ?? { ok: true, data: {} };
});

jest.mock("@/lib/api/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api/api-fetch") as Record<string, unknown>),
  safeApiCall: (...a: unknown[]) => (safeApiCall as unknown as (...a: unknown[]) => unknown)(...a),
}));

// U9 (T-0123), decision 9: ScheduledMissions became AutomationList, one
// view of everything on a clock rather than a section at the foot of
// Missions that could not see the host crontab. Same rows, same actions;
// these assertions are unchanged.
import ScheduledMissions from "@/components/automation/AutomationList";

const BASE = {
  name: "Nightly",
  schedule: "every 30m",
  scheduleDisplay: "every 30 minutes",
  enabled: true,
  catchUpPolicy: "fire_once",
  repeatTimes: null,
  repeatDone: 0,
  profileName: null,
  nextRunAt: "2099-01-01T00:00:00.000Z",
  lastRunAt: null,
  lastRunId: null,
  lastStatus: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const MISSION_ROW = {
  ...BASE,
  id: "sch-1",
  kind: "mission",
  missionId: "m-1",
  missionName: "Sweep the inbox",
  scriptName: null,
};

const SCRIPT_ROW = {
  ...BASE,
  id: "sch-2",
  kind: "script",
  name: "Ps Db Backup",
  missionId: null,
  missionName: null,
  scriptName: "ps-db-backup.mjs",
  schedule: "0 3 * * *",
  scheduleDisplay: "at 03:00",
};

beforeEach(() => {
  answers.clear();
  safeApiCall.mockClear();
  answers.set("GET /api/schedules", {
    ok: true,
    data: { data: { schedules: [MISSION_ROW, SCRIPT_ROW] } },
  });
  answers.set("GET /api/missions?limit=500", { ok: true, data: { data: { missions: [] } } });
});

async function mount() {
  const view = renderWithQuery(<ScheduledMissions />);
  await screen.findByText("Nightly");
  return view;
}

describe("a row says which mission it runs", () => {
  it("names the mission, not only the schedule's nickname", async () => {
    await mount();

    expect(screen.getByText("Sweep the inbox")).toBeInTheDocument();
  });
});

describe("a script row says it is a script", () => {
  it("labels the kind on both rows", async () => {
    await mount();

    expect(screen.getByText("Mission")).toBeInTheDocument();
    expect(screen.getByText("Script")).toBeInTheDocument();
  });

  it("names the script it runs", async () => {
    await mount();

    expect(screen.getByText("ps-db-backup.mjs")).toBeInTheDocument();
  });
});

describe("the heading covers what the list actually holds", () => {
  it("does not call a list of missions and scripts 'scheduled missions'", async () => {
    await mount();

    expect(screen.queryByRole("heading", { name: /scheduled missions/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /schedules/i })).toBeInTheDocument();
  });
});

describe("a row whose mission is gone says so", () => {
  it("does not leave the operator guessing what it fires", async () => {
    answers.set("GET /api/schedules", {
      ok: true,
      data: {
        data: {
          schedules: [{ ...MISSION_ROW, missionName: null, missionId: "m-gone" }],
        },
      },
    });

    await mount();

    expect(screen.getByText("Mission not found")).toBeInTheDocument();
  });
});

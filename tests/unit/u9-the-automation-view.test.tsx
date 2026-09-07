/** @jest-environment jsdom */
/**
 * U9 (T-0123), part two: decision 9, one Automation view.
 *
 * Two surfaces answer "what is on a clock" and neither answers it fully.
 *
 *   `ScheduledMissions`, a section at the bottom of the Missions page, lists
 *   PatterStage's own schedule table. That table holds both kinds already - a
 *   recurring mission, and a script on a machine with no scheduler of its own -
 *   so it looks complete, and is not.
 *
 *   The Scripts page lists host scripts, each with its schedule inline. A
 *   script scheduled into the HOST crontab lives only there: PatterStage's
 *   table knows nothing about it, so it appears on Scripts and is missing from
 *   the schedules section entirely. An operator asking "what runs tonight" has
 *   to read two screens and know which kind lives where.
 *
 * The Automation view is the union, and the union has to be a real one: a
 * script scheduled through PatterStage appears in BOTH reads, and listing it
 * twice would be a worse answer than listing it once in the wrong place. The
 * host read is therefore filtered to the rows PatterStage does not own.
 *
 * Each row says what decision 9 asks for and the old section did not: what it
 * fires, its clock, when it runs next, when it last ran and how that ended, and
 * a way to the log. `lastStatus` alone was on the row before; a status with no
 * time and no log is a claim you cannot check.
 *
 * Missions keeps dispatch and loses its schedules section. Scripts keeps its
 * file list, and its per-row schedule action, which is a property of a file
 * rather than a section about clocks.
 */
import { render, screen, within } from "@testing-library/react";

import { railOrder, documentedRoutes } from "@/lib/modules/registry";

// ── the two reads ─────────────────────────────────────────────

const schedules = {
  schedules: [] as unknown[],
  isLoading: false,
  error: null as string | null,
  refetch: jest.fn(),
  create: { mutate: jest.fn(), isPending: false },
  remove: { mutate: jest.fn() },
  toggle: { mutate: jest.fn() },
  runNow: { mutate: jest.fn() },
};
const scripts = { scripts: [] as unknown[], isLoading: false, error: null as string | null };

jest.mock("@/hooks/useSchedules", () => ({
  useSchedules: () => schedules,
  useMissionOptions: () => [],
}));
jest.mock("@/hooks/useScripts", () => ({
  useScripts: () => scripts,
}));

import AutomationList from "@/components/automation/AutomationList";

const schedule = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  kind: "mission",
  missionId: "m1",
  missionName: "Nightly triage",
  scriptName: null,
  name: "Nightly",
  schedule: "0 2 * * *",
  scheduleDisplay: "every day at 02:00",
  enabled: true,
  catchUpPolicy: "fire_once",
  repeatTimes: null,
  repeatDone: 3,
  profileName: null,
  nextRunAt: "2026-09-10T02:00:00.000Z",
  lastRunAt: "2026-09-09T02:00:00.000Z",
  lastRunId: "run-9",
  lastStatus: "successful",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-09T02:00:00.000Z",
  ...over,
});

const script = (over: Record<string, unknown> = {}) => ({
  name: "ps-backup.sh",
  path: "/data/scripts/ps-backup.sh",
  size: 120,
  modified: "2026-09-01T00:00:00.000Z",
  schedule: "0 4 * * *",
  scheduleSource: "host",
  scheduleId: null,
  hasLog: true,
  lastRun: "2026-09-09T04:00:00.000Z",
  lastOutcome: "ok",
  ...over,
});

beforeEach(() => {
  schedules.schedules = [];
  scripts.scripts = [];
});

describe("the rail and the route matrix know Automation", () => {
  it("puts it in Work", () => {
    expect(railOrder()).toContain("/work/automation");
  });

  it("documents it, so the e2e matrix and docs:check both walk it", () => {
    expect(documentedRoutes()).toContain("/work/automation");
  });
});

describe("everything on a clock, once", () => {
  it("lists a mission schedule and a host-crontab script together", () => {
    schedules.schedules = [schedule()];
    scripts.scripts = [script()];
    render(<AutomationList />);
    expect(screen.getByText(/Nightly triage/)).toBeInTheDocument();
    expect(screen.getByText(/ps-backup\.sh/)).toBeInTheDocument();
  });

  /**
   * The union has to be a real one. A script scheduled THROUGH PatterStage is
   * in both reads; listing it twice would be a worse answer than the two
   * screens it replaces.
   */
  it("does not list a PatterStage-scheduled script twice", () => {
    schedules.schedules = [
      schedule({ id: "s2", kind: "script", missionId: null, missionName: null, scriptName: "ps-backup.sh", name: "Backup" }),
    ];
    scripts.scripts = [script({ scheduleSource: "patterstage", scheduleId: "s2" })];
    render(<AutomationList />);
    expect(screen.getAllByText(/ps-backup\.sh/)).toHaveLength(1);
  });

  it("leaves an unscheduled script out of a list about clocks", () => {
    scripts.scripts = [script({ name: "ad-hoc.sh", schedule: null, scheduleSource: null })];
    render(<AutomationList />);
    expect(screen.queryByText(/ad-hoc\.sh/)).not.toBeInTheDocument();
  });

  it("says nothing is scheduled rather than showing an empty table", () => {
    render(<AutomationList />);
    expect(screen.getByText(/nothing is on a clock/i)).toBeInTheDocument();
  });
});

describe("a row says when, when it last did, and how it went", () => {
  it("carries next run, last run and the outcome", () => {
    schedules.schedules = [schedule()];
    render(<AutomationList />);
    const row = screen.getByTestId("automation-row-s1");
    expect(within(row).getByTestId("next-run")).toHaveTextContent(/\S/);
    expect(within(row).getByTestId("last-run")).toHaveTextContent(/\S/);
    expect(within(row).getByTestId("last-run")).toHaveTextContent(/successful/i);
  });

  it("offers the log when there is a run to look at", () => {
    schedules.schedules = [schedule()];
    render(<AutomationList />);
    const row = screen.getByTestId("automation-row-s1");
    expect(within(row).getByRole("link", { name: /log/i })).toHaveAttribute(
      "href",
      expect.stringContaining("run-9"),
    );
  });

  /** A status with no run behind it is a claim you cannot check. */
  it("offers no log for a schedule that has never fired", () => {
    schedules.schedules = [schedule({ lastRunAt: null, lastRunId: null, lastStatus: null })];
    render(<AutomationList />);
    const row = screen.getByTestId("automation-row-s1");
    expect(within(row).queryByRole("link", { name: /log/i })).not.toBeInTheDocument();
    expect(within(row).getByTestId("last-run")).toHaveTextContent(/never/i);
  });

  it("says which scheduler owns a host row, because unscheduling differs", () => {
    scripts.scripts = [script()];
    render(<AutomationList />);
    const row = screen.getByTestId("automation-row-host:ps-backup.sh");
    expect(row).toHaveTextContent(/host/i);
  });
});

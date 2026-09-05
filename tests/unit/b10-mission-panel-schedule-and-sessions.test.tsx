/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D68 and D69, the panel half).
//
// Written before the product code moved. Holds contract section 2.
//
// The defect (D68): the panel carries a fully written "Cron Job" card — state,
// last run, a "view" link — behind `detail.cronJob`, a field no route has ever
// sent. So a scheduled mission's panel says "Schedule: One-shot" from the
// mission's own stored string and stops there.
//
// The defect (D69): sessions link INTO missions (mission-deep-link.ts exists
// precisely for that), and the reverse does not exist. `mission.sessionId` is
// read out of the database, carried on the Mission type and rendered nowhere,
// so "dispatch a mission, then read what it did" is a dead end on the board.
//
// The contract: the card is headed "Schedule", reads the real schedule, says
// when the next run is and how the last one went, carries a line saying why it
// is not going to fire when it is not, and links to the section that edits it.
// The grid row beside it is relabelled "Cadence" so the panel does not have two
// things called Schedule. And the action row gains "View sessions", pointing at
// /results/sessions?missionId=<mission id> — the mirror of the deep link.
//
// The last describe is the GREEN CONTROL: D66 was fixed in B2 and the cancel
// button is a ConfirmButton that is never disabled by being armed. B10 rewrites
// this file heavily; the control is here so it cannot be undone in passing.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentProps, ComponentType } from "react";
import { fireEvent, screen } from "@testing-library/react";

import { renderWithQuery } from "../helpers/render-with-query";
import MissionEditorPanel from "@/components/missions/MissionEditorPanel";
import type { MissionRow } from "@/hooks/missions-page-types";

// ── pre-B10 type shim ──────────────────────────────────────────
//
// `MissionDetail.cronJob` becomes `MissionDetail.schedule` (contract 1.5), so
// the detail this file builds does not fit the type that ships today. The shim
// lets the oracle typecheck now and describe the shape the contract asks for.

interface ScheduleView {
  id: string;
  missionId: string | null;
  name: string;
  schedule: string;
  scheduleDisplay: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  repeatTimes: number | null;
  repeatDone: number;
}

interface B10Detail {
  mission: MissionRow;
  run?: null;
  schedule: ScheduleView | null;
}

type PanelProps = Omit<ComponentProps<typeof MissionEditorPanel>, "detail"> & {
  detail: B10Detail | null;
};
const Panel = MissionEditorPanel as unknown as ComponentType<PanelProps>;

// ── fixtures ───────────────────────────────────────────────────

const HOUR = 3_600_000;

function mission(over: Partial<MissionRow> = {}): MissionRow {
  return {
    id: "m-1",
    name: "Nightly digest",
    prompt: "Triage the queue",
    status: "successful",
    sessionId: "sess-abc",
    createdAt: new Date(Date.now() - 4 * HOUR).toISOString(),
    updatedAt: new Date(Date.now() - HOUR).toISOString(),
    ...over,
  } as MissionRow;
}

function schedule(over: Partial<ScheduleView> = {}): ScheduleView {
  return {
    id: "sch-1",
    missionId: "m-1",
    name: "Nightly digest",
    schedule: "every 30m",
    scheduleDisplay: "every 30 minutes",
    enabled: true,
    nextRunAt: new Date(Date.now() + HOUR).toISOString(),
    lastRunAt: new Date(Date.now() - HOUR).toISOString(),
    lastStatus: "dispatched",
    repeatTimes: null,
    repeatDone: 2,
    ...over,
  };
}

function renderPanel(detail: B10Detail, onCancel = jest.fn()) {
  return {
    onCancel,
    // A dispatched mission renders <MissionLiveProgress>, which reads through
    // TanStack Query, so every render in this file needs the provider.
    ...renderWithQuery(
      <Panel
        detail={detail}
        detailLoading={false}
        mission={detail.mission}
        promptCollapsed
        onPromptCollapsedChange={() => {}}
        onEdit={() => {}}
        onCancel={onCancel}
        onDelete={() => {}}
      />,
    ),
  };
}

// ── the cadence row ────────────────────────────────────────────

describe("the detail grid says Cadence, and reads it off the schedule", () => {
  it("prints the schedule's human cadence", () => {
    renderPanel({ mission: mission(), schedule: schedule() });

    expect(screen.getByText("Cadence")).toBeInTheDocument();
    expect(screen.getByText("every 30 minutes")).toBeInTheDocument();
  });

  it("falls back to the raw expression when there is no display text", () => {
    renderPanel({ mission: mission(), schedule: schedule({ scheduleDisplay: "" }) });

    expect(screen.getByText("every 30m")).toBeInTheDocument();
  });

  it("says One-shot for a mission that is not scheduled", () => {
    renderPanel({ mission: mission(), schedule: null });

    expect(screen.getByText("Cadence")).toBeInTheDocument();
    expect(screen.getByText("One-shot")).toBeInTheDocument();
  });

  it("does not have two things called Schedule on one panel", () => {
    // The card below is headed "Schedule". The grid row used to be too, which
    // is why it is now "Cadence".
    renderPanel({ mission: mission(), schedule: schedule() });

    expect(screen.getAllByText("Schedule")).toHaveLength(1);
  });
});

// ── the card ───────────────────────────────────────────────────

describe("the Schedule card is alive", () => {
  it("renders for a scheduled mission and not for a one-shot one", () => {
    const { unmount } = renderPanel({ mission: mission(), schedule: schedule() });
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    unmount();

    renderPanel({ mission: mission(), schedule: null });
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();
  });

  it("says when the next run is, and how the last one went", () => {
    renderPanel({ mission: mission(), schedule: schedule() });

    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Last")).toBeInTheDocument();
    expect(screen.getByText("Last result: dispatched")).toBeInTheDocument();
  });

  it("says None and Never rather than leaving the two facts blank", () => {
    renderPanel({
      mission: mission(),
      schedule: schedule({ nextRunAt: null, lastRunAt: null, lastStatus: null }),
    });

    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.queryByText(/^Last result:/)).not.toBeInTheDocument();
  });

  it("links to the section that edits schedules, not to the Hermes cron surface", () => {
    renderPanel({ mission: mission(), schedule: schedule() });

    const link = screen.getByRole("link", { name: /edit schedule/i });
    expect(link).toHaveAttribute("href", "#scheduled-missions");
    // /agent/settings/cron is the Hermes cron surface. This schedule is a
    // PatterStage schedule row; the old link answered "which job is this?"
    // with the wrong page.
    expect(document.querySelector('a[href^="/agent/settings/cron"]')).toBeNull();
  });
});

// ── the "why isn't it firing" line ─────────────────────────────

describe("the card says why a schedule is not going to fire", () => {
  it("says nothing extra while the schedule is healthy", () => {
    renderPanel({ mission: mission(), schedule: schedule() });

    expect(screen.queryByText(/will not fire/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Paused\./)).not.toBeInTheDocument();
  });

  it("names a paused schedule", () => {
    renderPanel({ mission: mission(), schedule: schedule({ enabled: false }) });

    expect(
      screen.getByText("Paused. It will not fire until you resume it."),
    ).toBeInTheDocument();
  });

  it("names a schedule that has run all the times it was set to run", () => {
    renderPanel({
      mission: mission(),
      schedule: schedule({ repeatTimes: 3, repeatDone: 3, nextRunAt: null }),
    });

    expect(
      screen.getByText("Finished: it has run all 3 times it was set to run."),
    ).toBeInTheDocument();
  });

  it("names a schedule with no next run", () => {
    renderPanel({ mission: mission(), schedule: schedule({ nextRunAt: null }) });

    expect(
      screen.getByText("No next run is set, so it will not fire again."),
    ).toBeInTheDocument();
  });
});

// ── the sessions link (D69) ────────────────────────────────────

describe("a mission links to the sessions it produced", () => {
  it("carries View sessions, pointing at the sessions list filtered by this mission", () => {
    renderPanel({ mission: mission(), schedule: null });

    const link = screen.getByRole("link", { name: /view sessions/i });
    // The MISSION id, not the session id: the affordance is "everything this
    // mission produced", and it is the mirror of mission-deep-link.ts, which
    // is how a session row opens its parent mission.
    expect(link).toHaveAttribute("href", "/results/sessions?missionId=m-1");
  });

  it("escapes an id that would otherwise break the query string", () => {
    renderPanel({ mission: mission({ id: "m 1&x" }), schedule: null });

    expect(screen.getByRole("link", { name: /view sessions/i })).toHaveAttribute(
      "href",
      "/results/sessions?missionId=m%201%26x",
    );
  });

  it("is absent for a mission that has never dispatched", () => {
    renderPanel({ mission: mission({ sessionId: undefined, status: "queued" }), schedule: null });

    expect(screen.queryByRole("link", { name: /view sessions/i })).not.toBeInTheDocument();
  });
});

// ── the far end of that link ───────────────────────────────────

describe("the sessions surface honours ?missionId=", () => {
  const ROOT = join(__dirname, "..", "..");

  /**
   * The file with its comments taken out. Both of these files mention
   * `missionId` in prose already (the page's header comment describes the
   * group-by-mission toggle), and a comment is not a wire.
   */
  function code(path: string): string {
    return readFileSync(join(ROOT, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  // Structural, not behavioural, and deliberately so: B11 owns the sessions
  // page's URL state (D37) and will reshape how the param is read. What B10
  // needs is only that the link it ships is not decorative — the hook puts
  // missionId on the request, and the page takes it off the URL.

  it("the sessions hook can filter by mission", () => {
    expect(code("src/hooks/useSessions.ts")).toContain("missionId");
  });

  it("the sessions page reads the mission from its own URL", () => {
    expect(code("src/app/results/sessions/page.tsx")).toContain("missionId");
  });
});

// ── GREEN CONTROL ──────────────────────────────────────────────

describe("GREEN CONTROL: the D66 cancel still confirms (B2, T-0096)", () => {
  it("arms on the first click, stays enabled, and cancels on the second", () => {
    const onCancel = jest.fn();
    renderPanel(
      { mission: mission({ status: "dispatched", sessionId: undefined }), schedule: null },
      onCancel,
    );

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const armed = screen.getByRole("button", { name: /confirm\?/i });
    expect(armed).not.toBeDisabled();

    fireEvent.click(armed);
    expect(onCancel).toHaveBeenCalledWith("m-1");
  });
});

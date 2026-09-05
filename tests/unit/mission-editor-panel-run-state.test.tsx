/**
 * @jest-environment jsdom
 *
 * The detail panel's answer to "what is it doing" and "why did it fail".
 *
 * Two defects are pinned here. The Elapsed row measured from the mission's
 * createdAt, so a mission authored a week ago and dispatched twelve seconds
 * ago claimed seven days of runtime. And the Results / Error blocks read
 * `mission.results` and `mission.error`, neither of which any route has ever
 * returned (the column is `result`, singular, and the failure text lives on
 * the run row) so a failed mission explained precisely nothing.
 */

import { render, screen } from "@testing-library/react";
import MissionEditorPanel from "@/components/missions/MissionEditorPanel";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";

// The live-progress child opens an EventSource; this panel test is about the
// static run facts, not the stream.
jest.mock("@/components/missions/MissionLiveProgress", () => ({
  __esModule: true,
  default: () => null,
}));

const WEEK_AGO = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
const TWELVE_SECONDS_AGO = new Date(Date.now() - 12_000).toISOString();

function mission(over: Partial<MissionRow> = {}): MissionRow {
  return {
    id: "m1",
    name: "Nightly triage",
    prompt: "Triage the queue",
    status: "dispatched",
    createdAt: WEEK_AGO,
    updatedAt: TWELVE_SECONDS_AGO,
    ...over,
  } as MissionRow;
}

function detailFor(m: MissionRow, run: MissionDetail["run"] = null): MissionDetail {
  return { mission: m, run, schedule: null };
}

function renderPanel(m: MissionRow, run: MissionDetail["run"] = null) {
  return render(
    <MissionEditorPanel
      detail={detailFor(m, run)}
      detailLoading={false}
      mission={m}
      promptCollapsed
      onPromptCollapsedChange={() => {}}
      onEdit={() => {}}
      onCancel={() => {}}
      onDelete={() => {}}
    />,
  );
}

describe("MissionEditorPanel run state", () => {
  it("measures a running mission from its run, not from when it was written", () => {
    const m = mission();
    renderPanel(m, {
      id: "r1",
      status: "started",
      submittedAt: TWELVE_SECONDS_AGO,
      completedAt: null,
      error: null,
      deadlineAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      deadlineDeclared: true,
    });

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("12s")).toBeInTheDocument();
    expect(screen.queryByText("7d 0h")).toBeNull();
  });

  it("says how long is left before the reconciler stops waiting", () => {
    renderPanel(mission(), {
      id: "r1",
      status: "started",
      submittedAt: TWELVE_SECONDS_AGO,
      completedAt: null,
      error: null,
      deadlineAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      deadlineDeclared: true,
    });
    expect(screen.getByText(/left before the declared timeout/)).toBeInTheDocument();
  });

  it("flags an overdue run instead of showing the same row as a healthy one", () => {
    renderPanel(mission(), {
      id: "r1",
      status: "started",
      submittedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      completedAt: null,
      error: null,
      deadlineAt: new Date(Date.now() - 60_000).toISOString(),
      deadlineDeclared: true,
    });
    expect(screen.getByText("2h 0m")).toBeInTheDocument();
    expect(
      screen.getByText(/past its declared timeout - the next reconcile tick will fail this run/),
    ).toBeInTheDocument();
  });

  it("shows the backend's failure text, which the panel used to discard", () => {
    const failed = mission({ status: "failed", result: "Cancelled by user" });
    renderPanel(failed, {
      id: "r1",
      status: "failed",
      submittedAt: WEEK_AGO,
      completedAt: TWELVE_SECONDS_AGO,
      error: "fetch failed",
      deadlineAt: null,
      deadlineDeclared: false,
    });

    expect(screen.getByText("Run error")).toBeInTheDocument();
    expect(screen.getByText("fetch failed")).toBeInTheDocument();
    // `result`, singular: the field the repository actually returns.
    expect(screen.getByText("Cancelled by user")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders nothing about runs for a mission that has never been dispatched", () => {
    renderPanel(mission({ status: "queued", queuedForRun: false }));
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByText("Run error")).toBeNull();
  });
});

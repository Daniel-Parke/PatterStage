/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (C126, the walk finding the plan folds into
// D70/D72: "the insights strip agrees with the board — one count set, the
// ratified status labels").
//
// Written before the product code moved. Holds contract section 6.
//
// The defect: the missions page counts its missions three times, in three
// vocabularies, and two of the three disagree on the facts.
//
//   1. computeMissionCounts (mission-filters.ts) -> {active, completed, failed,
//      drafts, queued}, reached through useMissionsFiltering.missionCounts and
//      useMissionsPage, and rendered by NOTHING. Dead.
//   2. MissionsList counts per column with missionBoardColumn and labels the
//      columns "Drafts / Queued / Dispatched / Completed / Failed", with filter
//      chips reading "all / draft / queued / dispatched / successful / failed".
//   3. MissionInsights counts m.status straight into {queued, dispatched,
//      successful, failed} and labels them "Total / Active / Done / Failed".
//
// Set 3 is not merely differently worded. A save-draft mission is
// `status: "queued", queuedForRun: false`: a DRAFT in column 2, and Queued —
// and therefore Active — in strip 3. The same board, two answers.
//
// The contract: one counting function keyed on the board's own columns
// (countMissionsByColumn), one label map typed against the ratified thirteen
// words (MISSION_COLUMN_LABELS), and both surfaces read them.
// ═══════════════════════════════════════════════════════════════

import { render, screen } from "@testing-library/react";

import * as missionBoard from "@/lib/missions/mission-board";
import * as statusLabels from "@/lib/status-labels";
import type { MissionRow } from "@/hooks/missions-page-types";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";

// ── the Donut double ───────────────────────────────────────────
//
// Donut's `label` is a React key and an author-facing name; it is never
// rendered. So the segment contract is read off the props, not the DOM.

interface Segment {
  label: string;
  value: number;
  color: string;
}
const donutProps: Array<{ segments: Segment[]; center?: unknown; centerSub?: unknown }> = [];

jest.mock("@/components/viz/Donut", () => ({
  __esModule: true,
  default: (props: { segments: Segment[]; center?: unknown; centerSub?: unknown }) => {
    donutProps.push(props);
    return null;
  },
}));

import MissionInsights from "@/components/missions/MissionInsights";
import MissionsList from "@/components/missions/MissionsList";

// ── pre-B10 shims for the two new exports ──────────────────────

type BoardColumn = "draft" | "queued" | "dispatched" | "successful" | "failed";

const board = missionBoard as unknown as {
  MISSION_BOARD_COLUMNS?: readonly BoardColumn[];
  countMissionsByColumn?: (
    missions: readonly { status: string; queuedForRun?: boolean }[],
  ) => Record<BoardColumn, number>;
};
const labels = statusLabels as unknown as {
  MISSION_COLUMN_LABELS?: Record<BoardColumn, string>;
};

// ── fixtures ───────────────────────────────────────────────────
//
// Deliberately lopsided counts, all distinct, so a bucket that is quietly
// merged into another (drafts into queued, queued into "active") shows up as a
// wrong number rather than as a coincidence: 2 drafts, 3 queued, 4 running,
// 5 completed, 6 failed, 20 in total.

function rows(): MissionRow[] {
  const make = (prefix: string, n: number, fields: Partial<MissionRow>): MissionRow[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`,
      name: `${prefix} mission ${i}`,
      prompt: "Triage the queue",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      ...fields,
    })) as MissionRow[];

  return [
    ...make("drafted", 2, { status: "queued", queuedForRun: false }),
    ...make("waiting", 3, { status: "queued", queuedForRun: true }),
    ...make("running", 4, { status: "dispatched" }),
    ...make("done", 5, { status: "successful" }),
    ...make("burned", 6, { status: "failed" }),
  ];
}

// ── the two new exports ────────────────────────────────────────

describe("one counting function, keyed on the board's own columns", () => {
  it("gives every column a number, and puts a save-draft in Draft", () => {
    expect(board.countMissionsByColumn?.(rows())).toEqual({
      draft: 2,
      queued: 3,
      dispatched: 4,
      successful: 5,
      failed: 6,
    });
  });

  it("answers zero for an empty board rather than an absent key", () => {
    expect(board.countMissionsByColumn?.([])).toEqual({
      draft: 0,
      queued: 0,
      dispatched: 0,
      successful: 0,
      failed: 0,
    });
  });

  it("names the five columns in board order", () => {
    expect(board.MISSION_BOARD_COLUMNS).toEqual([
      "draft",
      "queued",
      "dispatched",
      "successful",
      "failed",
    ]);
  });
});

describe("one label map, in the ratified words", () => {
  it("maps every column to decision 13's word", () => {
    expect(labels.MISSION_COLUMN_LABELS).toEqual({
      draft: "Draft",
      queued: "Queued",
      dispatched: "Running",
      successful: "Completed",
      failed: "Failed",
    });
  });

  it("speaks only words that are in the vocabulary", () => {
    const map = labels.MISSION_COLUMN_LABELS;
    expect(map).toBeDefined();
    const vocabulary = new Set<string>(statusLabels.STATUS_VOCABULARY);
    const words = Object.values(map ?? {});
    expect(words).toHaveLength(5);
    for (const word of words) {
      expect(vocabulary.has(word)).toBe(true);
    }
  });

  it("agrees with missionStatusLabel, which answers the same question per row", () => {
    const map = labels.MISSION_COLUMN_LABELS ?? ({} as Record<BoardColumn, string>);
    expect(statusLabels.missionStatusLabel({ status: "queued", queuedForRun: false })).toBe(map.draft);
    expect(statusLabels.missionStatusLabel({ status: "queued", queuedForRun: true })).toBe(map.queued);
    expect(statusLabels.missionStatusLabel({ status: "dispatched" })).toBe(map.dispatched);
    expect(statusLabels.missionStatusLabel({ status: "successful" })).toBe(map.successful);
    expect(statusLabels.missionStatusLabel({ status: "failed" })).toBe(map.failed);
  });
});

// ── the insights strip ─────────────────────────────────────────

describe("the insights strip counts what the board counts", () => {
  beforeEach(() => {
    donutProps.length = 0;
    render(<MissionInsights missions={rows()} />);
  });

  it("gives the donut the five board columns, in the ratified words, with the board's numbers", () => {
    expect(donutProps).toHaveLength(1);
    expect(donutProps[0].segments.map((s) => [s.label, s.value])).toEqual([
      ["Draft", 2],
      ["Queued", 3],
      ["Running", 4],
      ["Completed", 5],
      ["Failed", 6],
    ]);
    expect(donutProps[0].center).toBe(20);
  });

  it("labels its tiles Total, Running, Completed and Failed", () => {
    for (const label of ["Total", "Running", "Completed", "Failed"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("puts the right number under each tile", () => {
    const tile = (label: string) => screen.getByText(label).closest("div")?.parentElement;
    expect(tile("Total")).toHaveTextContent("20");
    expect(tile("Running")).toHaveTextContent("4");
    expect(tile("Completed")).toHaveTextContent("5");
    expect(tile("Failed")).toHaveTextContent("6");
  });

  it("has stopped speaking the second vocabulary", () => {
    // "Active" merged drafts with running work; "Done" and "Successful" were
    // two more words for Completed; "Dispatched" was the raw enum.
    for (const word of ["Active", "Done", "Successful", "Dispatched"]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });
});

// ── the board ──────────────────────────────────────────────────

function vmFor(missions: MissionRow[]): MissionsPageViewModel {
  return {
    missions,
    filtered: missions,
    showCreate: false,
    filter: "all",
    setFilter: jest.fn(),
    search: "",
    setSearch: jest.fn(),
    expandedId: null,
    setExpandedId: jest.fn(),
    detail: null,
    detailLoading: false,
    promptCollapsed: true,
    setPromptCollapsed: jest.fn(),
    collapsedColumns: {},
    setCollapsedColumns: jest.fn(),
    categoryFilter: "all",
    setCategoryFilter: jest.fn(),
    missionCategoryFilter: "all",
    setMissionCategoryFilter: jest.fn(),
    templateCategoryPills: [],
    missionCategoryPills: [],
    filteredGrouped: [],
    categories: [],
    handleTemplateSelect: jest.fn(),
    openTemplateManager: jest.fn(),
    openCategoryManager: jest.fn(),
    handleEdit: jest.fn(),
    handleDelete: jest.fn(),
    handleCancel: jest.fn(),
    handleDuplicateMission: jest.fn(),
    cancellingMissionId: null,
    missionsLoadError: null,
    fetchData: jest.fn(),
  } as unknown as MissionsPageViewModel;
}

describe("the board speaks the same five words", () => {
  beforeEach(() => {
    render(<MissionsList vm={vmFor(rows())} />);
  });

  it("heads its columns with the ratified labels", () => {
    // Each word appears twice: once as a column header, once as a filter chip.
    for (const word of ["Draft", "Queued", "Running", "Completed", "Failed"]) {
      expect(screen.getAllByText(word).length).toBeGreaterThanOrEqual(2);
    }
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("has stopped printing the raw enum and the plural", () => {
    for (const word of ["Drafts", "Dispatched", "Successful", "all", "draft", "dispatched", "successful"]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });

  it("still counts each column correctly", () => {
    // GREEN CONTROL for the numbers themselves: 2/3/4/5/6 are already right on
    // the board today. What section 6 changes is where they come from, so this
    // must stay green through the rewrite.
    for (const n of ["2", "3", "4", "5", "6"]) {
      expect(screen.getAllByText(n)).toHaveLength(1);
    }
  });
});

// ── the dead count set ─────────────────────────────────────────

describe("the third count set is gone", () => {
  it("mission-filters no longer exports a second way to count a board", () => {
    // Read at call time so the assertion is about the module's shape, not an
    // import that would become a typecheck error once the export is deleted.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const filters = require("@/lib/missions/mission-filters") as Record<string, unknown>;
    expect(filters.computeMissionCounts).toBeUndefined();
  });
});

/** @jest-environment jsdom */
/**
 * U9 (T-0123), part one: the busiest screen.
 *
 * Four things, and the first is the one the operator would name.
 *
 * ── the board is inset from the strip above it ────────────────
 *
 * `AppPageShell` owns the measure (T-0117): one container, one left edge, and
 * every page's h1 shares it with its content by construction. `MissionsList`
 * then opens with `<div className="w-full max-w-none px-6 py-6">` and puts its
 * whole body 24px further right than `MissionInsights`, which is its immediate
 * sibling.
 *
 * The geometry gate cannot see this. It asserts `h1.left === contentLeft`, and
 * contentLeft is the LEFTMOST content block - which is the insights strip,
 * correctly aligned. A page whose blocks disagree with EACH OTHER passes a gate
 * that only ever compares one of them to the heading. So the instrument grows a
 * second reading here: how many left edges the page's own ROWS start at. One
 * container means one. Rows rather than blocks, because a grid's second column
 * is a block at a different left and is exactly where it belongs - a first cut
 * of this compared blocks and called 15 of 23 routes broken, almost all of it
 * grid.
 *
 * ── the board clips its last column, by arithmetic ────────────
 *
 * Five columns at `min-w-[240px]` with `gap-4` need 1264px. Inside the rail at
 * 1440 the content column is about 1136. The row is `overflow-x-auto`, so the
 * overflow is silent and FAILED - the last column, and the one you look for -
 * is the half that goes off the edge. It is not a narrow-viewport problem; it
 * is every viewport, because a fixed minimum times five is wider than the
 * column at any width the rail leaves.
 *
 * A grid that wraps says the same thing without a scrollbar: at 1440 three
 * columns and then two, at 1024 two, at 390 one. Nothing is hidden, and the
 * board stops being a horizontal scroller inside a vertical scroller.
 *
 * ── status is counted three times and filterable without ARIA ─
 *
 * The strip draws four count tiles, the board draws five column counts, and
 * the filter row draws five buttons with no counts and no state anything but a
 * sighted user can perceive. The counts belong ON the filter, where they say
 * what you are about to filter TO; the tiles restate the columns directly
 * below them and go. The donut and the success ring stay: a mix and a rate are
 * not a count, and you cannot get either by reading the board.
 *
 * ── and both filter rows become real ─────────────────────────
 *
 * Status and mission-category are two of the thirteen filter groups that
 * render their state as colour alone. They are `SegmentedControl` now: a
 * radiogroup with a name, `aria-checked`, and one tab stop instead of eleven.
 */
import { render, screen } from "@testing-library/react";

import MissionsList from "@/components/missions/MissionsList";
import MissionInsights from "@/components/missions/MissionInsights";
import type { MissionRow } from "@/hooks/missions-page-types";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";
import { splitBlocks } from "../e2e/lib/census-analysis";

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
    missionCategoryPills: [
      { id: "ops", name: "Ops", color: "cyan", count: 12 },
      { id: "research", name: "Research", color: "purple", count: 8 },
    ],
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

describe("the board sits where the page sits", () => {
  it("adds no page padding of its own; the shell owns the measure", () => {
    const { container } = render(<MissionsList vm={vmFor(rows())} />);
    const root = container.firstElementChild!;
    const classes = (root.getAttribute("class") ?? "").split(/\s+/);
    // Horizontal padding and a width declaration are the shell's. Vertical
    // rhythm is the density's, also the shell's.
    for (const banned of ["px-6", "px-4", "w-full", "max-w-none", "py-6"]) {
      expect(classes).not.toContain(banned);
    }
  });
});

describe("the board wraps rather than scrolling sideways", () => {
  it("is a grid, and nothing in it is an x-scroller", () => {
    const { container } = render(<MissionsList vm={vmFor(rows())} />);
    const scrollers = container.querySelectorAll(".overflow-x-auto");
    expect(Array.from(scrollers).map((el) => (el.getAttribute("class") ?? "").slice(0, 60))).toEqual(
      [],
    );
  });

  it("lays the five columns out on a grid that reflows", () => {
    const { container } = render(<MissionsList vm={vmFor(rows())} />);
    const board = container.querySelector("[data-testid=missions-board]");
    expect(board).not.toBeNull();
    const classes = (board!.getAttribute("class") ?? "").split(/\s+/);
    expect(classes).toContain("grid");
    // One column on a phone, and more as there is room. A fixed count is a
    // horizontal scroller wearing a grid's clothes.
    expect(classes.some((c) => /^grid-cols-1$/.test(c))).toBe(true);
    expect(classes.some((c) => /^(sm|md|lg|xl):grid-cols-\d$/.test(c))).toBe(true);
  });

  /** The arithmetic that makes the old layout clip, held as a number. */
  it("gives no column a minimum wide enough to force the row over", () => {
    const { container } = render(<MissionsList vm={vmFor(rows())} />);
    const board = container.querySelector("[data-testid=missions-board]")!;
    for (const col of Array.from(board.children)) {
      const classes = (col.getAttribute("class") ?? "").split(/\s+/);
      expect(classes.filter((c) => /^min-w-\[\d+px\]$/.test(c))).toEqual([]);
    }
  });
});

describe("the filters say what they are and what they hold", () => {
  it("makes status a named radiogroup", () => {
    render(<MissionsList vm={vmFor(rows())} />);
    expect(screen.getByRole("radiogroup", { name: /status/i })).toBeInTheDocument();
  });

  it("puts the counts on the status filter, where they say what you are filtering to", () => {
    render(<MissionsList vm={vmFor(rows())} />);
    const group = screen.getByRole("radiogroup", { name: /status/i });
    const text = group.textContent ?? "";
    // 2 drafts, 3 queued, 4 running, 5 completed, 6 failed, 20 in total.
    for (const [label, count] of [
      ["All", 20],
      ["Draft", 2],
      ["Queued", 3],
      ["Running", 4],
      ["Completed", 5],
      ["Failed", 6],
    ] as const) {
      expect(text).toContain(`${label}${count}`);
    }
  });

  it("makes the mission categories a named radiogroup too", () => {
    render(<MissionsList vm={vmFor(rows())} />);
    const group = screen.getByRole("radiogroup", { name: /categor/i });
    expect(group.textContent).toContain("Ops");
    expect(group.textContent).toContain("Research");
  });

  it("leaves no hand-rolled pill row behind", () => {
    const { container } = render(<MissionsList vm={vmFor(rows())} />);
    expect(container.querySelectorAll("button.rounded-full")).toHaveLength(0);
  });
});

describe("the strip stops restating the columns underneath it", () => {
  it("draws no count tiles", () => {
    render(<MissionInsights missions={rows()} />);
    // The four tiles were labelled with the column words. The donut's segment
    // labels are props rather than text, so they cannot answer for these.
    for (const word of ["Draft", "Running", "Completed", "Failed"]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });

  it("keeps the two things a count cannot tell you", () => {
    const { container } = render(<MissionInsights missions={rows()} />);
    // A mix and a rate: the donut and the success ring, both still drawn.
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * The instrument, as a pure function so jest can check it against hand-written
 * cases rather than against a page. `splitBlocks` answers the question the
 * geometry gate could not ask: not "is the heading over its content", but "do
 * this page's own rows agree with each other".
 *
 * ROWS, and the first version of this got that wrong. It compared every content
 * block to the leftmost and reported 15 of 23 routes split by up to 789px -
 * almost all of it grid, because the second and third cards of a three-column
 * layout are content blocks at +395 and +789 and are exactly where they belong.
 * A page's blocks do not share a left edge. Its rows do.
 */
describe("splitBlocks names the rows that left the column", () => {
  const at = (left: number, top: number, what: string, height = 40) => ({
    left,
    top,
    height,
    what,
  });

  it("finds nothing when every row starts on the column", () => {
    expect(splitBlocks([at(120, 0, "a"), at(120, 60, "b")], 1)).toEqual([]);
  });

  it("returns an empty list for a page with one block, or none", () => {
    expect(splitBlocks([at(120, 0, "only")], 1)).toEqual([]);
    expect(splitBlocks([], 1)).toEqual([]);
  });

  it("names the row that is inset, not the column it left", () => {
    expect(splitBlocks([at(120, 0, "strip"), at(144, 60, "board")], 1)).toEqual([
      { left: 144, what: "board", offset: 24 },
    ]);
  });

  /**
   * The half that matters, and the reason this takes tops and heights: three
   * cards side by side are ONE row, and its left is the leftmost of them.
   */
  it("reads a grid row as one row, not three strays", () => {
    expect(
      splitBlocks(
        [at(120, 0, "heading"), at(120, 60, "card a"), at(395, 60, "card b"), at(789, 60, "card c")],
        1,
      ),
    ).toEqual([]);
  });

  it("still catches a grid whose whole row is inset", () => {
    expect(
      splitBlocks(
        [at(120, 0, "heading"), at(144, 60, "card a"), at(419, 60, "card b")],
        1,
      ),
    ).toEqual([{ left: 144, what: "card a", offset: 24 }]);
  });

  /** A block that overlaps the row above joins it rather than opening one. */
  it("keeps a tall block and the short ones beside it in one row", () => {
    expect(
      splitBlocks([at(120, 0, "tall", 200), at(400, 20, "beside"), at(120, 260, "next")], 1),
    ).toEqual([]);
  });

  /**
   * A row's left is the LEFTMOST block in it, and these two cases are what
   * make that assertion able to fail. Sorted by top and then left, the
   * leftmost block of a row usually arrives first anyway - so an
   * implementation that simply takes the first block it sees passes every
   * case where the blocks in a row start level. It only shows when they do
   * not: a tall card on the right, and a shorter one beside it starting a
   * few pixels lower.
   */
  it("takes a row's left from its leftmost block, not its first", () => {
    expect(
      splitBlocks(
        [at(120, 0, "heading"), at(400, 60, "tall card", 200), at(120, 80, "short card")],
        1,
      ),
    ).toEqual([]);
  });

  /**
   * And the page's column is the leftmost ROW, not the first one. A page whose
   * first block is inset and whose later rows are not would otherwise adopt
   * the inset as the column and report nothing at all.
   */
  it("takes the column from the leftmost row, not the first row", () => {
    expect(splitBlocks([at(144, 0, "inset banner"), at(120, 60, "the rest")], 1)).toEqual([
      { left: 144, what: "inset banner", offset: 24 },
    ]);
  });

  it("takes the leftmost row as the column, not the commonest", () => {
    expect(
      splitBlocks([at(120, 0, "strip"), at(144, 60, "board"), at(144, 200, "schedules")], 1),
    ).toEqual([
      { left: 144, what: "board", offset: 24 },
      { left: 144, what: "schedules", offset: 24 },
    ]);
  });

  it("forgives a sub-pixel difference, because layout is not integers", () => {
    expect(splitBlocks([at(120, 0, "a"), at(121, 60, "b")], 1)).toEqual([]);
    expect(splitBlocks([at(120, 0, "a"), at(122, 60, "b")], 1)).toHaveLength(1);
  });
});

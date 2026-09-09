/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U19 · The board comes first.
 *
 * On the busiest screen the missions started 500px below the fold, under the
 * Quick load template section: a heading, a blurb, an eight-way segmented
 * control and eight category accordions, all above the status filter and the
 * board. On an empty board the operator scrolled past templates to read "No
 * missions yet" (the UI review of 2026-09-08, P3).
 *
 * The templates are a collapsed disclosure that says how many it holds and
 * opens on demand, so the board is the first thing under the filters. An
 * empty board's empty state carries the two things to do, New Mission and
 * Load a template, so the first action is one click from the top. The
 * disclosure is the one primitive (CollapsibleSection, which grows a
 * controlled mode for it) and its own controls are not inside its button.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/help/ConceptHint", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import MissionsList from "@/components/missions/MissionsList";
import type { MissionRow } from "@/hooks/missions-page-types";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const template = { id: "t1", name: "Bug Hunt", icon: "bug", color: "cyan", description: "Find the bug", isCustom: true };

function rows(n: number): MissionRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m-${i}`,
    name: `mission ${i}`,
    prompt: "Triage the queue",
    status: i % 2 ? "successful" : "dispatched",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
  })) as unknown as MissionRow[];
}

function vmFor(missions: MissionRow[]) {
  const openCreate = jest.fn();
  const vm = {
    missions,
    filtered: missions,
    showCreate: false,
    openCreate,
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
    templates: [template],
    templateCategoryPills: [],
    missionCategoryPills: [],
    filteredGrouped: [{ categoryId: "c1", label: "Ops", color: "cyan", items: [template] }],
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
  return { vm, openCreate };
}

const disclosure = () => screen.getByRole("button", { name: /Quick load template/ });

describe("U19 · the board comes first", () => {
  it("with missions on the board, the templates are a collapsed disclosure and the board is under the filters", () => {
    const { vm } = vmFor(rows(4));
    render(<MissionsList vm={vm} />);
    expect(disclosure()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Bug Hunt")).toBeNull();
    expect(screen.getByTestId("missions-board")).toBeInTheDocument();
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Bug Hunt")).toBeInTheDocument();
  });

  it("the disclosure says how many templates it holds", () => {
    const { vm } = vmFor(rows(2));
    render(<MissionsList vm={vm} />);
    expect(disclosure()).toHaveTextContent(/1 template\b/);
  });

  it("with no missions, the empty state offers New Mission and Load a template", () => {
    const { vm, openCreate } = vmFor([]);
    render(<MissionsList vm={vm} />);
    expect(screen.getByText(/No missions yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Mission" }));
    expect(openCreate).toHaveBeenCalledTimes(1);
    expect(disclosure()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Load a template" }));
    expect(disclosure()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Bug Hunt")).toBeInTheDocument();
  });

  it("Manage categories and Edit Templates are the section's, not the button's", () => {
    const { vm } = vmFor(rows(1));
    const { container } = render(<MissionsList vm={vm} />);
    fireEvent.click(disclosure());
    expect(screen.getByRole("button", { name: "Manage categories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit Templates/ })).toBeInTheDocument();
    expect(container.querySelector("button button")).toBeNull();
  });

  it("is the one disclosure primitive, with a controlled mode", () => {
    expect(read("src/components/missions/MissionsList.tsx")).toMatch(/from "@\/components\/ui\/CollapsibleSection"/);
    const src = read("src/components/ui/CollapsibleSection.tsx");
    expect(src).toMatch(/expanded\?: boolean/);
    expect(src).toMatch(/onExpandedChange\?:/);
    expect(read("docs/contributing/design-tokens.md")).toContain("`CollapsibleSection`");
  });
});

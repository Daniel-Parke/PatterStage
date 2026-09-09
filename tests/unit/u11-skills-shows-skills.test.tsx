/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): Skills shows skills.
 *
 * Measured at 1440x900 on the running product: the first viewport of
 * /agent/skills held a 128px strip saying "78" five times, a search box, an
 * "Active 78 / 20 categories" band and twenty COLLAPSED category rows. Not one
 * skill name was on screen. The page answered "how many" (which the subtitle
 * had already answered) and refused "which".
 *
 * T-0032 collapsed the categories for a reason - 178 cards came to 5,450 DOM
 * nodes - and that reason is kept: the page window and the search-replaces-
 * the-view rule are untouched. What changes is the DEFAULT and the ROW. A
 * category opens by default while the section is small enough to render in
 * full (four page windows), and a skill is one line rather than a card, so the
 * same catalogue costs a fraction of the nodes it did. Above that size the
 * categories collapse as before, because a wall is still a wall.
 *
 * The strip goes. Active, Inactive and Total were the donut's own arcs and
 * centre, Categories was the only fact it carried, and the subtitle now
 * carries all four in one line.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("@/components/layout/PageHeader", () => ({
  __esModule: true,
  default: ({ subtitle }: { subtitle?: string }) => <div data-testid="page-header">{subtitle}</div>,
}));
jest.mock("@/components/ui/ProfilePicker", () => ({
  __esModule: true,
  default: () => <div data-testid="profile-picker" />,
}));
jest.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    refetch: async () => undefined, data: [{ id: "default", name: "Bob (local default)", description: "" }],
    isLoading: false,
    error: null,
  }),
}));

const apiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  __esModule: true,
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  toastError: jest.fn(),
  // Amended 2026-09-10 (C3, T-0138): the toggle writes through runWrite, which says a
  // failure through messageFromError.
  messageFromError: (e: unknown, f: string) => (e instanceof Error ? e.message : f),
  API_FETCH_BULK_TIMEOUT_MS: 300_000,
}));

import SkillsPage from "@/app/agent/skills/page";
import { categoriesOpenByDefault, pageSlice } from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

const PAGE = pageSlice(Array.from({ length: 1000 }, (_, i) => i), 0).length;

function catalogue(active: number, inactive: number, categories = 4): Skill[] {
  const out: Skill[] = [];
  for (let i = 0; i < active + inactive; i++) {
    const cat = `cat-${String(i % categories).padStart(2, "0")}`;
    out.push({
      name: `${cat}-skill-${String(i).padStart(3, "0")}`,
      category: cat,
      description: `does ${cat} things`,
      enabled: i < active,
    } as Skill);
  }
  return out;
}

function answer(skills: Skill[]) {
  apiFetch.mockReset();
  apiFetch.mockImplementation((url: string) => {
    if (url.startsWith("/api/skills?")) return Promise.resolve({ data: { skills, profile: "default" } });
    if (url.includes("/toggle")) return Promise.resolve({ data: { ok: true } });
    return Promise.resolve({ data: { content: "# body" } });
  });
}

const rows = () => screen.queryAllByTestId("skill-row");

describe("the rule", () => {
  it("opens a section of up to four page windows, and collapses one beyond that", () => {
    expect(categoriesOpenByDefault(1)).toBe(true);
    expect(categoriesOpenByDefault(4 * PAGE)).toBe(true);
    expect(categoriesOpenByDefault(4 * PAGE + 1)).toBe(false);
  });
});

describe("a modest catalogue opens with its skills on screen", () => {
  it("renders every active skill as a row without a click, and no strip above them", async () => {
    answer(catalogue(30, 0));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(screen.queryByTestId("stat-tile")).toBeNull();
    expect(screen.queryByTestId("stat-ring")).toBeNull();
    expect(screen.queryByTestId("donut-legend")).toBeNull();
  });

  it("a row is one line: name, description, state, a switch, View and Edit", async () => {
    answer(catalogue(3, 0));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    const row = rows()[0];
    expect(row).toHaveAttribute("data-skill", "cat-00-skill-000");
    expect(within(row).getByText("cat-00-skill-000")).toBeInTheDocument();
    expect(within(row).getByText("does cat-00 things")).toBeInTheDocument();
    const toggle = within(row).getByTestId("skill-toggle");
    expect(toggle).toHaveAttribute("role", "switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(within(row).getByTestId("skill-view")).toBeInTheDocument();
    expect(within(row).getByTestId("skill-edit")).toBeInTheDocument();
  });

  it("a category can still be collapsed, and collapsing takes its rows out", async () => {
    answer(catalogue(8, 0, 2));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(8));
    const row = screen.getAllByTestId("skill-category-row")[0];
    expect(row).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(rows()).toHaveLength(4);
  });

  it("an empty Inactive section is not drawn; an empty Active one is, because it is the point of the screen", async () => {
    answer(catalogue(3, 0));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.queryByText(/No inactive skills/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Inactive/ })).toBeNull();

    answer(catalogue(0, 3));
    render(<SkillsPage />);
    expect(await screen.findByText(/No active skills/)).toBeInTheDocument();
  });
});

describe("a large catalogue still opens as a list of categories", () => {
  it("collapses every category when a section exceeds four page windows", async () => {
    answer(catalogue(4 * PAGE + 1, 0, 6));
    render(<SkillsPage />);
    await waitFor(() => expect(screen.getAllByTestId("skill-category-row").length).toBe(6));
    expect(rows()).toHaveLength(0);
    for (const row of screen.getAllByTestId("skill-category-row")) {
      expect(row).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("an opened category still renders at most one page window", async () => {
    answer(catalogue(4 * PAGE + 1, 0, 1));
    render(<SkillsPage />);
    await waitFor(() => expect(screen.getAllByTestId("skill-category-row").length).toBe(1));
    fireEvent.click(screen.getAllByTestId("skill-category-row")[0]);
    expect(rows()).toHaveLength(PAGE);
  });
});

describe("the subtitle carries what the strip carried", () => {
  it("total, active, categories and the profile, in one line", async () => {
    answer(catalogue(30, 5, 4));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(35));
    const header = screen.getByTestId("page-header");
    expect(header).toHaveTextContent(/35 skills/);
    expect(header).toHaveTextContent(/30 active/);
    expect(header).toHaveTextContent(/4 categories/);
    expect(header).toHaveTextContent(/Bob/);
  });
});

describe("what does not change", () => {
  it("search still replaces the view with matches across both sections, flat", async () => {
    answer(catalogue(30, 5, 4));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(35));
    const box = within(screen.getByTestId("skills-search")).getByRole("textbox");
    fireEvent.change(box, { target: { value: "skill-03" } });
    // 030..034 are the five inactive ones, and the only names that carry
    // "skill-03": five flat matches, drawn from the inactive section without a
    // category row between them.
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(screen.queryAllByTestId("skill-category-row")).toHaveLength(0);
  });

  it("the switch asks the API to flip the skill it is on", async () => {
    answer(catalogue(2, 1, 1));
    render(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    const inactive = rows().find((r) => r.getAttribute("data-skill") === "cat-00-skill-002")!;
    fireEvent.click(within(inactive).getByTestId("skill-toggle"));
    await waitFor(() => expect(apiFetch.mock.calls.some(([u]) => String(u).includes("/toggle"))).toBe(true));
    const call = apiFetch.mock.calls.find(([u]) => String(u).includes("/toggle"))!;
    expect(JSON.parse(String((call[1] as { body: string }).body))).toEqual({ profile: "default", enabled: true });
  });
});

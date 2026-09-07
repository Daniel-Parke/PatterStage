/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * T-0044 · The Skills page and its own stat tiles must agree.
 *
 * THE HOLE THIS CLOSES. tests/unit/skills-catalogue-restructure.test.tsx is a
 * thorough oracle for the restructure, and it mocks SkillsInsights away
 * ("StatStrip pulls the whole viz layer in; the insight tiles are not under
 * test"). That was a reasonable call for what THAT file measures. The cost is
 * that no test rendered the page and its tiles together, and the gap was not
 * theoretical: the same defect landed twice.
 *
 *   T-0037 widened the grouping key so that "Control Hub" and "control-hub"
 *   render as one row. SkillsInsights kept its own private `toLowerCase()`
 *   Set, so the page showed one category and the tile above it said two.
 *
 *   T-0042 was the same shape on /sessions: tiles computed from the 50-row
 *   page while the header counted the whole table.
 *
 * A number in a tile is a claim about the list underneath it. This file renders
 * the REAL SkillsInsights over the REAL page and holds the two to each other,
 * so a future change to either side has to keep them consistent or go red.
 *
 * The fixture deliberately mirrors the restructure oracle's: 178 skills over 12
 * categories, with every eleventh skill SHOUTING its category name, so the
 * case-folding path is exercised rather than assumed.
 */

import { render, screen, waitFor } from "@testing-library/react";

import type { Skill } from "@/types/console";

// ── Mocks: everything EXCEPT the subtitle, which is the point of the file ──
//
// Amended 2026-09-10 (U11, T-0125). The strip this file held to the page is
// gone: Active, Inactive and Total were the donut's own arcs and centre, and
// Categories was the one fact it carried. The SUBTITLE carries all four now,
// in one line, and it is the same claim about the same list, so it is held to
// the same standard here: the numbers are read off the DOM, never the props.

jest.mock("lucide-react", () => {
  const passthrough = (name: string) => () => `[${name}]`;
  return new Proxy({}, { get: (_t, prop: string) => passthrough(prop) });
});

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
  useProfiles: () => ({ data: [{ id: "default", name: "Bob", description: "" }], isLoading: false, error: null }),
}));

jest.mock("@/lib/operation-sync-action", () => ({
  __esModule: true,
  runSyncAction: jest.fn(),
}));

const apiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  __esModule: true,
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  toastError: jest.fn(),
  API_FETCH_BULK_TIMEOUT_MS: 300_000,
}));

import SkillsPage from "@/app/agent/skills/page";

// ── Fixture ─────────────────────────────────────────────────────────────────

const CATEGORY_COUNT = 12; // cat-00..cat-10 plus "wide"
const TOTAL = 178;
const ACTIVE = 118;

function makeCatalogue(): Skill[] {
  const skills: Skill[] = [];
  for (let i = 0; i < 118; i++) {
    const base = `cat-${String(i % 11).padStart(2, "0")}`;
    // Bucket 3 is spelled three ways that must all collapse to ONE category.
    //
    // The case variant alone is not enough to discriminate, which mutation
    // testing caught: a naive `new Set(c.toLowerCase())` folds case too, so a
    // fixture that only SHOUTS agrees with the buggy implementation and the
    // guard proves nothing. The SEPARATOR variant is the discriminator, because
    // the display normaliser also folds [-_]+ to spaces while toLowerCase does
    // not. That is exactly the T-0037 defect: "Control Hub" and "control-hub"
    // rendered one identical label out of two buckets.
    let category = base;
    if (i % 11 === 3) category = i % 22 === 3 ? base.toUpperCase() : base.replace("-", " ");
    skills.push({
      name: `${base}-skill-${String(i).padStart(3, "0")}`,
      category,
      description: `does ${base} things`,
      enabled: true,
    } as Skill);
  }
  for (let i = 1; i <= 60; i++) {
    skills.push({
      name: `wide-skill-${String(i).padStart(3, "0")}`,
      category: "wide",
      description: "a wide category skill",
      enabled: false,
    } as Skill);
  }
  return skills;
}

const CATALOGUE = makeCatalogue();

function categoriesOf(skills: Skill[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of skills) {
    const key = s.category.toLowerCase();
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((url: string) => {
    if (url.startsWith("/api/skills?")) {
      return Promise.resolve({
        data: {
          skills: CATALOGUE,
          categories: categoriesOf(CATALOGUE),
          total: CATALOGUE.length,
          categoryCount: Object.keys(categoriesOf(CATALOGUE)).length,
          profile: "default",
        },
      });
    }
    return Promise.resolve({ data: { content: "# the skill body" } });
  });
});

async function renderPage() {
  const view = render(<SkillsPage />);
  await waitFor(() =>
    expect(screen.getAllByTestId("skill-category-row").length).toBeGreaterThan(0),
  );
  return view;
}

/** The number the subtitle prints before `word`, read off the DOM. */
function subtitleNumber(word: string): number {
  const text = screen.getByTestId("page-header").textContent ?? "";
  const m = new RegExp(`(\\d[\\d,]*)\\s+${word}`).exec(text);
  if (!m) throw new Error(`no "<n> ${word}" in the subtitle: ${text}`);
  return Number(m[1].replace(/,/g, ""));
}

describe("the Skills subtitle agrees with the Skills page", () => {
  it("the category count is exactly the category rows the page renders", async () => {
    await renderPage();
    const rendered = screen.getAllByTestId("skill-category-row").length;
    expect(rendered).toBe(CATEGORY_COUNT);
    expect(subtitleNumber("categories")).toBe(rendered);
  });

  it("does not count a SHOUTED spelling as its own category", async () => {
    await renderPage();
    // cat-03 and CAT-03 are both present in the fixture. If either side stopped
    // folding case, this reads 13 on one side and 12 on the other.
    expect(subtitleNumber("categories")).toBe(CATEGORY_COUNT);
  });

  it("the total is the catalogue the page was given, and active is the enabled part of it", async () => {
    await renderPage();
    expect(subtitleNumber("skills")).toBe(TOTAL);
    expect(subtitleNumber("active")).toBe(ACTIVE);
  });

  it("paints the real numbers on the FIRST frame, with no ramp from zero", async () => {
    await renderPage();
    // No timer flush, no act() beyond the initial load: whatever is on screen
    // right now is what a human sees first.
    expect(subtitleNumber("skills")).toBe(TOTAL);
    expect(subtitleNumber("categories")).toBe(CATEGORY_COUNT);
  });
});

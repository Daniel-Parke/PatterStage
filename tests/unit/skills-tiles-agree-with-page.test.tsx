/** @jest-environment jsdom */

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

// ── Mocks: everything EXCEPT SkillsInsights, which is the point of the file ──

jest.mock("lucide-react", () => {
  const passthrough = (name: string) => () => `[${name}]`;
  return new Proxy({}, { get: (_t, prop: string) => passthrough(prop) });
});

jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/layout/PageHeader", () => ({
  __esModule: true,
  default: ({ subtitle }: { subtitle?: string }) => <div data-testid="page-header">{subtitle}</div>,
}));

jest.mock("@/components/ui/ProfileSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="profile-selector" />,
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

/**
 * The number rendered in the tile labelled `label`.
 *
 * Read from the DOM rather than from the component's props, because a tile that
 * computes correctly and paints something else is exactly the failure the stat
 * strip already had (T-0035: every tile painted 0 on first frame).
 */
function tileValue(label: string): number {
  const tiles = screen.getAllByTestId("stat-tile").filter(
    (t) => t.getAttribute("data-stat-label") === label,
  );
  if (tiles.length !== 1) throw new Error(`expected one "${label}" tile, found ${tiles.length}`);
  const digits = (tiles[0].textContent ?? "").replace(label, "").match(/\d[\d,]*/);
  if (!digits) throw new Error(`no number in the "${label}" tile: ${tiles[0].textContent}`);
  return Number(digits[0].replace(/,/g, ""));
}

describe("the Skills tiles agree with the Skills page", () => {
  it("the Categories tile counts exactly the category rows the page renders", async () => {
    await renderPage();
    const rendered = screen.getAllByTestId("skill-category-row").length;
    expect(rendered).toBe(CATEGORY_COUNT);
    expect(tileValue("Categories")).toBe(rendered);
  });

  it("does not count a SHOUTED spelling as its own category", async () => {
    await renderPage();
    // cat-03 and CAT-03 are both present in the fixture. If either side stopped
    // folding case, this reads 13 on one side and 12 on the other.
    expect(tileValue("Categories")).toBe(CATEGORY_COUNT);
  });

  it("the Total tile equals the catalogue the page was given", async () => {
    await renderPage();
    expect(tileValue("Total")).toBe(TOTAL);
  });

  it("Active and Inactive partition Total, which is what the hint claims", async () => {
    await renderPage();
    const total = tileValue("Total");
    const active = tileValue("Active");
    const inactive = tileValue("Inactive");
    expect(active).toBe(ACTIVE);
    // The Inactive tile's own hint reads "(Total − Active)". An arrangement
    // where those three numbers do not add up makes the hint a lie.
    expect(active + inactive).toBe(total);
  });

  it("paints the real numbers on the FIRST frame, with no ramp from zero", async () => {
    await renderPage();
    // No timer flush, no act() beyond the initial load: whatever is on screen
    // right now is what a human sees first. T-0035 fixed useCountUp seeding at
    // zero; this holds it fixed on the page a QA pass actually opened.
    expect(tileValue("Total")).toBe(TOTAL);
    expect(tileValue("Categories")).toBe(CATEGORY_COUNT);
  });
});

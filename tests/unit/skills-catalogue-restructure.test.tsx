/** @jest-environment jsdom */

/**
 * ACCEPTANCE ORACLE for T-0032, the Skills Manager restructure (tier R2).
 *
 * Frozen before the implementation existed. Every `it` below is one of the
 * invariants on the task record, and the file is the contract the restructure
 * is measured against, not a description of whatever the page ended up doing.
 *
 * The measured problem: 178 skills rendered unpaginated, 5,450 DOM nodes, 625
 * buttons, 35,218 characters of body text, seven times the next heaviest page.
 * The operator ruled a restructure rather than the cheap win.
 *
 *   INV-1  Search runs over the FULL catalogue and reveals matches that live
 *          inside collapsed categories and beyond the rendered page window.
 *          This is the trap in every list virtualisation: filter only the
 *          rendered window and the search box silently starts lying.
 *   INV-2  Categories are collapsed by default. The page opens as a scannable
 *          list of categories with counts, and renders no skill rows at all.
 *   INV-3  Rendered rows are bounded by one page, whatever the catalogue size,
 *          so DOM node count stops scaling with the catalogue.
 *   INV-4  Every existing action still works: enable/disable, View, Edit.
 *   INV-5  Nothing is lost. Category counts sum to the catalogue, and paging
 *          through a category visits every skill in it exactly once.
 *
 * The fixture is 178 skills over 12 categories, matching the measured shape:
 * a long tail of small categories plus one wide one that alone exceeds the
 * page window.
 */

import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";

// ── Icon mocks: lucide-react is a peer of every component here ──────────────
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
  default: ({ subtitle }: { subtitle?: string }) => (
    <div data-testid="page-header">{subtitle}</div>
  ),
}));

jest.mock("@/components/ui/ProfileSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="profile-selector" />,
}));

// StatStrip pulls the whole viz layer in; the insight tiles are not under test.
jest.mock("@/components/skills/SkillsInsights", () => ({
  __esModule: true,
  default: () => <div data-testid="skills-insights" />,
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
}));

import SkillsPage from "@/app/operations/skills/page";
import { pageSlice } from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

/**
 * The page window, asked of the module that owns it rather than restated here.
 * A second copy of "24" in the tests is a second place to change it, and the
 * one that gets forgotten is the one the gate was supposed to be watching.
 */
const PAGE = pageSlice(
  Array.from({ length: 1000 }, (_, i) => i),
  0,
).length;

// ── Fixture ────────────────────────────────────────────────────────────────

const NEEDLE = "zzz-needle-skill";
const SHARED = "sharedtoken";
/** The one active skill that shares a search token with the inactive needle. */
const ACTIVE_TWIN = "cat-00-skill-000";

/**
 * 118 active skills over 11 categories, plus 60 inactive ones in a single wide
 * category. 178 in total, 12 categories, one of which is 2.5 page windows deep.
 *
 * Two of the active skills spell their category in a different case. Grouping
 * is case-insensitive, so they must land in the SAME bucket as their siblings
 * and stay collapsed with them: the pre-restructure page seeded its collapse
 * map with the API's raw category keys while the grid looked its state up by
 * the title-cased display label, so no lookup ever matched and every category
 * rendered open. INV-2 is what catches that class of bug.
 */
function makeCatalogue(): Skill[] {
  const skills: Skill[] = [];
  for (let i = 0; i < 118; i++) {
    const base = `cat-${String(i % 11).padStart(2, "0")}`;
    const name = `${base}-skill-${String(i).padStart(3, "0")}`;
    skills.push({
      name,
      // Every eleventh skill SHOUTS its category. Same bucket, different case.
      category: i % 11 === 3 ? base.toUpperCase() : base,
      description: name === ACTIVE_TWIN ? `${SHARED} alpha` : `does ${base} things`,
      enabled: true,
    } as Skill);
  }
  // 001..059, not 000..058: the "wide-skill-05" case below is checking that a
  // search reaches ten rows that all sit past the first page window, and the
  // tenth of them is wide-skill-059. Numbering from 1 keeps the fixture 59
  // wide + 1 needle = 60, and the catalogue 178, while making that row exist.
  for (let i = 1; i <= 59; i++) {
    skills.push({
      name: `wide-skill-${String(i).padStart(3, "0")}`,
      category: "wide",
      description: "a wide category skill",
      enabled: false,
    } as Skill);
  }
  // Sorts last inside `wide`, so it only ever renders on the final page.
  skills.push({
    name: NEEDLE,
    category: "wide",
    description: `${SHARED} findable only by search`,
    enabled: false,
  } as Skill);
  return skills;
}

const CATALOGUE = makeCatalogue();
const WIDE_NAMES = CATALOGUE.filter((s) => s.category === "wide")
  .map((s) => s.name)
  .sort((a, b) => a.localeCompare(b));

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
    if (url.includes("/toggle")) return Promise.resolve({ data: { ok: true } });
    // Single-skill GET / PUT for View and Edit.
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

const cards = () => screen.queryAllByTestId("skill-card");
const cardNames = () =>
  cards().map((c) => c.getAttribute("data-skill") ?? "");

function categoryRow(label: string): HTMLElement {
  const row = screen
    .getAllByTestId("skill-category-row")
    .find((r) => (r.textContent ?? "").includes(label));
  if (!row) throw new Error(`no category row for ${label}`);
  return row;
}

/** Type into the one catalogue-wide search box. */
function search(term: string) {
  const box = within(screen.getByTestId("skills-search")).getByRole("textbox");
  fireEvent.change(box, { target: { value: term } });
}

// ── INV-2 · collapsed by default ───────────────────────────────────────────

describe("INV-2 the page opens as a list of categories, not a wall", () => {
  it("renders every category with its count and not one skill row", async () => {
    await renderPage();

    expect(cards()).toHaveLength(0);

    const rows = screen.getAllByTestId("skill-category-row");
    // 11 active categories + the one wide inactive category.
    expect(rows).toHaveLength(12);
    // Case variants collapsed into one bucket, so cat-00 keeps all 11 of its
    // skills rather than splitting into "cat-00" and "CAT-00".
    expect(categoryRow("Cat 00").textContent).toContain("11");
    expect(categoryRow("Wide").textContent).toContain("60");
  });

  it("keeps the whole catalogue reachable: counts sum to 178", async () => {
    await renderPage();

    const counts = screen
      .getAllByTestId("skill-category-row")
      .map((r) => Number(/\((\d+)\)/.exec(r.textContent ?? "")?.[1] ?? 0));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(178);
  });
});

// ── INV-3 · bounded render window ──────────────────────────────────────────

describe("INV-3 an expanded category renders at most one page", () => {
  it("shows one page window of a 60-skill category, not 60 rows", async () => {
    await renderPage();

    fireEvent.click(categoryRow("Wide"));

    expect(cards()).toHaveLength(PAGE);
    expect(screen.getByTestId("skill-page-status").textContent).toContain("60");
  });

  it("collapsing the category takes the rows back out of the DOM", async () => {
    await renderPage();

    fireEvent.click(categoryRow("Wide"));
    expect(cards()).toHaveLength(PAGE);

    fireEvent.click(categoryRow("Wide"));
    expect(cards()).toHaveLength(0);
  });
});

// ── INV-5 · nothing is lost to paging ──────────────────────────────────────

describe("INV-5 paging visits every skill in a category exactly once", () => {
  it("walks all 60 wide skills across its pages", async () => {
    await renderPage();
    fireEvent.click(categoryRow("Wide"));

    const seen: string[] = [];
    for (;;) {
      seen.push(...cardNames());
      const next = screen.getByTestId("skill-page-next") as HTMLButtonElement;
      if (next.disabled) break;
      fireEvent.click(next);
    }

    expect(seen).toHaveLength(60);
    expect([...seen].sort((a, b) => a.localeCompare(b))).toEqual(WIDE_NAMES);
    // The needle sorts last, so the final page is where it shows up.
    expect(cardNames()).toContain(NEEDLE);
  });
});

// ── INV-1 · search tells the truth ─────────────────────────────────────────

describe("INV-1 search runs over the whole catalogue", () => {
  it("finds a skill buried in a collapsed category on a later page", async () => {
    await renderPage();
    // Nothing expanded, nothing paged to: the needle is nowhere in the DOM.
    expect(cardNames()).not.toContain(NEEDLE);

    search("needle");

    expect(cardNames()).toContain(NEEDLE);
    expect(screen.getByTestId("skills-search-summary").textContent).toContain("1");
  });

  it("matches every skill outside the rendered window, not just the visible ones", async () => {
    await renderPage();

    // wide-skill-050 … 059 all live past the first page of a collapsed category.
    search("wide-skill-05");

    expect(cards()).toHaveLength(10);
    expect(cardNames()).toContain("wide-skill-059");
  });

  it("spans active and inactive skills from one box", async () => {
    await renderPage();

    search(SHARED);

    expect(cardNames().sort()).toEqual([ACTIVE_TWIN, NEEDLE].sort());
  });

  it("searches descriptions as well as names", async () => {
    await renderPage();

    search("findable only by search");

    expect(cardNames()).toEqual([NEEDLE]);
  });

  it("caps its own results at one page so a broad query cannot rebuild the wall", async () => {
    await renderPage();

    search("skill");

    expect(cards()).toHaveLength(PAGE);
    expect(screen.getByTestId("skills-search-summary").textContent).toContain("178");
  });

  it("clearing the box returns the page to the category list", async () => {
    await renderPage();

    search("needle");
    expect(cards().length).toBeGreaterThan(0);

    search("");
    expect(cards()).toHaveLength(0);
    expect(screen.getAllByTestId("skill-category-row")).toHaveLength(12);
  });
});

// ── INV-4 · the actions still work ─────────────────────────────────────────

describe("INV-4 every existing action survives the restructure", () => {
  const cardFor = (name: string) => {
    const el = document.querySelector(`[data-skill="${name}"]`);
    if (!el) throw new Error(`no card for ${name}`);
    return within(el as HTMLElement);
  };

  it("enabling an inactive skill asks the API to ENABLE it", async () => {
    await renderPage();
    search(SHARED);

    await act(async () => {
      fireEvent.click(cardFor(NEEDLE).getByTestId("skill-toggle"));
    });

    const call = apiFetch.mock.calls.find((c) => String(c[0]).includes("/toggle"));
    expect(call?.[0]).toBe(`/api/skills/${NEEDLE}/toggle`);
    expect(JSON.parse(String((call?.[1] as { body: string }).body))).toEqual({
      profile: "default",
      enabled: true,
    });
  });

  it("disabling an active skill asks the API to DISABLE it", async () => {
    await renderPage();
    search(SHARED);

    await act(async () => {
      fireEvent.click(cardFor(ACTIVE_TWIN).getByTestId("skill-toggle"));
    });

    const call = apiFetch.mock.calls.find((c) => String(c[0]).includes("/toggle"));
    expect(call?.[0]).toBe(`/api/skills/${ACTIVE_TWIN}/toggle`);
    expect(JSON.parse(String((call?.[1] as { body: string }).body))).toEqual({
      profile: "default",
      enabled: false,
    });
  });

  it("View loads the skill body and shows it inline", async () => {
    await renderPage();
    search("needle");

    await act(async () => {
      fireEvent.click(cardFor(NEEDLE).getByTestId("skill-view"));
    });

    await waitFor(() =>
      expect(cardFor(NEEDLE).getByText("# the skill body")).toBeInTheDocument(),
    );
  });

  it("Edit opens the editor loaded with the skill body", async () => {
    await renderPage();
    search("needle");

    await act(async () => {
      fireEvent.click(cardFor(NEEDLE).getByTestId("skill-edit"));
    });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /skill source/i })).toHaveValue(
        "# the skill body",
      ),
    );
  });

  it("toggling from inside an expanded category works the same way", async () => {
    await renderPage();
    fireEvent.click(categoryRow("Wide"));

    const first = cardNames()[0];
    await act(async () => {
      fireEvent.click(cardFor(first).getByTestId("skill-toggle"));
    });

    const call = apiFetch.mock.calls.find((c) => String(c[0]).includes("/toggle"));
    expect(call?.[0]).toBe(`/api/skills/${first}/toggle`);
    expect(JSON.parse(String((call?.[1] as { body: string }).body)).enabled).toBe(true);
  });
});

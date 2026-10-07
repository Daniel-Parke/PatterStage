/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// Three token totals on one page, and nothing saying what each one covers.
//
// THE DEFECT, found by driving the product against a real agent. Insights shows
// the headline "Tokens" tile (every run in the last 91 days, whatever started
// it), the tokens-by-model list (the selected 7/30/90 range, and only runs that
// belong to a mission) and a token figure under each top mission (completed
// runs of that mission, in the range). Three numbers that cannot agree, all
// labelled as though they were the same thing. An operator reading them has no
// way to tell which is which, so all three become untrustworthy.
//
// THE CONTRACT. Every token total on this page names its own period, and where
// its scope is narrower than the tile above it, the page says so. The numbers
// are already right; what was missing was the label that makes them mean
// something.
// ═══════════════════════════════════════════════════════════════

import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

import type { DashboardStats } from "@/lib/stats/stats-repository";
import type { InsightsBundle } from "@/lib/analytics/insights-bundle";
import type { AnalyticsSummary } from "@/lib/analytics/aggregates";

// ── Doubles ────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  usePathname: () => "/results/insights",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock("@/components/spend/SpendPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="spend-panel">$0.00</div>,
}));

jest.mock("@/components/motion", () => ({
  __esModule: true,
  FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stagger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Collapse: ({ children, open }: { children: ReactNode; open?: boolean }) => (open === false ? null : <div>{children}</div>),
}));

const mockUseStats = jest.fn();
jest.mock("@/hooks/useStats", () => ({ useStats: () => mockUseStats() }));

const mockUseAnalytics = jest.fn();
const mockUseAnalyticsTimeseries = jest.fn();
const mockUseInsights = jest.fn();
jest.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => mockUseAnalytics(),
  useAnalyticsTimeseries: (type: unknown, days: number) => mockUseAnalyticsTimeseries(type, days),
  useInsights: (days: number) => mockUseInsights(days),
}));

const mockUseSpend = jest.fn();
jest.mock("@/hooks/useSpend", () => ({ useSpend: () => mockUseSpend() }));

import InsightsPage from "@/app/results/insights/page";

// ── Fixtures ───────────────────────────────────────────────────

function buildStats(): DashboardStats {
  return {
    generatedAt: "2026-09-06T00:00:00.000Z",
    missions: { total: 12, successful: 8, failed: 2, dispatched: 1, queued: 1, draft: 0, successRate: 0.8 },
    runs: {
      total: 40, active: 1, completed: 35, failed: 3, cancelled: 1,
      totalTokens: 250_000, inputTokens: 150_000, outputTokens: 100_000, avgDurationSec: 42,
    },
    sessions: { total: 5, active: 1 },
    streak: { current: 3, longest: 5 },
    achievements: [],
    quests: { chapters: [], quests: [], completed: 0, total: 0, nextCompletedAt: {}, latchChanged: false, seeding: false },
    automations: { schedulesTotal: 0, schedulesEnabled: 0, scriptsTotal: 0, scriptsEnabled: 0, nextRun: null },
    stories: 0,
    errors24h: 0,
    agents: [],
    throughput: [],
    runActivity: [],
    tokensByDay: [],
  };
}

function buildInsights(days: number): InsightsBundle {
  return {
    days,
    activeDays: 9,
    hourOfDay: new Array(24).fill(0),
    categorySeries: [],
    categoryDaily: [],
    durationBuckets: [],
    modelUsage: [
      { model: "minimax-m2", provider: "minimax", runs: 5, inputTokens: 8_000, outputTokens: 4_300, totalTokens: 12_300, costUsd: 1.23 },
    ],
    topMissions: [{ missionId: "m1", name: "Nightly digest", runs: 3, totalTokens: 9_000 }],
    successTrend: [],
    generatedAt: "2026-09-06T00:00:00.000Z",
  };
}

const summary: AnalyticsSummary = {
  totals: { "mission.completed": 40 },
  last30: { "mission.completed": 12 },
  activeDays: 30,
  generatedAt: "2026-09-06T00:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseStats.mockReturnValue({ stats: buildStats(), isLoading: false, error: null, refetch: jest.fn() });
  mockUseAnalytics.mockReturnValue({ summary, isLoading: false, error: null, refetch: jest.fn() });
  mockUseAnalyticsTimeseries.mockReturnValue({ points: [], isLoading: false, error: null, refetch: jest.fn() });
  mockUseInsights.mockImplementation((days: number) => ({
    insights: buildInsights(days),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }));
  mockUseSpend.mockReturnValue({ spend: undefined, isLoading: false, error: null, saving: false, saveBudget: jest.fn() });
});

/** A tile's value sits in the sibling above its label. */
function tileValue(label: RegExp): string {
  return screen.getByText(label).previousElementSibling?.textContent?.trim() ?? "";
}

function cardFor(heading: RegExp): HTMLElement {
  const el = screen.getByRole("heading", { name: heading }).closest(".rounded-ps-lg");
  if (!el) throw new Error(`no card for ${heading}`);
  return el as HTMLElement;
}

describe("every token total on Insights names its period", () => {
  it("labels the headline tile with the window it actually sums", () => {
    render(<InsightsPage />);
    // 250,000 runs tokens over the 91 days the stats query reads, not all time
    // and not the 7/30/90 switch.
    expect(tileValue(/tokens \(91d\)/i)).toBe("250k");
  });

  it("no longer offers a bare, unscoped Tokens tile", () => {
    render(<InsightsPage />);
    expect(screen.queryByText("Tokens")).toBeNull();
  });

  it("says what the headline tile counts, so it can be told from the list below", () => {
    render(<InsightsPage />);
    const hint = screen.getByText(/tokens \(91d\)/i).closest("[title]");
    expect(hint?.getAttribute("title") ?? "").toMatch(/every run/i);
  });

  it("names the range in the tokens-by-model heading, and follows the switch", () => {
    render(<InsightsPage />);
    expect(cardFor(/tokens by model/i).textContent).toMatch(/last 30 days/i);
  });

  it("says the model list counts mission runs only, which is why it is smaller", () => {
    render(<InsightsPage />);
    const hint = within(cardFor(/tokens by model/i)).getByLabelText(/.+/);
    expect(hint.getAttribute("title") ?? "").toMatch(/mission/i);
  });

  it("says which runs the per-mission token figure came from", () => {
    render(<InsightsPage />);
    const hint = within(cardFor(/top missions/i)).getByLabelText(/.+/);
    expect(hint.getAttribute("title") ?? "").toMatch(/token/i);
  });
});

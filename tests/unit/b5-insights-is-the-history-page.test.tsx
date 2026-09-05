/** @jest-environment jsdom */

// B5 (T-0099) oracle, the Insights group: Insights is the history page. It
// holds four things the plan names. The "Active days" tile follows the 7/30/90
// switch, read off the window's bundle rather than the 30-day summary. There is
// one money number on the page and it lives in SpendPanel, so the model list
// shows tokens and nothing with a dollar sign. Retry retries every query the
// page reads, the timeseries included. And the mission mix the dashboard gave
// up has a card here, beside the trend and the heatmap it keeps.
//
// Written before the page changed. Every red below is a red on that contract.

import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { DashboardStats } from "@/lib/stats/stats-repository";
import type { Achievement } from "@/lib/stats/derive";
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
  FadeIn: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  Stagger: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  StaggerItem: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
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

// The wire, for the one describe that runs the REAL timeseries hook; every
// other export of api-fetch stays real and nothing else here fetches.
const mockSafeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...jest.requireActual("@/lib/api-fetch"),
  safeApiCall: (...a: unknown[]) => mockSafeApiCall(...a),
}));

import InsightsPage from "@/app/results/insights/page";

// ── Fixtures ───────────────────────────────────────────────────

const TIERS = ["common", "rare", "epic", "legendary"] as const;
const ICON_NAMES = ["Rocket", "Target", "Medal", "Flame", "Zap", "Coins"];

function achievement(i: number, unlocked: boolean): Achievement {
  const tier = TIERS[i % TIERS.length];
  return {
    id: `ach-${i}`,
    name: `Achievement ${i}`,
    description: `The ${i}th thing`,
    icon: ICON_NAMES[i % ICON_NAMES.length],
    color: "cyan",
    unlocked,
    progress: unlocked ? 1 : 0.25,
    current: unlocked ? 10 : 2,
    target: 10,
    tier,
    points: { common: 10, rare: 25, epic: 50, legendary: 100 }[tier],
  };
}

/** 36 achievements, the first 4 unlocked; missions 12 with 8 successful. */
function buildStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    generatedAt: "2026-09-05T00:00:00.000Z",
    missions: { total: 12, successful: 8, failed: 2, dispatched: 1, queued: 1, draft: 0, successRate: 0.8 },
    runs: {
      total: 40, active: 1, completed: 35, failed: 3, cancelled: 1,
      totalTokens: 250_000, inputTokens: 150_000, outputTokens: 100_000, avgDurationSec: 42,
    },
    sessions: { total: 5, active: 1 },
    streak: { current: 3, longest: 5 },
    achievements: Array.from({ length: 36 }, (_, i) => achievement(i, i < 4)),
    // B17 rides the same payload; Insights does not read it, so an empty
    // programme keeps the fixture honest about what this page uses.
    quests: { chapters: [], quests: [], completed: 0, total: 0, nextCompletedAt: {}, latchChanged: false, seeding: false },
    automations: { schedulesTotal: 2, schedulesEnabled: 1, scriptsTotal: 1, scriptsEnabled: 1, nextRun: null },
    stories: 0,
    errors24h: 0,
    agents: [],
    throughput: [],
    runActivity: [],
    tokensByDay: [],
    ...overrides,
  };
}

/** The window's bundle. activeDays is what B5 adds; 30 -> 9, 7 -> 4. */
function buildInsights(days: number): InsightsBundle & { activeDays: number } {
  return {
    days,
    activeDays: days === 7 ? 4 : 9,
    hourOfDay: new Array(24).fill(0),
    categorySeries: [],
    categoryDaily: [],
    durationBuckets: [],
    modelUsage: [
      { model: "claude-sonnet", provider: "anthropic", runs: 5, inputTokens: 8_000, outputTokens: 4_300, totalTokens: 12_300, costUsd: 1.23 },
      { model: "gpt-mini", provider: "openai", runs: 2, inputTokens: 500, outputTokens: 300, totalTokens: 800, costUsd: 0.05 },
    ],
    topMissions: [{ missionId: "m1", name: "Nightly digest", runs: 3, totalTokens: 9_000 }],
    successTrend: [],
    generatedAt: "2026-09-05T00:00:00.000Z",
  };
}

const summary: AnalyticsSummary = {
  totals: { "mission.completed": 40, "mission.failed": 4 },
  last30: { "mission.completed": 12 },
  activeDays: 30,
  generatedAt: "2026-09-05T00:00:00.000Z",
};

const refetchStats = jest.fn();
const refetchSummary = jest.fn();
const refetchInsights = jest.fn();
const refetchTimeseries = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseStats.mockReturnValue({ stats: buildStats(), isLoading: false, error: null, refetch: refetchStats });
  mockUseAnalytics.mockReturnValue({ summary, isLoading: false, error: null, refetch: refetchSummary });
  mockUseAnalyticsTimeseries.mockReturnValue({ points: [], isLoading: false, error: null, refetch: refetchTimeseries });
  mockUseInsights.mockImplementation((days: number) => ({
    insights: buildInsights(days),
    isLoading: false,
    error: null,
    refetch: refetchInsights,
  }));
  mockUseSpend.mockReturnValue({ spend: undefined, isLoading: false, error: null, saving: false, saveBudget: jest.fn() });
});

/** The MetricTile's value sits in the sibling above its label. */
function tileValue(label: RegExp): string {
  const labelEl = screen.getByText(label);
  return labelEl.previousElementSibling?.textContent?.trim() ?? "";
}

// ── (A) The Active days tile follows the range ─────────────────

describe("the Active days tile follows the range", () => {
  it("reads the 30d bundle's activeDays, not the summary's, before any click", () => {
    render(<InsightsPage />);
    expect(tileValue(/active days \(30d\)/i)).toBe("9");
  });

  it("shows the 7d bundle's activeDays after the 7d button, and asks useInsights for 7", () => {
    render(<InsightsPage />);
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(mockUseInsights).toHaveBeenCalledWith(7);
    expect(tileValue(/active days \(7d\)/i)).toBe("4");
  });
});

// ── (B) One money number ───────────────────────────────────────

describe("one money number", () => {
  it("has no dollar sign anywhere outside the spend panel", () => {
    const { container } = render(<InsightsPage />);
    const spendText = screen.getByTestId("spend-panel").textContent ?? "";
    expect(spendText).toContain("$");
    const pageText = (container.textContent ?? "").replace(spendText, "");
    expect(pageText).not.toContain("$");
  });

  it("lists tokens per model with no cost", () => {
    render(<InsightsPage />);
    const heading = screen.getByRole("heading", { name: /tokens by model/i });
    const card = heading.closest(".rounded-2xl") as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText("12.3k")).toBeInTheDocument();
    expect(within(card).getByText(/claude-sonnet/)).toBeInTheDocument();
    expect(card.textContent).not.toContain("$");
    expect(card.textContent).not.toMatch(/1\.23/);
  });

  it("the card's hint no longer promises an estimated cost", () => {
    render(<InsightsPage />);
    expect(screen.queryByLabelText(/estimated cost/i)).toBeNull();
    expect(screen.queryByTitle(/estimated cost/i)).toBeNull();
  });
});

// ── (C) Retry retries every query ──────────────────────────────

describe("retry retries every query", () => {
  it("calls the stats, summary, insights and timeseries refetches once each", () => {
    mockUseStats.mockReturnValue({ stats: undefined, isLoading: false, error: "Failed to load stats", refetch: refetchStats });
    render(<InsightsPage />);
    const alert = screen.getByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    expect(refetchStats).toHaveBeenCalledTimes(1);
    expect(refetchSummary).toHaveBeenCalledTimes(1);
    expect(refetchInsights).toHaveBeenCalledTimes(1);
    expect(refetchTimeseries).toHaveBeenCalledTimes(1);
  });

  it("GREEN CONTROL: the alert carries the stats error and a Retry", () => {
    mockUseStats.mockReturnValue({ stats: undefined, isLoading: false, error: "Failed to load stats", refetch: refetchStats });
    render(<InsightsPage />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to load stats");
    expect(within(alert).getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  // The page's Retry is only as good as the hook's refetch. A hook that handed
  // back a resolved promise and never touched the wire survived the sweep
  // (T-0099); this runs the real hook against a doubled wire.
  it("useAnalyticsTimeseries hands back a refetch that reads the wire again for the same window", async () => {
    const { useAnalyticsTimeseries: real } =
      jest.requireActual<typeof import("@/hooks/useAnalytics")>("@/hooks/useAnalytics");
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { timeseries: [{ date: "2026-09-05", value: 1 }] } } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => real(undefined, 7), { wrapper });
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockSafeApiCall).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockSafeApiCall).toHaveBeenCalledTimes(2);
    expect(String(mockSafeApiCall.mock.calls[1][0])).toContain("days=7");
  });
});

// ── (D) The mission mix has a card here ────────────────────────

describe("the mission mix", () => {
  it("has a card with the five statuses and the mission total", () => {
    render(<InsightsPage />);
    const heading = screen.getByRole("heading", { name: /mission mix/i });
    const card = heading.closest(".rounded-2xl") as HTMLElement;
    expect(card).not.toBeNull();
    for (const word of ["Successful", "Failed", "Dispatched", "Queued", "Draft"]) {
      expect(within(card).getByText(new RegExp(`\\b${word}\\b`))).toBeInTheDocument();
    }
    expect(within(card).getAllByText(/\b12\b/).length).toBeGreaterThanOrEqual(1);
  });

  it("GREEN CONTROL: the success trend and the run heatmap are still here", () => {
    render(<InsightsPage />);
    expect(screen.getByRole("heading", { name: /mission success trend/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /run activity/i })).toBeInTheDocument();
  });
});

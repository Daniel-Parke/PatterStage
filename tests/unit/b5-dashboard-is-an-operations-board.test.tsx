/** @jest-environment jsdom */

// B5 (T-0099) oracle, the dashboard group: the render half. The dashboard is
// an operations board, not a trophy cabinet. It answers six questions in a
// row of pills (gateway, memory, scheduler, spend, processes, errors), each a
// link to the surface that answers it in full, and it says so honestly: a
// monitor that has not answered shows skeletons, a monitor that FAILED shows
// an alert with a Retry rather than skeletons forever, and a subsystem that
// has not been checked reads "Checking…", never a green "Healthy" on a panel
// nobody has read. Below the pills sits one Progress line (streak, level,
// achievements, next automation, Quests); the clock, the Rec Room card and
// the Command Center are gone. The data hook now exposes the monitor and
// subsystems queries' error and settled state so the page can tell "not yet"
// from "failed", and the first-run checklist waits for both before it speaks.
//
// The source-shape half of this oracle is b5-dashboard-source-shape.test.ts.

import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { UseDashboardResult } from "@/hooks/useDashboard";
import type { AgentExperienceEntry } from "@/hooks/useAgentExperience";
import type { DashboardStats } from "@/lib/stats/stats-repository";
import type { SpendSummary } from "@/lib/spend/spend-summary";
import type { SubsystemSummary } from "@/lib/status/subsystems";
import type { MonitorData } from "@/types/console";
import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

// ── Module doubles ───────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Entrance animations are not the subject; plain boxes keep jsdom out of
// motion's way. Collapse still honours `open` so a collapsed grid stays hidden.
jest.mock("@/components/motion", () => ({
  FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stagger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Collapse: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
}));
jest.mock("@/components/dashboard/DispatchStrip", () => ({
  __esModule: true,
  default: () => <div data-testid="dispatch-strip" />,
}));
jest.mock("@/modules/hermes/components/PlatformsPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="platforms-panel" />,
}));

const mockUseDashboard = jest.fn();
const mockUseStats = jest.fn();
const mockUseAgentExperience = jest.fn();
const mockUseSpend = jest.fn();
jest.mock("@/hooks/useDashboard", () => ({ useDashboard: () => mockUseDashboard() }));
jest.mock("@/hooks/useStats", () => ({ useStats: () => mockUseStats() }));
jest.mock("@/hooks/useAgentExperience", () => ({ useAgentExperience: () => mockUseAgentExperience() }));
jest.mock("@/hooks/useSpend", () => ({ useSpend: () => mockUseSpend() }));

// The wire, for the one describe that runs the REAL useDashboard (A). Every
// other export of api-fetch stays real: the page imports toastError and the
// mutation helpers import safeApiCall, and none of them are called here.
const mockSafeApiCall = jest.fn();
const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...jest.requireActual("@/lib/api-fetch"),
  safeApiCall: (...a: unknown[]) => mockSafeApiCall(...a),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));
jest.mock("@/lib/dashboard/dashboard-initial-load", () => ({
  loadInitialDashboardData: jest.fn(async () => ({
    dashboardData: { status: null, config: null, templates: [], categories: [], monitor: null, processes: [], missions: [] },
    modelsDefaults: null,
  })),
}));

import Dashboard from "@/app/page";

// ── Fixtures ─────────────────────────────────────────────────────

const NOW_ISO = "2026-09-05T10:00:00.000Z";

const SUBSYSTEMS: SubsystemSummary = {
  checkedAt: NOW_ISO,
  subsystems: [
    { id: "gateway", label: "Gateway", state: "ok", reason: "reachable at http://127.0.0.1:8642", url: "http://127.0.0.1:8642" },
    { id: "memory", label: "Memory", state: "degraded", reason: "sqlite: not available" },
    { id: "sync", label: "Sync", state: "ok", reason: "last cycle clean" },
    { id: "config", label: "config.yaml", state: "ok", reason: "present and parses" },
    { id: "gate", label: "Gateway gate", state: "ok", reason: "3 admitted, 0 refused" },
  ],
};

function subsystemsWith(gateway: "ok" | "degraded" | "down", memory: "ok" | "degraded" | "down" = "degraded"): SubsystemSummary {
  return {
    ...SUBSYSTEMS,
    subsystems: SUBSYSTEMS.subsystems.map((row) =>
      row.id === "gateway" ? { ...row, state: gateway } : row.id === "memory" ? { ...row, state: memory } : row,
    ),
  };
}

function monitor(over: Partial<MonitorData> = {}): MonitorData {
  return {
    sessions: { total: 4, recent: [{ id: "session-1", modified: new Date(Date.now() - 60_000).toISOString(), size: 10 }] },
    gateway: { platforms: {}, connectedCount: 0 },
    memory: { factCount: 12, dbSize: "1 MB", provider: "sqlite" },
    errors: [
      { source: "gateway", message: "connection refused", timestamp: "2026-09-05 09:58:00", severity: "error" },
      { source: "sync", message: "skills source failed", timestamp: "2026-09-05 09:57:00", severity: "error" },
      { source: "config", message: "unknown key", timestamp: "2026-09-05 09:56:00", severity: "warning" },
    ],
    system: { uptime: "1h", configPresent: true, soulPresent: true, configYamlError: null },
    sync: { lastRun: null, allSuccessful: true, sourceStatuses: {}, sourceErrors: {} },
    scheduler: {
      ownerPid: 4242,
      lastTickAt: new Date(Date.now() - 5_000).toISOString(),
      stale: false,
      staleAfterMs: 60_000,
      selfPid: 4242,
    },
    framework: { type: "hermes", name: "Hermes", available: true },
    ...over,
  };
}

/** The B5 fields the hook gains; typed here because the source has not yet. */
interface B5DashboardFields {
  monitorError: string | null;
  monitorSettled: boolean;
  subsystemsError: string | null;
  subsystemsSettled: boolean;
}
type DashResult = UseDashboardResult & B5DashboardFields;

function dash(over: Partial<DashResult> = {}): DashResult {
  return {
    status: { soulFile: true, configFile: true, skillsCount: 0, sessionsCount: 4, memorySize: "1 MB", timestamp: NOW_ISO },
    monitor: monitor(),
    processes: [],
    missions: [],
    config: { model: { default: "gpt-4o", provider: "openai" } },
    templates: [],
    categories: [],
    registryAgentModelLabel: null,
    sessionTrend: [],
    subsystems: SUBSYSTEMS,
    ready: true,
    refetchMonitor: jest.fn(async () => undefined),
    refetchMissions: jest.fn(async () => undefined),
    refetchProcesses: jest.fn(async () => undefined),
    monitorError: null,
    monitorSettled: true,
    subsystemsError: null,
    subsystemsSettled: true,
    ...over,
  };
}

function achievements(total: number, unlocked: number): DashboardStats["achievements"] {
  return Array.from({ length: total }, (_, i) => ({
    id: `ach-${i}`,
    name: `Achievement ${i}`,
    description: "earned by doing the thing",
    icon: "trophy",
    color: "cyan",
    unlocked: i < unlocked,
    progress: i < unlocked ? 1 : 0.25,
    current: i < unlocked ? 1 : 0,
    target: 1,
    tier: "common" as DashboardStats["achievements"][number]["tier"],
    points: 10,
  }));
}

function stats(over: Partial<DashboardStats> = {}): DashboardStats {
  return {
    generatedAt: NOW_ISO,
    missions: { total: 10, queued: 1, draft: 1, dispatched: 1, successful: 6, failed: 1, successRate: 0.6 },
    runs: { total: 12, active: 1, completed: 10, failed: 1, cancelled: 0, totalTokens: 12_345, inputTokens: 10_000, outputTokens: 2_345, avgDurationSec: 42 },
    sessions: { total: 4, active: 0 },
    automations: {
      schedulesTotal: 2,
      schedulesEnabled: 1,
      scriptsTotal: 1,
      scriptsEnabled: 1,
      nextRun: { name: "Nightly digest", at: "2026-09-06 02:00:00", kind: "mission" },
    },
    stories: 0,
    errors24h: 3,
    streak: { current: 3, longest: 5 },
    achievements: achievements(36, 4),
    agents: [],
    throughput: [
      { date: "2026-09-04", completed: 2, failed: 0 },
      { date: "2026-09-05", completed: 3, failed: 1 },
    ],
    runActivity: [
      { date: "2026-09-04", value: 2 },
      { date: "2026-09-05", value: 4 },
    ],
    tokensByDay: [
      { date: "2026-09-04", value: 1000 },
      { date: "2026-09-05", value: 2000 },
    ],
    ...over,
  };
}

const TOP_AGENT: AgentExperienceEntry = {
  rank: 1,
  targetRef: "profile:scout",
  targetLabel: "Scout",
  experience: {
    slug: "scout",
    xp: 120,
    level: { level: 3, title: "Apprentice", progress: 0.4 },
    signals: { runsCompleted: 10, totalTokens: 12_345, activeDays: 3, skillsEnabled: 2, toolsetCount: 1, memoryFacts: 12 },
  },
};

const SPEND: SpendSummary = {
  periods: [
    { period: "day", label: "Today", since: "2026-09-05 00:00:00", totalUsd: 0.1, sources: [], unrecordedResearchRuns: 0 },
    { period: "week", label: "This week", since: "2026-08-31 00:00:00", totalUsd: 0.5, sources: [], unrecordedResearchRuns: 0 },
    { period: "month", label: "This month", since: "2026-09-01 00:00:00", totalUsd: 1.25, sources: [], unrecordedResearchRuns: 0 },
  ],
  policy: UNSET_SPEND_POLICY,
  budgetPeriod: "month",
  budgetSpentUsd: 1.25,
  verdict: { state: "unset", fraction: null, breached: false, blocksUnattended: false, message: null },
  unmeasured: [],
  generatedAt: NOW_ISO,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboard.mockReturnValue(dash());
  mockUseStats.mockReturnValue({ stats: stats(), isLoading: false, error: null, refetch: jest.fn() });
  mockUseAgentExperience.mockReturnValue({ entries: [TOP_AGENT], isLoading: false, error: null, refetch: jest.fn() });
  mockUseSpend.mockReturnValue({ spend: SPEND, isLoading: false, error: null, saving: false, saveBudget: jest.fn() });
});

// ── Helpers ──────────────────────────────────────────────────────

// A bare clock is an element whose OWN text is nothing but hh:mm:ss. Testing
// Library's text matcher reads own text nodes, so "checked 11:00:00" in the
// subsystems panel and "gateway · 2026-09-05 09:58:00" in an error row do not
// match, while today's <div>08:31:02</div> does. Anchored, so it holds whatever
// the header's markup becomes.
const BARE_CLOCK = /^\d{1,2}:\d{2}:\d{2}$/;

/** An element's own text nodes, joined and trimmed (what getByText matches on). */
function ownText(el: Element | null): string {
  if (!el) return "";
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? "")
    .join("")
    .trim();
}

/** A StatPill, found by its label (uppercase via CSS, so matched case-blind). */
function pill(label: string) {
  const labelEl = screen.getByText(new RegExp(`^${label}$`, "i"), { selector: "div.uppercase" });
  const value = labelEl.nextElementSibling?.textContent?.trim() ?? null;
  const subtitle = labelEl.nextElementSibling?.nextElementSibling?.textContent?.trim() ?? null;
  const link = labelEl.closest("a");
  return { labelEl, value, subtitle, href: link?.getAttribute("href") ?? null };
}

function lowestCommonAncestor(a: Element, b: Element): Element {
  let cur: Element | null = a;
  while (cur && !cur.contains(b)) cur = cur.parentElement;
  if (!cur) throw new Error("no common ancestor");
  return cur;
}

/**
 * Every StatPill label in the stat ROW, in document order, lower-cased. The
 * row is the lowest ancestor shared by two pills that exist before and after
 * B5 (Processes and Scheduler), so a label the Progress line might carry in
 * the same typographic style is never counted as a pill.
 */
function pillLabels(): string[] {
  const row = lowestCommonAncestor(pill("Processes").labelEl, pill("Scheduler").labelEl);
  return Array.from(row.querySelectorAll("div.font-mono.uppercase.truncate")).map((el) =>
    (el.textContent ?? "").trim().toLowerCase(),
  );
}

function isBefore(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** The two anchors the Progress line sits between: the stat row and "Continue work". */
function progressAnchors() {
  const statRow = pill("Processes").labelEl;
  const continueWork = screen.getByText("Continue work");
  return { statRow, continueWork };
}

function expectInProgressLine(el: Element) {
  const { statRow, continueWork } = progressAnchors();
  expect(isBefore(statRow, el)).toBe(true);
  expect(isBefore(el, continueWork)).toBe(true);
}

function linksTo(href: string): HTMLAnchorElement[] {
  return screen.getAllByRole("link").filter((a) => a.getAttribute("href") === href) as HTMLAnchorElement[];
}

// ═══════════════════════════════════════════════════════════════
// (A) useDashboard says whether the monitor and subsystems have answered
// ═══════════════════════════════════════════════════════════════

describe("A. useDashboard exposes the monitor and subsystems queries' error and settled state", () => {
  const { useDashboard: realUseDashboard } =
    jest.requireActual<typeof import("@/hooks/useDashboard")>("@/hooks/useDashboard");

  function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };
  }

  // Both wire helpers are routed by path, so the failure lands whichever
  // helper fetchMonitor ends up calling: safeApiCallData answers null (today's
  // plumbing throws "Failed to load monitor" on it) and safeApiCall answers
  // { ok: false, error: "Failed to load monitor" } (the plumbing that would
  // carry the server's own message).
  function wire(over: { monitor?: () => Promise<unknown>; subsystems?: () => Promise<unknown> } = {}) {
    mockSafeApiCall.mockImplementation(async (path: string) =>
      path.startsWith("/api/monitor") && over.monitor
        ? { ok: false, error: "Failed to load monitor" }
        : { ok: true, data: { data: { processes: [], missions: [] } } },
    );
    mockSafeApiCallData.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/monitor")) return over.monitor ? over.monitor() : monitor();
      if (path.startsWith("/api/status/subsystems")) return over.subsystems ? over.subsystems() : SUBSYSTEMS;
      return { timeseries: [] };
    });
  }

  it("starts unsettled, then settles with no error once the monitor answers", async () => {
    wire();
    const { result } = renderHook(() => realUseDashboard() as DashResult, { wrapper: wrapper() });
    expect(result.current.monitorSettled).toBe(false);
    expect(result.current.subsystemsSettled).toBe(false);
    await waitFor(() => expect(result.current.monitor).not.toBeNull());
    await waitFor(() => expect(result.current.monitorSettled).toBe(true));
    expect(result.current.monitorError).toBeNull();
    await waitFor(() => expect(result.current.subsystemsSettled).toBe(true));
    expect(result.current.subsystemsError).toBeNull();
    expect(result.current.subsystems).toEqual(SUBSYSTEMS);
  });

  it("carries the monitor query's failure as monitorError, settled, with monitor null", async () => {
    // safeApiCallData answers null for a failed read; fetchMonitor throws on it.
    wire({ monitor: async () => null });
    const { result } = renderHook(() => realUseDashboard() as DashResult, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.monitorError).toBe("Failed to load monitor"));
    expect(result.current.monitorSettled).toBe(true);
    expect(result.current.monitor).toBeNull();
  });

  it("carries the subsystems query's failure as subsystemsError, settled, with subsystems null", async () => {
    wire({ subsystems: async () => { throw new Error("subsystems unreachable"); } });
    const { result } = renderHook(() => realUseDashboard() as DashResult, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.subsystemsError).toBe("subsystems unreachable"));
    expect(result.current.subsystemsSettled).toBe(true);
    expect(result.current.subsystems).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) The header keeps its identity and loses its clock
// ═══════════════════════════════════════════════════════════════

describe("B. the header", () => {
  it("GREEN CONTROL: names the agent, the model and says ONLINE", () => {
    render(<Dashboard />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hermes");
    expect(screen.getByText("gpt-4o · openai")).toBeInTheDocument();
    expect(screen.getByText("ONLINE")).toBeInTheDocument();
  });

  it("GREEN CONTROL: says NOT INSTALLED when there is no agent and no reachable gateway", () => {
    mockUseDashboard.mockReturnValue(
      dash({ monitor: monitor({ framework: { type: "hermes", name: "Hermes", available: false } }), subsystems: subsystemsWith("down") }),
    );
    render(<Dashboard />);
    expect(screen.getByText("NOT INSTALLED")).toBeInTheDocument();
  });

  it("has no live clock anywhere on the page", () => {
    render(<Dashboard />);
    expect(screen.queryAllByText(BARE_CLOCK)).toHaveLength(0);
  });

  it("registers no one-second interval", () => {
    const spy = jest.spyOn(globalThis, "setInterval");
    render(<Dashboard />);
    const ticks = spy.mock.calls.map((c) => c[1]);
    expect(ticks).not.toContain(1000);
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) Six pills, six questions, six links
// ═══════════════════════════════════════════════════════════════

describe("C. the stat row", () => {
  it("has exactly six pills, in order: Gateway, Memory, Scheduler, Spend, Processes, Errors", () => {
    render(<Dashboard />);
    expect(pillLabels()).toEqual(["gateway", "memory", "scheduler", "spend", "processes", "errors"]);
  });

  it("has no Sessions pill", () => {
    render(<Dashboard />);
    expect(screen.queryByText(/^sessions$/i, { selector: "div.uppercase" })).toBeNull();
  });

  it("Gateway reads the subsystem row's state in the status vocabulary and links to Settings > System", () => {
    const first = render(<Dashboard />);
    expect(pill("Gateway").value).toBe("Healthy");
    expect(pill("Gateway").href).toBe("/agent/settings/system");
    first.unmount();

    mockUseDashboard.mockReturnValue(dash({ subsystems: subsystemsWith("degraded") }));
    const second = render(<Dashboard />);
    expect(pill("Gateway").value).toBe("Degraded");
    second.unmount();

    mockUseDashboard.mockReturnValue(dash({ subsystems: subsystemsWith("down") }));
    render(<Dashboard />);
    expect(pill("Gateway").value).toBe("Not running");
  });

  it("Memory reads the memory row's state, counts the facts underneath, and links to Memory", () => {
    render(<Dashboard />);
    const memory = pill("Memory");
    expect(memory.value).toBe("Degraded");
    expect(memory.subtitle).toMatch(/12 facts/);
    expect(memory.href).toBe("/agent/memory");
  });

  it("Memory reads Healthy when the memory row is ok", () => {
    mockUseDashboard.mockReturnValue(dash({ subsystems: subsystemsWith("ok", "ok") }));
    render(<Dashboard />);
    expect(pill("Memory").value).toBe("Healthy");
  });

  it("Scheduler reads the heartbeat and links to Settings > System", () => {
    render(<Dashboard />);
    const scheduler = pill("Scheduler");
    expect(scheduler.value).toBe("Ticking");
    expect(scheduler.href).toBe("/agent/settings/system");
  });

  it("Spend reads this month's total from useSpend, formatted the one way, and links to Insights", () => {
    render(<Dashboard />);
    const spend = pill("Spend");
    expect(spend.value).toBe("$1.25");
    expect(spend.subtitle).toBe("this month");
    expect(spend.href).toBe("/results/insights");
  });

  it("Spend reads a dash, not a zero, while the summary has not arrived", () => {
    mockUseSpend.mockReturnValue({ spend: undefined, isLoading: true, error: null, saving: false, saveBudget: jest.fn() });
    render(<Dashboard />);
    expect(pill("Spend").value).toBe("—");
    expect(screen.queryByText("$0.00")).toBeNull();
  });

  it("GREEN CONTROL: Processes reads Idle, or counts the running ones, and links to Agents", () => {
    const first = render(<Dashboard />);
    expect(pill("Processes").value).toBe("Idle");
    expect(pill("Processes").href).toBe("/agent/profiles");
    first.unmount();

    const proc = (id: string, status: "running" | "idle") => ({
      id, type: "manual" as const, name: id, status, startedAt: null, lastActivity: null, model: "unknown", pid: null, turns: 0,
    });
    mockUseDashboard.mockReturnValue(dash({ processes: [proc("a", "running"), proc("b", "running"), proc("c", "idle")] }));
    render(<Dashboard />);
    expect(pill("Processes").value).toBe("2 Active");
  });

  it("Errors counts the monitor's error rows and links to Logs", () => {
    render(<Dashboard />);
    const errors = pill("Errors");
    expect(errors.value).toBe("3");
    expect(errors.href).toBe("/results/logs");
  });

  it("reads Checking… on Gateway and Memory while the subsystems have not answered, never Healthy", () => {
    mockUseDashboard.mockReturnValue(dash({ subsystems: null, subsystemsError: null, subsystemsSettled: false }));
    render(<Dashboard />);
    expect(pill("Gateway").value).toMatch(/checking/i);
    expect(pill("Memory").value).toMatch(/checking/i);
    expect(screen.queryByText("Healthy")).toBeNull();
  });

  it("reads Unknown on Gateway and Memory when the subsystems check failed", () => {
    mockUseDashboard.mockReturnValue(
      dash({ subsystems: null, subsystemsError: "subsystems unreachable", subsystemsSettled: true }),
    );
    render(<Dashboard />);
    expect(pill("Gateway").value).toBe("Unknown");
    expect(pill("Memory").value).toBe("Unknown");
    expect(screen.queryByText("Healthy")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (D) The monitor: not yet, failed, or here
// ═══════════════════════════════════════════════════════════════

describe("D. the monitor's three states", () => {
  it("shows six skeletons and no alert while the monitor has not answered", () => {
    mockUseDashboard.mockReturnValue(dash({ monitor: null, monitorError: null, monitorSettled: false }));
    const { container } = render(<Dashboard />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(6);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an alert with a Retry, and no skeleton and nothing green, when the monitor failed", () => {
    const refetchMonitor = jest.fn(async () => undefined);
    mockUseDashboard.mockReturnValue(
      dash({ monitor: null, monitorError: "Failed to load monitor", monitorSettled: true, refetchMonitor }),
    );
    const { container } = render(<Dashboard />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read monitor data");
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    expect(screen.queryByText("Healthy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchMonitor).toHaveBeenCalledTimes(1);
  });

  it("shows the pills, and no skeleton and no alert, once the monitor is here", () => {
    const { container } = render(<Dashboard />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(pill("Gateway").value).toBe("Healthy");
    expect(pill("Errors").value).toBe("3");
  });
});

// ═══════════════════════════════════════════════════════════════
// (E) One Progress line, between the pills and "Continue work"
// ═══════════════════════════════════════════════════════════════

describe("E. the Progress line", () => {
  it("shows the streak: 3 days, best 5", () => {
    render(<Dashboard />);
    const best = screen.getByText("best 5");
    expectInProgressLine(best);
    const flame = best.parentElement!;
    expect(flame.textContent).toMatch(/3/);
    expect(flame.textContent).toMatch(/days/);
  });

  it("shows the top agent's level badge inside a link to Agents", () => {
    render(<Dashboard />);
    const badgeLinks = linksTo("/agent/profiles").filter((a) => /Scout/.test(a.textContent ?? ""));
    expect(badgeLinks).toHaveLength(1);
    expectInProgressLine(badgeLinks[0]);
    expect(badgeLinks[0]).toHaveTextContent("Apprentice");
  });

  it("shows Achievements 4/36 inside a link to Insights", () => {
    render(<Dashboard />);
    const link = linksTo("/results/insights").find((a) => /achievements/i.test(a.textContent ?? ""));
    expect(link).toBeDefined();
    expect(link!).toHaveTextContent("4/36");
    expectInProgressLine(link!);
  });

  it("names the next automation", () => {
    render(<Dashboard />);
    // The contract says "Next automation" followed by the name; whether the
    // name sits in the same element or its own is the implementer's call.
    const label = screen.getByText((_, el) => /^Next automation/.test(ownText(el)));
    const name = screen.getByText(/Nightly digest/);
    expectInProgressLine(label);
    expectInProgressLine(name);
    if (name === label) {
      expect(ownText(label)).toMatch(/^Next automation.*Nightly digest/s);
    } else {
      expect(isBefore(label, name)).toBe(true);
    }
  });

  it("says so when no automation is scheduled", () => {
    mockUseStats.mockReturnValue({
      stats: stats({ automations: { schedulesTotal: 0, schedulesEnabled: 0, scriptsTotal: 0, scriptsEnabled: 0, nextRun: null } }),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<Dashboard />);
    const none = screen.getByText(/No automation scheduled/);
    expectInProgressLine(none);
  });

  it("links to Quests", () => {
    render(<Dashboard />);
    const quests = screen.getByRole("link", { name: /quests/i });
    expect(quests).toHaveAttribute("href", "/quests");
    expectInProgressLine(quests);
  });

  it("shows an alert with a Retry that re-reads the stats when they could not be read", () => {
    const refetch = jest.fn(async () => undefined);
    // The real hook hands the page `null` on failure (useApiResource yields
    // query.data ?? null), never undefined; the page must treat null as absent.
    mockUseStats.mockReturnValue({ stats: null, isLoading: false, error: "Failed to load stats", refetch });
    render(<Dashboard />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read stats");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// (F) What left
// ═══════════════════════════════════════════════════════════════

describe("F. what the dashboard no longer carries", () => {
  it("has no Rec Room card", () => {
    render(<Dashboard />);
    expect(screen.queryByText(/Rec Room/)).toBeNull();
    expect(linksTo("/recroom/story-weaver")).toHaveLength(0);
  });

  it("has no Command Center", () => {
    const { container } = render(<Dashboard />);
    const text = container.textContent ?? "";
    for (const gone of ["Mission throughput", "Mission mix", "Vitals", "Run activity", "Active Runs"]) {
      expect(text).not.toContain(gone);
    }
  });

  it("has no achievement showcase", () => {
    render(<Dashboard />);
    expect(screen.queryByText(/Show all/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (G) The first-run checklist waits for both answers
// ═══════════════════════════════════════════════════════════════

describe("G. the first-run checklist", () => {
  const fresh = () =>
    monitor({
      framework: { type: "hermes", name: "Hermes", available: false },
      sessions: { total: 0, recent: [] },
      errors: [],
    });

  it("does not speak while the monitor has not settled", () => {
    mockUseDashboard.mockReturnValue(
      dash({ monitor: null, monitorSettled: false, missions: [], subsystems: subsystemsWith("down"), subsystemsSettled: true }),
    );
    render(<Dashboard />);
    expect(screen.queryByText("Start here")).toBeNull();
  });

  it("does not speak while the subsystems have not settled", () => {
    mockUseDashboard.mockReturnValue(
      dash({ monitor: fresh(), monitorSettled: true, missions: [], subsystems: null, subsystemsSettled: false }),
    );
    render(<Dashboard />);
    expect(screen.queryByText("Start here")).toBeNull();
  });

  it("GREEN CONTROL: speaks once both have settled and the install is fresh", () => {
    mockUseDashboard.mockReturnValue(
      dash({ monitor: fresh(), monitorSettled: true, missions: [], subsystems: subsystemsWith("down"), subsystemsSettled: true }),
    );
    render(<Dashboard />);
    expect(screen.getByText("Start here")).toBeInTheDocument();
  });
});

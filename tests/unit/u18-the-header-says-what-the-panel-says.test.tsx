/**
 * U18 · The header says what the panel says.
 *
 * The dashboard's header carried a green dot reading ONLINE while the
 * Subsystems panel's first row read "Gateway · Not running". Both were true
 * (the dot was PatterStage's own server; the row is the agent's gateway),
 * and beside each other they contradict (the UI review of 2026-09-08, P2).
 * A fact is said once, where it is best said (T-0127): the header's badge
 * now carries the gateway row's own word and tone, "Gateway · Healthy",
 * "Gateway · Degraded" or "Gateway · Not running", with the row's reason as
 * its tooltip, so the two places cannot disagree. NOT INSTALLED stays for the
 * install with no agent and no reachable gateway, because that is a different
 * fact and the one a first run needs.
 */

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

import type { UseDashboardResult } from "@/hooks/useDashboard";
import type { SubsystemState, SubsystemSummary } from "@/lib/status/subsystems";
import type { MonitorData } from "@/types/console";

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
jest.mock("@/components/motion", () => ({
  FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stagger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Collapse: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
}));
jest.mock("@/components/dashboard/DispatchStrip", () => ({ __esModule: true, default: () => <div /> }));
jest.mock("@/modules/hermes/components/PlatformsPanel", () => ({ __esModule: true, default: () => <div /> }));

const mockUseDashboard = jest.fn();
jest.mock("@/hooks/useDashboard", () => ({ useDashboard: () => mockUseDashboard() }));
jest.mock("@/hooks/useStats", () => ({
  useStats: () => ({ stats: null, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useAgentExperience", () => ({
  useAgentExperience: () => ({ entries: [], isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useSpend", () => ({
  useSpend: () => ({ spend: null, isLoading: false, error: null, saving: false, saveBudget: jest.fn() }),
}));
jest.mock("@/hooks/useQuestHost", () => ({
  useQuestHost: () => ({ gateway: true, memory: true, composer: true, hostScheduler: true }),
}));
jest.mock("@/hooks/useOperatorPrefs", () => ({
  useOperatorPrefs: () => ({
    prefs: {},
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    setPref: jest.fn(),
    saving: false,
    saveError: null,
  }),
}));

import Dashboard from "@/app/page";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const GATEWAY_URL = "http://127.0.0.1:8642";

const REASON: Record<SubsystemState, string> = {
  ok: `reachable at ${GATEWAY_URL}`,
  degraded: "answered slowly",
  down: "connection refused",
};

function subsystems(gateway: SubsystemState): SubsystemSummary {
  return {
    checkedAt: "2026-09-09T10:00:00.000Z",
    subsystems: [
      { id: "gateway", label: "Gateway", state: gateway, reason: REASON[gateway], url: gateway === "ok" ? GATEWAY_URL : undefined },
      { id: "memory", label: "Memory", state: "ok", reason: "sqlite" },
    ],
  };
}

function monitor(available: boolean): MonitorData {
  return {
    sessions: { total: 3, recent: [] },
    gateway: { platforms: {}, connectedCount: 0 },
    memory: { factCount: 0, dbSize: "0 B", provider: "sqlite" },
    errors: [],
    system: { uptime: "1h", configPresent: true, soulPresent: true, configYamlError: null },
    sync: { lastRun: null, allSuccessful: true, sourceStatuses: {}, sourceErrors: {} },
    scheduler: { ownerPid: 1, lastTickAt: new Date().toISOString(), stale: false, staleAfterMs: 60_000, selfPid: 1 },
    framework: { type: "hermes", name: "Hermes", available },
  };
}

function dash(gateway: SubsystemState, available = true): UseDashboardResult {
  return {
    status: null,
    monitor: monitor(available),
    processes: [],
    missions: [],
    config: null,
    templates: [],
    categories: [],
    modelReadiness: null,
    sessionTrend: [],
    subsystems: subsystems(gateway),
    ready: true,
    refetchMonitor: jest.fn(async () => undefined),
    refetchMissions: jest.fn(async () => undefined),
    refetchProcesses: jest.fn(async () => undefined),
    monitorError: null,
    monitorSettled: true,
    subsystemsError: null,
    subsystemsSettled: true,
  } as unknown as UseDashboardResult;
}

function badge(text: string): HTMLElement {
  const word = screen.getByText(text);
  const wrapper = word.closest("[title]") as HTMLElement | null;
  if (!wrapper) throw new Error(`"${text}" has no titled wrapper`);
  return wrapper;
}

describe("U18 · the header says what the panel says", () => {
  it("a gateway that is not running is said in the header in the panel's words", () => {
    mockUseDashboard.mockReturnValue(dash("down"));
    render(<Dashboard />);
    expect(screen.queryByText("ONLINE")).toBeNull();
    const b = badge("Gateway · Not running");
    expect(b).toHaveAttribute("title", "connection refused");
    expect(b.querySelector(".bg-status-fail")).not.toBeNull();
  });

  it("a healthy gateway reads Healthy, with its address in the tooltip", () => {
    mockUseDashboard.mockReturnValue(dash("ok"));
    render(<Dashboard />);
    const b = badge("Gateway · Healthy");
    expect(b.getAttribute("title")).toContain(GATEWAY_URL);
    expect(b.querySelector(".bg-status-ok")).not.toBeNull();
  });

  it("a degraded gateway reads Degraded in the warn tone", () => {
    mockUseDashboard.mockReturnValue(dash("degraded"));
    render(<Dashboard />);
    expect(badge("Gateway · Degraded").querySelector(".bg-status-warn")).not.toBeNull();
  });

  it("with no agent and no reachable gateway it still says NOT INSTALLED, the first run's fact", () => {
    mockUseDashboard.mockReturnValue(dash("down", false));
    render(<Dashboard />);
    expect(screen.getByText("NOT INSTALLED")).toBeInTheDocument();
    expect(screen.queryByText(/Gateway · /)).toBeNull();
  });

  it("a reachable gateway with no local install reads the gateway's word, not REMOTE", () => {
    mockUseDashboard.mockReturnValue(dash("ok", false));
    render(<Dashboard />);
    expect(screen.queryByText("REMOTE")).toBeNull();
    expect(screen.queryByText("NOT INSTALLED")).toBeNull();
    expect(badge("Gateway · Healthy").getAttribute("title")).toContain(GATEWAY_URL);
  });

  it("the words come from the one vocabulary the panel uses", () => {
    const page = read("src/app/page.tsx");
    expect(page).toMatch(/SUBSYSTEM_STATE_LABELS/);
    expect(page).not.toMatch(/>ONLINE</);
    expect(page).not.toMatch(/>REMOTE</);
    const guide = read("docs/guides/dashboard.md");
    expect(guide).not.toMatch(/reading ONLINE/);
    expect(guide).toMatch(/Gateway · (Healthy|Not running)/);
  });
});

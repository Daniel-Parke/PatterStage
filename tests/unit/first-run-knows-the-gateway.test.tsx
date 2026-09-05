/**
 * @jest-environment jsdom
 */

// T-0092, finding D from this device's browser pass: "Hermes is not installed
// on this machine, nothing will actually run" was shown while a gateway was
// configured, answering, and running missions fine. The install is remote; the
// screen has to say so.
//
// That sentence used to be FirstRunPanel's headline, and B17 (T-0111) removed
// the panel: the quests are the first-run checklist now. The finding did not
// go with it. What answers it today is the dashboard's own agent badge, which
// reads REMOTE and names the gateway, and which is fed by the settled facts
// rather than the newest probe (T-0099, D57) — so a single failed probe can no
// longer flip it back to NOT INSTALLED. This file follows the finding to where
// it lives.

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import type { UseDashboardResult } from "@/hooks/useDashboard";
import type { SubsystemSummary } from "@/lib/status/subsystems";
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
jest.mock("@/components/dashboard/DispatchStrip", () => ({
  __esModule: true,
  default: () => <div data-testid="dispatch-strip" />,
}));
jest.mock("@/modules/hermes/components/PlatformsPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="platforms-panel" />,
}));

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

const GATEWAY_URL = "http://192.168.1.50:8642";

function subsystems(gateway: "ok" | "down"): SubsystemSummary {
  return {
    checkedAt: "2026-09-05T10:00:00.000Z",
    subsystems: [
      {
        id: "gateway",
        label: "Gateway",
        state: gateway,
        reason: gateway === "ok" ? `reachable at ${GATEWAY_URL}` : "connection refused",
        url: gateway === "ok" ? GATEWAY_URL : undefined,
      },
      { id: "memory", label: "Memory", state: "ok", reason: "sqlite" },
    ],
  };
}

/** No local agent, nothing has run: the install the finding was written about. */
function monitor(): MonitorData {
  return {
    sessions: { total: 0, recent: [] },
    gateway: { platforms: {}, connectedCount: 0 },
    memory: { factCount: 0, dbSize: "0 B", provider: "sqlite" },
    errors: [],
    system: { uptime: "1h", configPresent: true, soulPresent: false, configYamlError: null },
    sync: { lastRun: null, allSuccessful: true, sourceStatuses: {}, sourceErrors: {} },
    scheduler: {
      ownerPid: 4242,
      lastTickAt: new Date().toISOString(),
      stale: false,
      staleAfterMs: 60_000,
      selfPid: 4242,
    },
    framework: { type: "hermes", name: "Hermes", available: false },
  };
}

function dash(gateway: "ok" | "down"): UseDashboardResult {
  return {
    status: null,
    monitor: monitor(),
    processes: [],
    missions: [],
    config: null,
    templates: [],
    categories: [],
    registryAgentModelLabel: null,
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

describe("a reachable gateway with no local install", () => {
  it("says the work runs remotely instead of claiming nothing will run", () => {
    mockUseDashboard.mockReturnValue(dash("ok"));
    const { container } = render(<Dashboard />);

    expect(screen.getByText("REMOTE")).toBeInTheDocument();
    expect(screen.queryByText("NOT INSTALLED")).toBeNull();
    // The badge's own tooltip is where the address is said.
    expect(container.querySelector(`[title*="${GATEWAY_URL}"]`)).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/nothing will actually run/i);
    expect(text).not.toMatch(/is not installed on this machine/i);
  });

  it("D57: one failed probe does not turn a remote install back into an absent one", () => {
    mockUseDashboard.mockReturnValue(dash("ok"));
    const view = render(<Dashboard />);
    expect(screen.getByText("REMOTE")).toBeInTheDocument();

    // The gateway is probed every fifteen seconds. A blip is a blip.
    mockUseDashboard.mockReturnValue(dash("down"));
    view.rerender(<Dashboard />);

    expect(screen.getByText("REMOTE")).toBeInTheDocument();
    expect(screen.queryByText("NOT INSTALLED")).toBeNull();
  });

  it("GREEN CONTROL: no local install and no gateway still reads NOT INSTALLED", () => {
    mockUseDashboard.mockReturnValue(dash("down"));
    render(<Dashboard />);

    expect(screen.getByText("NOT INSTALLED")).toBeInTheDocument();
    expect(screen.queryByText("REMOTE")).toBeNull();
  });
});

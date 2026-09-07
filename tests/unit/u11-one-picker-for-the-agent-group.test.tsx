/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): one profile picker, in the header, on every profile-scoped
 * screen.
 *
 * Three screens chose the agent three ways: Agents with a column of cards down
 * the left, Skills with a dropdown in the header, Tools with a "Profile" card
 * in the body. T-0113 made them share the SELECTION; this makes them share the
 * CONTROL, in the one place a persistent choice belongs, and gives the Agents
 * page its width back - the card column was 256px of the screen for a list
 * that is a table of eight rows.
 *
 * Two numbers on the Agents screen also stop disagreeing. The performance
 * strip said "22 RUNS" and the growth panel "Runs completed 11" for one
 * agent: one counts dispatches, the other completions, and neither said so.
 * And "Memory facts 0" was a hard-coded zero waiting for a count API that
 * never landed; a number that is always 0 is not a fact, so it goes.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/profiles",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/layout/PageHeader", () => ({
  __esModule: true,
  default: ({ subtitle, actions }: { subtitle?: ReactNode; actions?: ReactNode }) => (
    <div data-testid="page-header">
      <p data-testid="page-subtitle">{subtitle}</p>
      <div data-testid="page-header-actions">{actions}</div>
    </div>
  ),
}));
jest.mock("@/components/agents/AgentGrowthPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="growth-panel" />,
}));
jest.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    refetch: async () => undefined, data: [
      { id: "default", name: "Bob (local default)", description: "" },
      { id: "qa", name: "QA Engineer", description: "" },
    ],
    isLoading: false,
    error: null,
  }),
}));
jest.mock("@/hooks/useStats", () => ({
  useStats: () => ({
    stats: {
      agents: [
        {
          slug: "default",
          name: "Bob",
          runs: 22,
          runsCompleted: 11,
          missionsCompleted: 10,
          missionsFailed: 1,
          totalTokens: 1200,
          avgDurationSec: 30,
          skills: 4,
          toolsets: 2,
        },
      ],
    },
    isLoading: false,
  }),
}));

const mockApiFetch = jest.fn();
const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));

import AgentsPage from "@/app/agent/profiles/page";
import SkillsPage from "@/app/agent/skills/page";
import ToolsPage from "@/app/agent/tools/page";
import AgentPerformanceStrip from "@/components/agents/AgentPerformanceStrip";
import { setSelectedProfile } from "@/hooks/useSelectedProfile";
import type { AgentProfile } from "@/types/console";

function file(key: string, name: string) {
  return { key, name, path: `/tmp/${name}`, exists: true, size: 42, lastModified: null };
}
const BOB = {
  id: "default",
  name: "Bob (local default)",
  description: "The root agent",
  isDefault: true,
  isBundled: false,
  personality: "warm",
  skillsCount: 4,
  syncStatus: "synced",
  syncError: null,
  syncedAt: "2026-09-05T09:00:00.000Z",
  files: [file("soul", "SOUL.md"), file("config", "config.yaml")],
} as unknown as AgentProfile;
const QA = {
  ...BOB,
  id: "qa",
  name: "QA Engineer",
  description: "Reproduction and test-driven fixes",
  isDefault: false,
  syncStatus: "drift",
  syncedAt: null,
} as unknown as AgentProfile;

function answerEverything() {
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/api/agent/profiles" && !init?.method) return { data: { profiles: [BOB, QA] } };
    if (path.includes("/toolsets")) {
      return { data: { platformToolsets: { cli: ["web"] }, unifiedEnabled: ["web"], source: "database", platformsDiverged: false } };
    }
    if (path.startsWith("/api/skills")) {
      return { data: { skills: [{ name: "writer", description: "Writes", category: "core", enabled: true }], disabled: [], categories: ["core"] } };
    }
    if (path.startsWith("/api/agent/files/")) return { data: { content: "# Bob\n" } };
    return { data: { success: true } };
  });
  mockSafeApiCallData.mockResolvedValue({ profiles: [BOB, QA] });
}

function withQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const headerPicker = () => within(screen.getByTestId("page-header-actions")).getByTestId("profile-picker");

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  setSelectedProfile("default");
  answerEverything();
});

describe("the picker is in the header on every profile-scoped screen", () => {
  it("Agents", async () => {
    render(withQuery(<AgentsPage />));
    await screen.findByText("QA Engineer");
    expect(headerPicker()).toBeInTheDocument();
    expect(within(headerPicker()).getByRole("button", { name: "Profile" })).toHaveTextContent("Bob");
  });

  it("Skills", async () => {
    render(withQuery(<SkillsPage />));
    await screen.findByText("writer");
    expect(headerPicker()).toBeInTheDocument();
  });

  it("Tools", async () => {
    render(withQuery(<ToolsPage />));
    await screen.findByText("Enabled toolsets");
    expect(headerPicker()).toBeInTheDocument();
    // The body no longer carries a second one.
    expect(screen.getAllByTestId("profile-picker")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Profile" })).toBeNull();
  });

  it("choosing on one screen is the choice on the next", async () => {
    const skills = render(withQuery(<SkillsPage />));
    await screen.findByText("writer");
    fireEvent.click(within(headerPicker()).getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("option", { name: /QA Engineer/ }));
    await waitFor(() => expect(mockApiFetch.mock.calls.map((c) => String(c[0]))).toContain("/api/skills?profile=qa"));
    skills.unmount();

    render(withQuery(<ToolsPage />));
    await waitFor(() =>
      expect(mockApiFetch.mock.calls.map((c) => String(c[0]))).toContain("/api/agent/profiles/qa/toolsets"),
    );
    expect(within(headerPicker()).getByRole("button", { name: "Profile" })).toHaveTextContent("QA Engineer");
  });
});

describe("the Agents page is a table of profiles and one detail card", () => {
  it("lists every profile as a row, with what the cards used to say", async () => {
    render(withQuery(<AgentsPage />));
    await screen.findByText("QA Engineer");
    const table = screen.getByRole("table", { name: /profiles/i });
    const rows = within(table).getAllByTestId(/^profile-row-/);
    expect(rows).toHaveLength(2);
    const qa = screen.getByTestId("profile-row-qa");
    expect(qa).toHaveTextContent("QA Engineer");
    expect(qa).toHaveTextContent("qa");
    expect(qa).toHaveTextContent("4");
    expect(qa).toHaveTextContent("Drift");
    expect(qa).toHaveTextContent(/Never pushed/);
    expect(screen.getByTestId("profile-row-default")).toHaveTextContent(/Last pushed/);
  });

  it("a row's name selects it, and the selected row is marked", async () => {
    render(withQuery(<AgentsPage />));
    await screen.findByText("QA Engineer");
    expect(screen.getByTestId("profile-row-default")).toHaveAttribute("aria-selected", "true");
    // Exact: the row's push and pull controls are named for the row too.
    fireEvent.click(within(screen.getByTestId("profile-row-qa")).getByRole("button", { name: "QA Engineer" }));
    expect(await screen.findByRole("heading", { name: "QA Engineer" })).toBeInTheDocument();
    expect(screen.getByTestId("profile-row-qa")).toHaveAttribute("aria-selected", "true");
    expect(within(headerPicker()).getByRole("button", { name: "Profile" })).toHaveTextContent("QA Engineer");
  });

  it("push and pull are row actions, named for the row", async () => {
    render(withQuery(<AgentsPage />));
    await screen.findByText("QA Engineer");
    const qa = screen.getByTestId("profile-row-qa");
    expect(within(qa).getByRole("button", { name: /Push QA Engineer/ })).toBeInTheDocument();
    expect(within(qa).getByRole("button", { name: /Pull QA Engineer/ })).toBeInTheDocument();
    fireEvent.click(within(qa).getByRole("button", { name: /Push QA Engineer/ }));
    await waitFor(() =>
      expect(mockApiFetch.mock.calls.some(([p]) => String(p) === "/api/agent/profiles/sync/push")).toBe(true),
    );
  });

  it("the sync-all controls are real buttons and still there", async () => {
    render(withQuery(<AgentsPage />));
    await screen.findByText("QA Engineer");
    expect(screen.getByRole("button", { name: "Push all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import discovered/ })).toBeInTheDocument();
  });

  it("the identity block no longer links to the retired Personalities page", async () => {
    render(withQuery(<AgentsPage />));
    await screen.findByText("QA Engineer");
    expect(document.querySelector('a[href="/agent/personalities"]')).toBeNull();
  });
});

describe("two numbers say what they count", () => {
  it("the performance strip labels dispatches as dispatched, not as runs", () => {
    render(<AgentPerformanceStrip />);
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText(/dispatched/i)).toBeInTheDocument();
    expect(screen.queryByText(/^runs$/i)).toBeNull();
  });
});

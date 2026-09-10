/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- the reload case has to load the store module a second time, which a static import cannot do */

/**
 * T-0113: three profile pickers that did not talk to each other.
 *
 * Agents, Skills and Tools each kept the chosen profile in their own useState.
 * Chapter 3 of the quests walks an operator through all three in order, so
 * "shape your agent" meant: create a profile on Agents, then turn a skill on
 * for the root agent, then save a toolset for the root agent, with nothing on
 * any screen saying the subject had changed underneath them.
 *
 * These pin the one thing that fixes it: the three screens read and write ONE
 * selection, and it survives leaving the page.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/tools",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/components/layout/AppPageShell", () =>
  require("../helpers/mocks").appPageShellMock(),
);
jest.mock("@/components/layout/PageHeader", () => ({
  __esModule: true,
  default: ({ subtitle, actions }: { subtitle?: ReactNode; actions?: ReactNode }) => (
    <div data-testid="page-header">
      {subtitle}
      {actions}
    </div>
  ),
}));
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
// The two strips are gone (U11): their counts are the subtitles now, which read
// the profile's name through useProfiles.
jest.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    refetch: async () => undefined, data: [
      { id: "default", name: "Bob", description: "" },
      { id: "qa", name: "QA Engineer", description: "" },
    ],
    isLoading: false,
    error: null,
  }),
}));
jest.mock("@/components/agents/AgentGrowthPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="growth-panel" />,
}));

/** The real picker is a listbox of its own; what matters here is the value. */
jest.mock("@/components/ui/ProfilePicker", () => require("../helpers/mocks").profilePickerMock());

const mockApiFetch = jest.fn();
const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  // The pages read through useApiResource, which calls safeApiCall; routed
  // through the same mock so a read is still one of the paths asked for (C6, T-0143).
   
  safeApiCall: require("../helpers/mocks").safeApiCallOver((...a: unknown[]) => mockApiFetch(...a)),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));

import AgentsPage from "@/app/agent/profiles/page";
import SkillsPage from "@/app/agent/skills/page";
import ToolsPage from "@/app/agent/tools/page";
import { getSelectedProfile, setSelectedProfile } from "@/hooks/useSelectedProfile";
import type { AgentProfile } from "@/types/console";

function file(key: string, name: string) {
  return { key, name, path: `/tmp/${name}`, exists: true, size: 42, lastModified: null };
}

const BOB = {
  id: "default",
  name: "Bob (local default)",
  description: "The agent missions and chat use when no profile is chosen",
  isDefault: true,
  isBundled: false,
  personality: "warm",
  skillsCount: 1,
  syncStatus: "synced",
  syncError: null,
  syncedAt: null,
  files: [file("soul", "SOUL.md"), file("config", "config.yaml")],
} as unknown as AgentProfile;

const QA = {
  id: "qa",
  name: "QA Engineer",
  description: "Reproduction and test-driven fixes",
  isDefault: false,
  isBundled: false,
  personality: "technical",
  skillsCount: 1,
  syncStatus: "synced",
  syncError: null,
  syncedAt: null,
  files: [file("soul", "SOUL.md"), file("config", "config.yaml")],
} as unknown as AgentProfile;

const SKILL = {
  name: "writer",
  description: "Writes",
  category: "core",
  enabled: true,
  path: "/tmp/writer",
  size: 1,
  lastModified: null,
};

function answerEverything() {
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/api/agent/profiles" && !init?.method) return { data: { profiles: [BOB, QA] } };
    if (path.includes("/toolsets")) {
      return {
        data: {
          platformToolsets: { cli: ["web"] },
          unifiedEnabled: ["web"],
          source: "database",
          platformsDiverged: false,
        },
      };
    }
    if (path.startsWith("/api/skills")) {
      return { data: { skills: [SKILL], disabled: [], categories: ["core"] } };
    }
    if (path.startsWith("/api/agent/files/")) return { data: { content: "# Bob\n" } };
    return { data: { success: true } };
  });
  mockSafeApiCallData.mockResolvedValue({ profiles: [BOB, QA] });
}

/** AgentSetupNotice reads through react-query, which needs its provider. */
function withQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

/** Every path asked for, in order. */
const paths = () => mockApiFetch.mock.calls.map((c) => String(c[0]));

const picker = () => screen.getByLabelText("Profile") as HTMLSelectElement;

/** The list button for one profile, found by the name it leads with. */
function profileButton(name: string): HTMLButtonElement {
  const found = screen
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").trim().startsWith(name));
  if (!found) throw new Error(`no profile button for ${name}`);
  return found as HTMLButtonElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  setSelectedProfile("default");
  answerEverything();
});

describe("the choice made on one agent screen is the choice on the next", () => {
  it("carries from Tools to Skills", async () => {
    const tools = render(withQuery(<ToolsPage />));
    await waitFor(() => expect(screen.getByText("Enabled toolsets")).toBeInTheDocument());

    fireEvent.change(picker(), { target: { value: "qa" } });
    await waitFor(() => expect(picker().value).toBe("qa"));
    tools.unmount();

    mockApiFetch.mockClear();
    render(withQuery(<SkillsPage />));

    await waitFor(() => expect(paths()).toContain("/api/skills?profile=qa"));
    expect(picker().value).toBe("qa");
  });

  it("carries from Skills to Agents", async () => {
    const skills = render(withQuery(<SkillsPage />));
    await waitFor(() => expect(paths()).toContain("/api/skills?profile=default"));

    fireEvent.change(picker(), { target: { value: "qa" } });
    await waitFor(() => expect(picker().value).toBe("qa"));
    skills.unmount();

    render(withQuery(<AgentsPage />));

    // The detail column is the one that names the selected profile.
    expect(await screen.findByRole("heading", { name: "QA Engineer" })).toBeInTheDocument();
  });

  it("carries from Agents to Tools", async () => {
    const agents = render(withQuery(<AgentsPage />));
    await screen.findByRole("heading", { name: /Bob/ });

    fireEvent.click(profileButton("QA Engineer"));
    await screen.findByRole("heading", { name: "QA Engineer" });
    agents.unmount();

    mockApiFetch.mockClear();
    render(withQuery(<ToolsPage />));

    await waitFor(() => expect(paths()).toContain("/api/agent/profiles/qa/toolsets"));
    expect(picker().value).toBe("qa");
  });

  it("GREEN CONTROL: with no choice made, every screen starts on the root agent", async () => {
    const tools = render(withQuery(<ToolsPage />));
    await waitFor(() => expect(paths()).toContain("/api/agent/profiles/default/toolsets"));
    expect(picker().value).toBe("default");
    tools.unmount();

    render(withQuery(<SkillsPage />));
    await waitFor(() => expect(paths()).toContain("/api/skills?profile=default"));
    expect(picker().value).toBe("default");
  });
});

describe("the selection itself", () => {
  it("survives a reload, because a chapter is not one sitting", () => {
    setSelectedProfile("qa");

    // A fresh load of the page is a fresh load of the module.
    jest.isolateModules(() => {
      const store = require("@/hooks/useSelectedProfile") as typeof import("@/hooks/useSelectedProfile");
      expect(store.getSelectedProfile()).toBe("qa");
    });
  });

  it("falls back to the root agent when nothing has been chosen", () => {
    jest.isolateModules(() => {
      window.localStorage.clear();
      const store = require("@/hooks/useSelectedProfile") as typeof import("@/hooks/useSelectedProfile");
      expect(store.getSelectedProfile()).toBe("default");
    });
    expect(getSelectedProfile()).toBe("default");
  });
});

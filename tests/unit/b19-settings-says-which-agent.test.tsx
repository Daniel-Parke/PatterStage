/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * T-0113: Settings never said which agent it was editing, and it was not the
 * one the rest of the chapter was about.
 *
 * Chapter 3 walks an operator through Agents, Skills, Tools, then Settings.
 * The first three edit the profile in the picker. Settings reads and writes
 * /api/config, which is the config.yaml of the agent at the configured home,
 * whatever the picker says. So an operator who created a profile, gave it
 * skills and gave it toolsets went on to change "its" settings on a screen that
 * had never heard of it, and nothing on the page mentioned a profile at all.
 *
 * The route can only write the one file, so the fix is not a pretence that it
 * writes another: the screens NAME their subject, and say plainly when the
 * profile selected elsewhere is a different one, with the place its own
 * settings live.
 */

import { screen } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import type { ReactNode } from "react";

const mockUseParams = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/agent/settings",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

/** The names come from the same list the pickers read. */
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

const mockUseConfig = jest.fn();
jest.mock("@/hooks/useConfig", () => ({ useConfig: () => mockUseConfig() }));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api/api-fetch") as Record<string, unknown>),
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  // The file sections read through useApiResource since C6 (T-0143), which
  // calls safeApiCall; it answers from the same double.
   
  safeApiCall: require("../helpers/mocks").safeApiCallOver((...a: unknown[]) => mockApiFetch(...a)),
  setErrorFromCaught: jest.fn(),
}));

import SettingsIndexPage from "@/app/agent/settings/page";
import { setSelectedProfile } from "@/hooks/useSelectedProfile";

/**
 * Render the Agent section over a config the server says belongs to `subject`.
 *
 * Amended 2026-09-10 (U11, T-0125): the section editor is a section OF the
 * Settings page now, and the subject is named once above all of them, so this
 * renders the page and waits for the Agent section to be on it.
 */
async function renderSection(subject: string | undefined) {
  mockUseParams.mockReturnValue({ section: "agent" });
  mockApiFetch.mockResolvedValue({ data: { content: "" } });
  renderIndex(subject ?? null);
  await screen.findByTestId("settings-section-agent");
}

function renderIndex(subject: string | null) {
  mockUseConfig.mockReturnValue({
    data: { agent: { max_turns: 40 } },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    configError: null,
    subject,
  });
  renderWithQuery(<SettingsIndexPage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  setSelectedProfile("default");
});

describe("the section editor names its subject", () => {
  it("says which agent these settings belong to", async () => {
    await renderSection("default");

    expect(screen.getByText(/These settings belong to Bob \(local default\)/)).toBeInTheDocument();
  });

  it("takes the subject from the server rather than assuming the root agent", async () => {
    // HERMES_HOME can point inside profiles/, and then the file this page
    // writes is that profile's. The route knows; the page must not guess.
    await renderSection("qa");

    expect(screen.getByText(/These settings belong to QA Engineer/)).toBeInTheDocument();
  });

  it("says nothing at all while the subject is unknown", async () => {
    await renderSection(undefined);

    expect(screen.queryByText(/These settings belong to/)).toBeNull();
  });
});

describe("when the profile selected elsewhere is a different agent", () => {
  it("says so, in the words the other screens use", async () => {
    setSelectedProfile("qa");

    await renderSection("default");

    expect(screen.getByText(/You have QA Engineer selected on Agents, Skills and Tools/)).toBeInTheDocument();
  });

  it("sends the operator where that profile's own settings are", async () => {
    setSelectedProfile("qa");

    await renderSection("default");

    const link = screen.getByRole("link", { name: /Agents/i });
    expect(link).toHaveAttribute("href", "/agent/profiles");
  });

  it("GREEN CONTROL: says nothing about a divergence when there is none", async () => {
    await renderSection("default");

    expect(screen.getByText(/These settings belong to Bob \(local default\)/)).toBeInTheDocument();
    expect(screen.queryByText(/You have/)).toBeNull();
  });
});

describe("the settings index names it too", () => {
  it("names the agent whose sections the grid opens", () => {
    renderIndex("default");

    expect(screen.getByText(/These settings belong to Bob \(local default\)/)).toBeInTheDocument();
  });

  it("carries the same warning when the selection is another profile", () => {
    setSelectedProfile("qa");

    renderIndex("default");

    expect(screen.getByText(/You have QA Engineer selected on Agents, Skills and Tools/)).toBeInTheDocument();
  });

  it("says nothing while the config has not been read", () => {
    renderIndex(null);

    expect(screen.queryByText(/These settings belong to/)).toBeNull();
  });
});

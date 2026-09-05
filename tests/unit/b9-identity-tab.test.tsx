/** @jest-environment jsdom */

/**
 * B9 oracle, the Identity tab (T-0103, decision 11).
 *
 * Personalities and Agents both edited SOUL.md, from two pages, through two
 * routes. One of them goes. What is left is a tab on the agent's own card:
 * the voice it is using, and the file that holds it, opened where the
 * operator is already standing.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/profiles",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});
jest.mock("@/components/agents/AgentGrowthPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="growth-panel" />,
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));

import AgentsPage from "@/app/agent/profiles/page";
import type { AgentProfile } from "@/types/console";

function file(key: string, name: string) {
  return { key, name, path: `/tmp/${name}`, exists: true, size: 42, lastModified: null };
}

const BOB: AgentProfile = {
  id: "default",
  name: "Bob (local default)",
  description: "The agent missions and chat use when no profile is chosen",
  isDefault: true,
  isBundled: false,
  personality: "Warm, direct, and allergic to filler.",
  skillsCount: 4,
  syncStatus: "synced",
  syncError: null,
  syncedAt: "2026-09-05T09:00:00.000Z",
  files: [file("soul", "SOUL.md"), file("agent", "AGENTS.md"), file("config", "config.yaml")],
} as unknown as AgentProfile;

const SOUL = "# Bob\n\nYou are warm and direct.\n";

function withQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const paths = () => mockApiFetch.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/agent/profiles");
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/api/agent/profiles" && !init?.method) return { data: { profiles: [BOB] } };
    if (path.startsWith("/api/agent/files/")) return { data: { content: SOUL } };
    return { data: { success: true } };
  });
});

async function renderLoaded() {
  render(withQuery(<AgentsPage />));
  // The list first (the spinner is gone), then the auto-selection (the detail
  // column is up). "Select a profile" is absent during loading too, so waiting
  // only for that waits for nothing.
  await screen.findByText(/Bob/);
  await waitFor(() => expect(screen.queryByText("Select a profile")).toBeNull());
}

describe("the agent's card has two tabs", () => {
  it("Identity and Files, with Files the one it opens on", async () => {
    await renderLoaded();

    const identity = screen.getByRole("tab", { name: /Identity/i });
    const files = screen.getByRole("tab", { name: /Files/i });
    expect(identity.getAttribute("aria-selected")).toBe("false");
    expect(files.getAttribute("aria-selected")).toBe("true");
  });

  it("?tab=identity opens on Identity, which is where the old page redirects to", async () => {
    window.history.replaceState({}, "", "/agent/profiles?tab=identity");

    await renderLoaded();

    expect(screen.getByRole("tab", { name: /Identity/i }).getAttribute("aria-selected")).toBe("true");
  });

  it("the tab is in the URL, so the page can be linked to and reloaded", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("tab", { name: /Identity/i }));

    await waitFor(() => expect(window.location.search).toBe("?tab=identity"));
  });
});

describe("what Identity shows", () => {
  it("the voice the agent is using, from the profile row", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("tab", { name: /Identity/i }));

    expect(await screen.findByText(/Warm, direct, and allergic to filler\./)).toBeInTheDocument();
  });

  it("SOUL.md, opened where the operator is standing", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("tab", { name: /Identity/i }));

    // The file opens without a trip through the file list.
    await waitFor(() => expect(paths().some((p) => p.startsWith("/api/agent/files/soul"))).toBe(true));
    expect(await screen.findByRole("button", { name: /^Save$/ })).toBeInTheDocument();
  });

  it("a save goes through the file door, which is the door that keeps the ledger", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("tab", { name: /Identity/i }));
    await screen.findByRole("button", { name: /^Save$/ });

    const toggles = await screen.findAllByRole("button", { name: /^Edit$/ });
    fireEvent.click(toggles[toggles.length - 1]);
    const box = await screen.findByLabelText("File content");
    fireEvent.change(box, { target: { value: "# Bob\n\nYou are terse.\n" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(
          ([p, init]) =>
            String(p).startsWith("/api/agent/files/soul") &&
            (init as { method?: string } | undefined)?.method === "PUT",
        ),
      ).toBe(true),
    );
    // And never through the route that is being retired.
    expect(paths().some((p) => p.includes("/api/agent/personality"))).toBe(false);
    expect(paths().some((p) => p.includes("/api/personalities"))).toBe(false);
  });
});

describe("the Files tab is unchanged", () => {
  it("still lists the behaviour files", async () => {
    await renderLoaded();

    // config.yaml is also named inside the header's disclosure, so scope the
    // assertion to the list rather than to the document.
    const list = screen.getByText("Behaviour files").parentElement!;
    expect(within(list).getByText("AGENTS.md")).toBeInTheDocument();
    expect(within(list).getByText("config.yaml")).toBeInTheDocument();
  });
});

/** @jest-environment jsdom */
/**
 * B3 (T-0097), decision 12 and D109: Update, Rebuild and Restart leave the
 * rail for Settings > System, which also says how this install is configured
 * and can copy it for a bug report. The rail keeps a version line and an
 * "update available" badge. The rail is rendered ONCE: a single aside that is
 * the drawer on a phone and the rail on a desktop, with its collapsed state
 * persisted through /api/prefs.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let pathname = "/";
jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ data: {} }) }));

const versionState = {
  version: null as null | { updateAvailable: boolean; behind: number; localHash: string; remoteHash: string; commitMessage: string; branch: string; lastChecked: string },
  checkState: "idle",
  restarting: false,
  rebuilding: false,
  isBusy: false,
  message: null as string | null,
  dropdownOpen: false,
  branches: ["main", "dev"],
  selectedBranch: "dev",
  deployEnabled: true,
  deployLogTail: [] as string[],
  openCheckDropdown: jest.fn(async () => {}),
  closeDropdown: jest.fn(),
  handleDropdownConfirm: jest.fn(async () => {}),
  handleUpdate: jest.fn(),
  onRebuildClick: jest.fn(),
  onRestartClick: jest.fn(),
  isArmedFor: () => false,
};
jest.mock("@/hooks/useVersionFooter", () => ({ useVersionFooter: () => versionState }));

import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import SystemPage from "@/app/agent/settings/system/page";

const RUNTIME = {
  authMode: "token",
  deployApiEnabled: true,
  readOnly: false,
  composerEnabled: true,
  dataDir: "/home/me/patterstage/data",
  dbPath: "/home/me/patterstage/data/patterstage.db",
  hermesHome: "/home/me/.hermes",
  port: 3000,
  schemaVersion: 38,
  gitHash: "abc1234",
  appVersion: "0.1.0",
  gatewayUrl: "http://127.0.0.1:8642",
  node: "v22.0.0",
  platform: "linux",
};

type Answer = { status?: number; body: unknown };
let answers: Record<string, Answer> = {};
const calls: Array<{ url: string; method: string; body: unknown }> = [];

function installFetch() {
  calls.length = 0;
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const a = answers[path] ?? { status: 404, body: { error: "no stub for " + path } };
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

function withQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

function mountShell() {
  return render(
    withQuery(
      <SidebarProvider>
        <MobileHeader />
        <Sidebar />
      </SidebarProvider>,
    ),
  );
}

function mockMedia(mobile: boolean) {
  window.matchMedia = jest.fn((query: string) => ({
    matches: mobile && /max-width/.test(query),
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  pathname = "/";
  answers = {
    "/api/prefs": { body: { data: { prefs: {} } } },
    "/api/status/runtime": { body: { data: RUNTIME } },
    "/api/update": { body: { data: { updateAvailable: false, behind: 0, deployEnabled: true } } },
    // The Backups card reads this (T-0100, B6). Unstubbed it answered 404 and
    // the card's own error banner became a second role="alert" on the page.
    "/api/backup": {
      body: {
        data: {
          dbPath: "/home/me/patterstage/data/patterstage.db",
          dir: "/home/me/patterstage/data/backups/db",
          backups: [],
          restoreCommand: "# stop the server first",
        },
      },
    },
  };
  installFetch();
  mockMedia(false);
  Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => {}) } });
});

describe("the rail, rendered once", () => {
  it("is a single aside with the four visible headings and no Home heading", async () => {
    mountShell();
    expect(document.querySelectorAll("aside")).toHaveLength(1);
    for (const h of ["Work", "Results", "Agent", "Rec Room"]) expect(screen.getByText(h)).toBeInTheDocument();
    expect(screen.queryByText(/^Home$/)).toBeNull();
    expect(screen.getByRole("link", { name: "Quests" })).toHaveAttribute("href", "/quests");
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });

  it("carries no deploy buttons and no config tree", () => {
    mountShell();
    expect(screen.queryByRole("button", { name: /check for updates/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /rebuild/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /restart/i })).toBeNull();
    expect(screen.queryByText(/config settings/i)).toBeNull();
    expect(document.querySelector('a[href^="/config"]')).toBeNull();
  });

  it("shows the version line, and an update badge that links to System when one is available", async () => {
    answers["/api/update"] = { body: { data: { updateAvailable: true, behind: 3, deployEnabled: true } } };
    mountShell();
    await waitFor(() => expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument());
    const badge = await screen.findByRole("link", { name: /update available/i });
    expect(badge).toHaveAttribute("href", "/agent/settings/system");
  });

  it("shows no badge when the checkout is current", async () => {
    mountShell();
    await waitFor(() => expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /update available/i })).toBeNull();
  });

  it("persists the collapsed state through PUT /api/prefs and restores it on mount", async () => {
    mountShell();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PUT" && c.url.includes("/api/prefs"))?.body).toEqual({ key: "sidebar.collapsed", value: true }),
    );
  });

  it("restores a collapsed rail from the stored preference", async () => {
    answers["/api/prefs"] = { body: { data: { prefs: { "sidebar.collapsed": true } } } };
    mountShell();
    await screen.findByRole("button", { name: /expand sidebar/i });
  });

  it("on a phone the same aside is the drawer: inert closed, a dialog open, Escape closes it", async () => {
    mockMedia(true);
    mountShell();
    const aside = document.querySelector("aside")!;
    await waitFor(() => expect(aside).toHaveAttribute("inert"));
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(aside).not.toHaveAttribute("inert");
    expect(aside).toHaveAttribute("role", "dialog");
    expect(aside).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(aside).toHaveAttribute("inert");
  });

  it("on a desktop the aside is never inert and never a dialog", async () => {
    mountShell();
    const aside = document.querySelector("aside")!;
    expect(aside).not.toHaveAttribute("inert");
    expect(aside).not.toHaveAttribute("role");
  });
});

describe("Settings > System", () => {
  beforeEach(() => {
    pathname = "/agent/settings/system";
  });

  it("says how this install is configured, row by row, from /api/status/runtime", async () => {
    render(withQuery(<SystemPage />));
    await screen.findByText("/home/me/patterstage/data");
    const rows: Array<[RegExp, string | RegExp]> = [
      [/auth mode/i, /token/],
      [/deploy api/i, /^on$/i],
      [/read-only/i, /^off$/i],
      [/database/i, /patterstage\.db/],
      [/hermes home/i, /\.hermes/],
      [/port/i, /3000/],
      [/schema version/i, /38/],
      [/version/i, /0\.1\.0/],
      [/commit/i, /abc1234/],
      [/gateway/i, /127\.0\.0\.1:8642/],
    ];
    for (const [label] of rows) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    for (const [, value] of rows) expect(screen.getAllByText(value).length).toBeGreaterThan(0);
  });

  it("copies the same facts as one block for a bug report", async () => {
    render(withQuery(<SystemPage />));
    await screen.findByText("/home/me/patterstage/data");
    fireEvent.click(screen.getByRole("button", { name: /copy for a bug report/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const text = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(text).toMatch(/auth=token/);
    expect(text).toMatch(/deploy-api=on/);
    expect(text).toMatch(/schema=38/);
    expect(text).toMatch(/commit=abc1234/);
    expect(text).not.toMatch(/token=[A-Za-z0-9]{8,}/);
  });

  it("holds the deploy controls: Check for updates, Rebuild and Restart, with the branch behind Advanced", async () => {
    render(withQuery(<SystemPage />));
    expect(screen.getByRole("button", { name: /check for updates/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^rebuild/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^restart/i })).toBeInTheDocument();
    expect(screen.getByText(/advanced/i)).toBeInTheDocument();
  });

  it("says when the deploy API is off, before any click", async () => {
    versionState.deployEnabled = false;
    render(withQuery(<SystemPage />));
    expect(screen.getByText(/deploy api is off/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check for updates/i })).toBeDisabled();
    versionState.deployEnabled = true;
  });

  it("has a backups card, which B6 filled in", async () => {
    render(withQuery(<SystemPage />));
    expect(screen.getByRole("heading", { name: /^backups$/i })).toBeInTheDocument();
    // B3 shipped the heading over a "not here yet" line. T-0100 replaced it
    // with the real card; what it does is held by b6-system-backups-card.
    expect(screen.queryByText(/not here yet/i)).toBeNull();
  });

  it("renders the runtime read's failure as an error with Retry, never an empty card", async () => {
    answers["/api/status/runtime"] = { status: 500, body: { error: "the database is locked" } };
    render(withQuery(<SystemPage />));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("the placeholder pages exist so the rail has nowhere dead", () => {
  it("Quests and Help render a header with the registry's word", async () => {
    pathname = "/quests";
    const { default: Quests } = await import("@/app/quests/page");
    render(withQuery(<Quests />));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Quests");
    act(() => {
      pathname = "/help";
    });
    const { default: Help } = await import("@/app/help/page");
    render(withQuery(<Help />));
    expect(screen.getAllByRole("heading", { level: 1 }).some((h) => h.textContent === "Help")).toBe(true);
  });
});

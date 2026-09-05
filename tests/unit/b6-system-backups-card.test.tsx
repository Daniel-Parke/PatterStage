/** @jest-environment jsdom */

// B6 (T-0100) oracle, group backups, the page half: the Backups card on
// Settings > System (`src/app/agent/settings/system/page.tsx`).
//
// Contract section 7, the card lines: the card reads `/api/backup` through
// useApiResource and obeys the read contract (LoadErrorBanner with Retry
// before any empty state, the spinner while reading); rows show name, size
// and a local date newest first; the empty state is "No backups yet."; a
// "Back up now" Button POSTs `/api/backup`, toasts `Backed up to <name>.`
// and refetches, and on failure toasts the error without refetching; under
// runtime.readOnly it is disabled with the sentence that says why; below the
// list the restore is explained as a shell step, the command sits in a <pre>
// with a Copy button; and "not here yet" appears nowhere. The card never
// prints the data directory alone, which is what keeps the b3 System page
// test's exact findByText single-match.
//
// The doubles mirror tests/unit/b3-system-page-and-rail.test.tsx (the same
// page, the same fetch stub keyed by path), plus a `/api/backup` stub whose
// `dir` differs from the runtime's dataDir. The stub is method-aware so a
// POST and a GET to the same path can answer differently.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/settings/system",
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
  version: null,
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

const RESTORE =
  '# stop the server first\ncp "<backup file>" "/home/me/patterstage/data/patterstage.db"\nrm -f "/home/me/patterstage/data/patterstage.db-wal" "/home/me/patterstage/data/patterstage.db-shm"\n# then start the server again';

const NEWER = {
  name: "patterstage.pre-clean.2026-09-06T09-00-00-000Z.db",
  path: "/home/me/patterstage/data/backups/db/patterstage.pre-clean.2026-09-06T09-00-00-000Z.db",
  bytes: 3633152,
  takenAt: "2026-09-06T09:00:00.000Z",
  kind: "snapshot",
};
const OLDER = {
  name: "patterstage.db.pre-baseline-1779387782973",
  path: "/home/me/patterstage/data/patterstage.db.pre-baseline-1779387782973",
  bytes: 512000,
  takenAt: "2026-05-21T18:23:02.973Z",
  kind: "migration",
};

function backupList(backups: unknown[]) {
  return {
    data: {
      dbPath: RUNTIME.dbPath,
      // Not the runtime's dataDir: b3's exact findByText on that string must
      // keep matching one element.
      dir: "/home/me/patterstage/data/backups/db",
      backups,
      restoreCommand: RESTORE,
    },
  };
}

type Answer = { status?: number; body: unknown };
/** Keyed by "<METHOD> <path>", falling back to "<path>". */
let answers: Record<string, Answer> = {};
const calls: Array<{ url: string; method: string; body: unknown }> = [];

function installFetch() {
  calls.length = 0;
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const a = answers[`${method} ${path}`] ?? answers[path] ?? { status: 404, body: { error: "no stub for " + path } };
    return new Response(JSON.stringify(a.body), {
      status: a.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function withQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const backupGets = () => calls.filter((c) => c.method === "GET" && /\/api\/backup$/.test(c.url.split("?")[0]));
const backupPosts = () => calls.filter((c) => c.method === "POST" && /\/api\/backup$/.test(c.url.split("?")[0]));

/** The Backups card: the section that holds the heading. */
function backupsCard(): HTMLElement {
  const heading = screen.getByRole("heading", { name: /^backups$/i });
  return (heading.closest("section") ?? heading.parentElement) as HTMLElement;
}

beforeEach(() => {
  answers = {
    "/api/prefs": { body: { data: { prefs: {} } } },
    "/api/status/runtime": { body: { data: RUNTIME } },
    "/api/update": { body: { data: { updateAvailable: false, behind: 0, deployEnabled: true } } },
    "/api/backup": { body: backupList([]) },
  };
  installFetch();
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => {}) } });
});

// ═══════════════════════════════════════════════════════════════
// the empty state, and the restore instructions that are always there
// ═══════════════════════════════════════════════════════════════

describe("the Backups card with nothing taken yet", () => {
  it("shows the heading, Back up now, 'No backups yet.' and never 'not here yet'", async () => {
    render(withQuery(<SystemPage />));

    expect(screen.getByRole("heading", { name: /^backups$/i })).toBeInTheDocument();
    expect(await screen.findByText(/No backups yet\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back up now/i })).toBeInTheDocument();
    expect(screen.queryByText(/not here yet/i)).toBeNull();
  });

  it("explains that restoring is a shell step and shows the command in a <pre>", async () => {
    render(withQuery(<SystemPage />));
    await screen.findByText(/No backups yet\./);

    expect(screen.getByText(/Restoring is a shell step:/)).toBeInTheDocument();
    expect(
      screen.getByText(/stop the server, copy the backup over the database, then start it again\./),
    ).toBeInTheDocument();
    const pres = Array.from(document.querySelectorAll("pre"));
    const command = pres.find((p) => (p.textContent ?? "").includes('cp "'));
    expect(command).toBeDefined();
    expect(command?.textContent).toContain('rm -f "');
    expect(command?.textContent).toContain("<backup file>");
  });

  it("copies the restore command from the card", async () => {
    render(withQuery(<SystemPage />));
    await screen.findByText(/No backups yet\./);

    fireEvent.click(within(backupsCard()).getByRole("button", { name: /copy/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(RESTORE));
  });

  it("says it is reading before the first answer arrives", () => {
    render(withQuery(<SystemPage />));

    expect(screen.getByText("Reading the backups…")).toBeInTheDocument();
  });

  it("GREEN CONTROL: the data directory is still printed exactly once on the page", async () => {
    // b3-system-page-and-rail's findByText("/home/me/patterstage/data") is a
    // single-match lookup. The card must not print dataDir alone.
    render(withQuery(<SystemPage />));
    await screen.findByText("/home/me/patterstage/data");

    expect(screen.getAllByText("/home/me/patterstage/data")).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// rows
// ═══════════════════════════════════════════════════════════════

describe("the Backups card with two backups", () => {
  beforeEach(() => {
    answers["/api/backup"] = { body: backupList([NEWER, OLDER]) };
  });

  it("renders both names with a size and a local date, newest first, and no empty state", async () => {
    render(withQuery(<SystemPage />));

    const newer = await screen.findByText(/patterstage\.pre-clean\.2026-09-06T09-00-00-000Z\.db/);
    const older = screen.getByText(/patterstage\.db\.pre-baseline-1779387782973/);
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 3633152 bytes is 3.5 MB; 512000 bytes is under a megabyte, so KB.
    expect(screen.getByText(/3\.5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/\b500(\.0)? KB/)).toBeInTheDocument();
    // Normalized the way the matcher normalizes the DOM: an en-US runner puts a
    // NARROW NO-BREAK SPACE before AM/PM, which the DOM side collapses to a
    // plain space while the raw pattern would still carry it.
    const shown = (iso: string) => escape(new Date(iso).toLocaleString().replace(/\s+/g, " "));
    expect(screen.getByText(new RegExp(shown(NEWER.takenAt)))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(shown(OLDER.takenAt)))).toBeInTheDocument();
    expect(screen.queryByText(/No backups yet\./)).toBeNull();
    expect(screen.queryByText(/not here yet/i)).toBeNull();
  });
});

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ═══════════════════════════════════════════════════════════════
// the read contract
// ═══════════════════════════════════════════════════════════════

describe("the Backups card when the list read fails", () => {
  beforeEach(() => {
    answers["/api/backup"] = { status: 500, body: { error: "boom" } };
  });

  it("shows the error with Retry inside the card, and never the empty state", async () => {
    render(withQuery(<SystemPage />));

    const card = backupsCard();
    const alert = await within(card).findByRole("alert");
    expect(alert).toHaveTextContent("boom");
    expect(within(card).getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/No backups yet\./)).toBeNull();
    expect(screen.queryByText(/not here yet/i)).toBeNull();
    // The runtime read succeeded, so this is the only alert on the page.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("Retry fetches /api/backup again", async () => {
    render(withQuery(<SystemPage />));
    const card = backupsCard();
    await within(card).findByRole("alert");
    const before = backupGets().length;

    fireEvent.click(within(card).getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(backupGets().length).toBeGreaterThan(before));
  });
});

// ═══════════════════════════════════════════════════════════════
// Back up now
// ═══════════════════════════════════════════════════════════════

describe("Back up now", () => {
  it("POSTs /api/backup with no body, toasts the file name and refetches the list", async () => {
    answers["POST /api/backup"] = {
      status: 201,
      body: { data: { backup: { ...NEWER, name: "patterstage.manual.X.db" } } },
    };
    render(withQuery(<SystemPage />));
    await screen.findByText(/No backups yet\./);
    const getsBefore = backupGets().length;

    fireEvent.click(screen.getByRole("button", { name: /back up now/i }));

    expect(await screen.findByText("Backed up to patterstage.manual.X.db.")).toBeInTheDocument();
    expect(backupPosts()).toHaveLength(1);
    expect(backupPosts()[0].body).toBeUndefined();
    await waitFor(() => expect(backupGets().length).toBeGreaterThan(getsBefore));
  });

  it("on a 500 toasts the server's reason and does not refetch", async () => {
    answers["POST /api/backup"] = { status: 500, body: { error: "disk full" } };
    render(withQuery(<SystemPage />));
    await screen.findByText(/No backups yet\./);
    const getsBefore = backupGets().length;

    fireEvent.click(screen.getByRole("button", { name: /back up now/i }));

    const toast = await screen.findByText("disk full");
    expect(toast.closest('[role="alert"]')).not.toBeNull();
    expect(backupPosts()).toHaveLength(1);
    expect(backupGets()).toHaveLength(getsBefore);
  });

  it("is not a ConfirmButton: one click is the request", async () => {
    answers["POST /api/backup"] = { status: 201, body: { data: { backup: NEWER } } };
    render(withQuery(<SystemPage />));
    await screen.findByText(/No backups yet\./);

    fireEvent.click(screen.getByRole("button", { name: /back up now/i }));

    await waitFor(() => expect(backupPosts()).toHaveLength(1));
  });
});

// ═══════════════════════════════════════════════════════════════
// read-only
// ═══════════════════════════════════════════════════════════════

describe("under a read-only runtime", () => {
  beforeEach(() => {
    answers["/api/status/runtime"] = { body: { data: { ...RUNTIME, readOnly: true } } };
  });

  it("disables Back up now and says why", async () => {
    render(withQuery(<SystemPage />));
    await screen.findByText(/No backups yet\./);

    await waitFor(() => expect(screen.getByRole("button", { name: /back up now/i })).toBeDisabled());
    expect(screen.getByText(/Read-only is on, so a backup cannot be taken from here\./)).toBeInTheDocument();
  });

  it("GREEN CONTROL: a writable runtime shows no such line", async () => {
    answers["/api/status/runtime"] = { body: { data: RUNTIME } };
    render(withQuery(<SystemPage />));
    await screen.findByText("/home/me/patterstage/data");

    expect(screen.queryByText(/Read-only is on, so a backup cannot be taken from here\./)).toBeNull();
  });
});

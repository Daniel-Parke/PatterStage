/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group restore (T-0100), the page half.
//
// Written before the product code moved. Contract section 6 (Restore), the
// page lines, against src/app/agent/settings/restore/page.tsx:
//
//   * the numbers on the page come from the PACK (GET /api/seed's `pack`),
//     never from how many rows the database happens to hold, and the
//     install's own figures read "Installed now: n of 7 agents · m of 12
//     templates";
//   * a failed read is a LoadErrorBanner "Couldn't read the restore status"
//     with a Retry that re-issues the three GETs, and no empty state over it;
//   * the empty states, only after a successful read;
//   * the sync words are the status vocabulary (In sync / Out of sync /
//     Failed), and the old "Synced" / "Drift — disk differs …" are gone;
//   * every overwrite is a ConfirmButton: one click arms and posts nothing,
//     the armed label is the question, the second click posts; "Add what's
//     missing" and "Look for test data" are one click;
//   * a shared busy disables the other buttons while the acting one loads;
//   * what happened is said twice: a result line under the section that ran
//     (`[data-testid="restore-result"]`, role status, "Done at HH:MM: …") and
//     a toast, and a failure is "Restore failed: {message}" plus an error
//     toast;
//   * the copy: the subtitle, the one intro line, the mechanics behind
//     <details><summary>How this works</summary>, the section headings,
//     "Last restored:" localised, no em dash, no HERMES_HOME literal.
//
// The reds here are the implementation's to-do list. The scaffolding is the
// b3-settings-index pattern (next/navigation, next/link, AppPageShell) plus
// the URL-keyed fetch double from b3-system-page-and-rail.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/settings/restore",
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

import RestorePage from "@/app/agent/settings/restore/page";
import { SETTINGS_TOOLS } from "@/lib/config-sections";

// ── fixtures ────────────────────────────────────────────────────

const PACK = {
  catalogVersion: "patterstage-professional-v1",
  root: 1,
  profiles: 7,
  templates: 12,
  categories: 8,
  skills: 4,
  tools: 5,
  memories: 5,
};

const LAST_RUN = "2026-09-01T10:00:00.000Z";

const BOB = { id: "default", name: "Bob", isDefault: true, isBundled: false, syncStatus: "synced" };
const MINE = { id: "mine", name: "My own agent", isDefault: false, isBundled: false, syncStatus: "synced" };
const BUNDLED = [
  { id: "qa", name: "QA Engineer", isDefault: false, isBundled: true, syncStatus: "drift" },
  { id: "swe", name: "Software Engineer", isDefault: false, isBundled: true, syncStatus: "synced" },
  {
    id: "devops",
    name: "DevOps",
    isDefault: false,
    isBundled: true,
    syncStatus: "error",
    syncError: "ENOENT: memories/USER.md",
  },
];

const CUSTOM_TEMPLATE = { id: "custom-1", name: "Mine", seedKey: null, isCustom: true };
const SEEDED_TEMPLATES = [
  { id: "bug-hunt", name: "Bug hunt", seedKey: "ch.tpl.bug-hunt", isCustom: false },
  { id: "general-task", name: "General task", seedKey: "ch.tpl.general-task", isCustom: false },
];

const SEED_RESULT = {
  root: 1,
  profiles: 7,
  templates: 12,
  categories: 8,
  skills: 4,
  tools: 5,
  memories: 5,
  pushed: 8,
};

const SNAPSHOT = {
  name: "patterstage.pre-restore.20260905T101500Z.db",
  path: "/home/me/patterstage/data/backups/db/patterstage.pre-restore.20260905T101500Z.db",
  bytes: 425984,
  takenAt: "2026-09-05T10:15:00.000Z",
  kind: "snapshot",
};

const CLEAN_PREVIEW = {
  workflows: [
    { id: "w1", label: "Testy" },
    { id: "w2", label: "Test flow" },
  ],
  stories: [
    { id: "s1", label: "Untitled Story" },
    { id: "s2", label: "Test Story 2026" },
  ],
  missions: [{ id: "m1", label: "Test mission" }],
};

const EM_DASH = "—";

// ── the fetch double ────────────────────────────────────────────

type Answer = { status?: number; body: unknown } | (() => Promise<{ status?: number; body: unknown }>);
type Route = string; // "METHOD /path"
let answers: Record<Route, Answer> = {};
const calls: Array<{ method: string; path: string; body: unknown }> = [];

function installFetch() {
  calls.length = 0;
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const answer = answers[`${method} ${path}`];
    const a = answer
      ? typeof answer === "function"
        ? await answer()
        : answer
      : { status: 404, body: { error: `no stub for ${method} ${path}` } };
    return new Response(JSON.stringify(a.body), {
      status: a.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const gets = (path: string) => calls.filter((c) => c.method === "GET" && c.path === path).length;
const posts = () => calls.filter((c) => c.method === "POST");

function stubReads(opts: {
  profiles?: unknown[];
  templates?: unknown[];
  pack?: unknown;
  state?: unknown;
} = {}) {
  answers["GET /api/seed"] = { body: { data: { state: opts.state === undefined ? { lastRun: LAST_RUN } : opts.state, pack: opts.pack ?? PACK } } };
  answers["GET /api/agent/profiles"] = { body: { data: { profiles: opts.profiles ?? [BOB, MINE, ...BUNDLED] } } };
  answers["GET /api/templates"] = { body: { data: { templates: opts.templates ?? [CUSTOM_TEMPLATE, ...SEEDED_TEMPLATES] } } };
}

async function renderLoaded() {
  render(<RestorePage />);
  await screen.findByRole("heading", { name: "Professional agents" });
}

/** Everything on the page that is NOT inside a <details>. */
function textOutsideDetails(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details").forEach((d) => d.remove());
  return clone.textContent ?? "";
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  answers = {};
  stubReads();
  answers["POST /api/seed"] = { body: { data: { ...SEED_RESULT, imported: null, backup: SNAPSHOT } } };
  answers["GET /api/seed/clean"] = { body: { data: { preview: CLEAN_PREVIEW } } };
  answers["POST /api/seed/clean"] = {
    body: {
      data: {
        removed: CLEAN_PREVIEW,
        counts: { workflows: 2, stories: 2, missions: 1, total: 5 },
        backup: { ...SNAPSHOT, name: "patterstage.pre-clean.20260905T101500Z.db" },
      },
    },
  };
  installFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ───────────────────────────────────────────────────────────────
// the numbers come from the pack
// ───────────────────────────────────────────────────────────────

describe("the counts on the page are the pack's, not the database's", () => {
  it("says what Restore everything puts back, from GET /api/seed's pack", async () => {
    await renderLoaded();
    expect(
      screen.getByText(
        "Puts back Bob, 7 professional agents, 12 mission templates, 8 categories, 4 skills, 5 tool bundles and 5 memory facts, overwriting any changes you made to them.",
      ),
    ).toBeInTheDocument();
  });

  it("reads the install's own figures as 'Installed now: n of 7 agents · m of 12 templates'", async () => {
    await renderLoaded();
    expect(screen.getByText("Installed now: 3 of 7 agents · 2 of 12 templates")).toBeInTheDocument();
  });

  it("never says '0 professional agents' on an empty install: the shipped figure is the pack's", async () => {
    stubReads({ profiles: [BOB], templates: [] });
    render(<RestorePage />);
    // The intro line and the section sentence both carry "7 professional
    // agents", so a getByText on it would find two elements. The line that is
    // unique is the installed figure.
    await screen.findByText("Installed now: 0 of 7 agents · 0 of 12 templates");
    expect(document.body.textContent).toContain("7 professional agents");
    expect(document.body.textContent).toContain("12 mission templates");
    expect(document.body.textContent).not.toContain("0 professional agents");
  });

  it("follows the pack when the pack changes, and the installed figure when that changes", async () => {
    stubReads({
      profiles: [BOB, BUNDLED[0]],
      templates: [SEEDED_TEMPLATES[0]],
      pack: { ...PACK, profiles: 9, templates: 3 },
    });
    render(<RestorePage />);
    await screen.findByText("Installed now: 1 of 9 agents · 1 of 3 templates");
    expect(document.body.textContent).toContain("9 professional agents");
    expect(document.body.textContent).toContain("3 mission templates");
  });
});

// ───────────────────────────────────────────────────────────────
// the read contract
// ───────────────────────────────────────────────────────────────

describe("a failed read", () => {
  it("shows the banner with Retry, and Retry re-issues the three GETs", async () => {
    answers["GET /api/seed"] = { status: 500, body: { error: "the database is locked" } };
    render(<RestorePage />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read the restore status");
    const retry = within(alert).getByRole("button", { name: /retry/i });
    expect(gets("/api/seed")).toBe(1);
    expect(gets("/api/agent/profiles")).toBe(1);
    expect(gets("/api/templates")).toBe(1);
    fireEvent.click(retry);
    await waitFor(() => expect(gets("/api/seed")).toBe(2));
    expect(gets("/api/agent/profiles")).toBe(2);
    expect(gets("/api/templates")).toBe(2);
  });

  it("renders no empty state over the failure", async () => {
    answers["GET /api/agent/profiles"] = { status: 500, body: { error: "the database is locked" } };
    render(<RestorePage />);
    await screen.findByRole("alert");
    expect(screen.queryByText("No professional agents installed")).toBeNull();
    expect(screen.queryByText("No mission templates installed")).toBeNull();
  });

  it("recovers: after Retry succeeds the banner is gone and the lists render", async () => {
    let failOnce = true;
    answers["GET /api/seed"] = async () => {
      if (failOnce) {
        failOnce = false;
        return { status: 500, body: { error: "the database is locked" } };
      }
      return { body: { data: { state: { lastRun: LAST_RUN }, pack: PACK } } };
    };
    render(<RestorePage />);
    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await screen.findByText("QA Engineer");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the empty states, only after a successful read", () => {
  it("says no professional agents are installed and how to get the 7", async () => {
    stubReads({ profiles: [BOB, MINE] });
    render(<RestorePage />);
    await screen.findByText("No professional agents installed");
    expect(screen.getByText("Restore everything to install the 7 the pack ships.")).toBeInTheDocument();
  });

  it("says no mission templates are installed and how to get the 12", async () => {
    stubReads({ templates: [CUSTOM_TEMPLATE] });
    render(<RestorePage />);
    await screen.findByText("No mission templates installed");
    expect(screen.getByText("Restore everything to install the 12 the pack ships.")).toBeInTheDocument();
  });

  it("GREEN CONTROL: Bob and a custom agent are not professional agents; a custom template is not a seeded one", async () => {
    await renderLoaded();
    expect(screen.queryByText("My own agent")).toBeNull();
    expect(screen.queryByText("Mine")).toBeNull();
    // Loose on the name so a per-row aria-label ("Restore agent QA Engineer",
    // which the page carries today and which is better for a screen reader)
    // reads the same as the bare visible label.
    expect(screen.getAllByRole("button", { name: /^Restore (this agent|agent )/ })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^Restore($| the )/ })).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────
// the sync words
// ───────────────────────────────────────────────────────────────

describe("the sync words are the status vocabulary", () => {
  it("drift reads 'Out of sync', synced 'In sync', error 'Failed' with the reason after it", async () => {
    await renderLoaded();
    expect(screen.getByText("Out of sync")).toBeInTheDocument();
    expect(screen.getByText("In sync")).toBeInTheDocument();
    expect(screen.getByText(/^Failed/)).toBeInTheDocument();
    expect(screen.getByText(/ENOENT: memories\/USER\.md/)).toBeInTheDocument();
  });

  it("the old words are gone", async () => {
    await renderLoaded();
    expect(screen.queryByText("Synced")).toBeNull();
    expect(document.body.textContent).not.toContain("Drift — disk differs from database");
    expect(document.body.textContent).not.toContain("Drift");
    expect(document.body.textContent).not.toContain("Sync error:");
  });
});

// ───────────────────────────────────────────────────────────────
// the two-click rule
// ───────────────────────────────────────────────────────────────

describe("every overwrite is two clicks", () => {
  const cases: Array<{
    label: string;
    find: () => HTMLElement;
    armed: string;
    body: Record<string, unknown>;
  }> = [
    {
      label: "Restore everything",
      find: () => screen.getByRole("button", { name: "Restore everything" }),
      armed: "Restore everything?",
      body: { target: "all", mode: "replace" },
    },
    {
      label: "Restore Bob",
      find: () => screen.getByRole("button", { name: "Restore Bob" }),
      armed: "Restore Bob?",
      body: { target: "root", mode: "replace" },
    },
    {
      label: "Restore this agent",
      find: () => screen.getAllByRole("button", { name: /^Restore (this agent|agent )/ })[0],
      armed: "Restore QA Engineer?",
      body: { target: "profiles", mode: "replace", slug: "qa" },
    },
    {
      label: "Restore (a template)",
      find: () => screen.getAllByRole("button", { name: /^Restore($| the )/ })[0],
      armed: "Restore?",
      body: { target: "templates", mode: "replace", templateId: "bug-hunt" },
    },
    {
      label: "Restore categories",
      find: () => screen.getByRole("button", { name: "Restore categories" }),
      armed: "Restore categories?",
      body: { target: "categories", mode: "replace" },
    },
  ];

  it.each(cases)("$label: the first click arms and posts nothing, the second posts", async ({ find, armed, body }) => {
    await renderLoaded();
    const button = find();
    fireEvent.click(button);
    expect(posts()).toHaveLength(0);
    expect(button).toHaveTextContent(armed);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toEqual({ method: "POST", path: "/api/seed", body });
  });

  it("'Add what's missing' is one click and merges", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Add what's missing" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toEqual({ method: "POST", path: "/api/seed", body: { target: "all", mode: "merge" } });
  });

  it("'Look for test data' looks first, then 'Remove 5 items' asks 'Remove 5 items?' before it removes", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Look for test data" }));
    const remove = await screen.findByRole("button", { name: "Remove 5 items" });
    expect(gets("/api/seed/clean")).toBe(1);
    expect(posts()).toHaveLength(0);
    fireEvent.click(remove);
    expect(remove).toHaveTextContent("Remove 5 items?");
    expect(remove).not.toBeDisabled();
    expect(posts()).toHaveLength(0);
    fireEvent.click(remove);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].path).toBe("/api/seed/clean");
  });

  it("the old single-click labels are gone", async () => {
    await renderLoaded();
    for (const gone of [
      "Restore entire default catalog",
      "Restore Bob only",
      "Merge missing defaults",
      "Scan for test data",
      "Click again to confirm",
    ]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it("while one restore runs, the acting button loads and the others are disabled", async () => {
    let release: (() => void) | null = null;
    answers["POST /api/seed"] = () =>
      new Promise((resolve) => {
        release = () => resolve({ body: { data: { ...SEED_RESULT, imported: null, backup: null } } });
      });
    await renderLoaded();
    const bob = screen.getByRole("button", { name: "Restore Bob" });
    fireEvent.click(bob);
    fireEvent.click(bob);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Restore everything" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add what's missing" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Restore this agent" })[0]).toBeDisabled();
    // The acting one is the loading one: Button renders its spinner for `loading`.
    const acting = screen.getByRole("button", { name: /Restore Bob/ });
    expect(acting).toBeDisabled();
    expect(acting.querySelector('svg[data-icon="Loader2"]')).not.toBeNull();
    await act(async () => {
      release!();
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore everything" })).not.toBeDisabled());
  });
});

// ───────────────────────────────────────────────────────────────
// what happened
// ───────────────────────────────────────────────────────────────

describe("the result line and the toast", () => {
  const SUMMARY =
    "Restored Bob, 7 agents, 12 templates, 8 categories, 4 skills, 5 tool bundles and 5 memory facts · pushed 8 agents to Hermes · backup saved: " +
    SNAPSHOT.path;

  it("says what Restore everything did, under the section, as 'Done at HH:MM: …'", async () => {
    await renderLoaded();
    const button = screen.getByRole("button", { name: "Restore everything" });
    fireEvent.click(button);
    fireEvent.click(button);
    const line = await screen.findByTestId("restore-result");
    expect(line).toHaveAttribute("role", "status");
    // JS \s covers the NARROW NO-BREAK SPACE an en-US runner puts before AM/PM.
    expect(line.textContent).toMatch(/^Done at \d{1,2}:\d{2}(?:\s?[AP]M)?: /);
    expect(line.textContent).toContain(SUMMARY);
    const section = line.closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByRole("heading", { name: "Restore everything" })).toBeInTheDocument();
  });

  it("toasts the same summary", async () => {
    await renderLoaded();
    const button = screen.getByRole("button", { name: "Restore everything" });
    fireEvent.click(button);
    fireEvent.click(button);
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent(SUMMARY);
    expect(toast).toHaveAttribute("role", "status");
  });

  it("names the agent when one agent was restored", async () => {
    answers["POST /api/seed"] = {
      body: { data: { ...SEED_RESULT, profiles: 1, pushed: 1, imported: null, backup: null } },
    };
    await renderLoaded();
    const button = screen.getAllByRole("button", { name: "Restore this agent" })[0];
    fireEvent.click(button);
    fireEvent.click(button);
    const line = await screen.findByTestId("restore-result");
    expect(line.textContent).toContain("Restored QA Engineer and pushed it to Hermes");
  });

  it("says nothing was missing after a merge that added nothing", async () => {
    answers["POST /api/seed"] = {
      body: {
        data: {
          root: 0,
          profiles: 0,
          templates: 0,
          categories: 8,
          skills: 0,
          tools: 0,
          memories: 5,
          pushed: 0,
          imported: null,
          backup: null,
        },
      },
    };
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Add what's missing" }));
    const line = await screen.findByTestId("restore-result");
    expect(line.textContent).toContain("Nothing was missing: everything the pack ships is already installed.");
  });

  it("counts what the clean removed", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Look for test data" }));
    const remove = await screen.findByRole("button", { name: "Remove 5 items" });
    fireEvent.click(remove);
    fireEvent.click(remove);
    await waitFor(() =>
      expect(document.body.textContent).toContain("Removed 5 items (2 workflows, 2 stories, 1 mission)"),
    );
  });

  it("a refused restore is 'Restore failed: {message}' inline and an error toast", async () => {
    answers["POST /api/seed"] = {
      status: 500,
      body: { error: "Refused: could not take a backup before restoring (disk full)" },
    };
    await renderLoaded();
    const button = screen.getByRole("button", { name: "Restore Bob" });
    fireEvent.click(button);
    fireEvent.click(button);
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveAttribute("role", "alert");
    expect(toast).toHaveTextContent("Refused: could not take a backup before restoring (disk full)");
    const inline = screen
      .getAllByRole("alert")
      .find((el) => el.getAttribute("data-testid") !== "toast");
    expect(inline).toBeDefined();
    expect(inline).toHaveTextContent("Restore failed: Refused: could not take a backup before restoring (disk full)");
    expect(screen.queryByTestId("restore-result")).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────
// the copy
// ───────────────────────────────────────────────────────────────

describe("the copy", () => {
  it("has the subtitle and the one intro line", async () => {
    await renderLoaded();
    expect(screen.getByText("Put back what PatterStage ships, or clear out test clutter")).toBeInTheDocument();
    expect(
      screen.getByText(
        "PatterStage ships a starter set: Bob (the default agent), 7 professional agents, 12 mission templates, 8 mission categories, 4 skills, 5 tool bundles and 5 memory facts. Use this page to put any of it back. Anything you restore is backed up first.",
      ),
    ).toBeInTheDocument();
  });

  it("names its sections: Restore everything, Professional agents, Mission templates, Categories, Clear test clutter", async () => {
    await renderLoaded();
    for (const name of ["Restore everything", "Professional agents", "Mission templates", "Categories", "Clear test clutter"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: /Reseed all/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Clean dev/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /advanced/i })).toBeNull();
  });

  it("keeps the mechanics behind <details><summary>How this works</summary>", async () => {
    await renderLoaded();
    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.querySelector("summary")).toHaveTextContent("How this works");
  });

  it("never shows the operator-register strings outside the details", async () => {
    await renderLoaded();
    const outside = textOutsideDetails();
    for (const jargon of [
      "import-hermes-state",
      "merge seed",
      "Reseed all",
      "Import before seed",
      "Restore entire default catalog",
    ]) {
      expect({ jargon, shown: outside.includes(jargon) }).toEqual({ jargon, shown: false });
    }
  });

  it("uses no em dash and no HERMES_HOME or .hermes/ literal anywhere on the page", async () => {
    await renderLoaded();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain(EM_DASH);
    expect(text).not.toContain("HERMES_HOME");
    expect(text).not.toContain(".hermes/");
  });

  it("says 'Last restored:' with a localised time, not the raw ISO string", async () => {
    await renderLoaded();
    expect(screen.getByText(`Last restored: ${new Date(LAST_RUN).toLocaleString()}`)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(LAST_RUN);
    expect(document.body.textContent).not.toContain("Last run:");
  });

  it("says nothing about a last restore when the seed has never run", async () => {
    stubReads({ state: null });
    await renderLoaded();
    expect(screen.queryByText(/Last restored:/)).toBeNull();
  });

  it("the Settings index card describes Restore in the same register", () => {
    const card = SETTINGS_TOOLS.find((t) => t.href === "/agent/settings/restore");
    expect(card?.description).toBe("Put back the starter set, restore one agent's defaults, clear out test clutter");
  });
});

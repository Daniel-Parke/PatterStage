/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- the source reads are structural assertions, loaded where they are used */

// ═══════════════════════════════════════════════════════════════
// B8 oracle, the browser half (T-0102, D21, D23, D25, D27, and the copy).
//
// Written before the product code moved.
//
//   D21  Every save and every sync blanks the page. loadProfiles sets
//        loading=true and the component early-returns a full-page spinner, so
//        saving SOUL.md replaces the header, the list, the selection and the
//        open editor with "Loading profiles...". The refetch is right; making
//        the operator watch it is not.
//   D23  Unsaved edits are discarded in silence. Selecting another profile
//        closes the editor, and opening another file overwrites the buffer,
//        with no check on the dirty flag that is computed two lines away and
//        already drives an "Unsaved" badge.
//   D25  PUT /api/agent/profiles/[id] implements a careful rename and has no
//        caller anywhere in the product: a profile's name and description can
//        never be changed after creation.
//   D27  syncError and syncedAt are computed, stored, returned on every row,
//        and rendered nowhere. The operator sees an orange "Sync error" badge
//        with no error and no idea when the profile last reached Hermes.
//   copy The identity block leads with file names and the growth panel cites
//        an ADR. Both are for the maintainer, not the operator.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
// The growth panel fetches its own experience; it is not what this file measures.
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
import AgentProfileList from "@/components/agents/AgentProfileList";
import type { AgentProfile } from "@/types/console";

// ── fixtures ────────────────────────────────────────────────────

function file(key: string, name: string, exists = true) {
  return { key, name, path: `/tmp/${name}`, exists, size: exists ? 42 : 0, lastModified: null };
}

const BOB: AgentProfile = {
  id: "default",
  name: "Bob (local default)",
  description: "The agent missions and chat use when no profile is chosen",
  isDefault: true,
  isBundled: false,
  personality: "warm",
  skillsCount: 4,
  syncStatus: "synced",
  syncError: null,
  syncedAt: "2026-09-05T09:00:00.000Z",
  files: [file("soul", "SOUL.md"), file("agent", "AGENTS.md"), file("config", "config.yaml")],
} as unknown as AgentProfile;

const QA: AgentProfile = {
  id: "qa",
  name: "QA Engineer",
  description: "Reproduction and test-driven fixes",
  isDefault: false,
  isBundled: true,
  personality: "technical",
  skillsCount: 3,
  syncStatus: "error",
  syncError: "ENOENT: memories/USER.md. Restore the file, then Pull from Hermes.",
  syncedAt: "2026-09-04T08:30:00.000Z",
  files: [file("soul", "SOUL.md"), file("agent", "AGENTS.md")],
} as unknown as AgentProfile;

/** AgentSetupNotice reads through react-query, which needs its provider. */
function withQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

/** Every path the page asked for, in order. */
const paths = () => mockApiFetch.mock.calls.map((c) => String(c[0]));

function answerReads(profiles: AgentProfile[] = [BOB, QA], soul = "# Bob\n\nOriginal.\n") {
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/api/agent/profiles" && !init?.method) return { data: { profiles } };
    if (path.startsWith("/api/agent/files/")) return { data: { content: soul } };
    return { data: { success: true } };
  });
}

/**
 * Open one of the selected profile's files. The row's button is what opens it
 * (the file name itself is not clickable), and the row is the button's parent,
 * so the file name is in that parent's text.
 */
async function openProfileFile(name: string): Promise<void> {
  const buttons = await screen.findAllByRole("button", { name: /^(Edit|Create)$/ });
  const target = buttons.find((b) => (b.parentElement?.textContent ?? "").includes(name));
  if (!target) throw new Error(`no row button for ${name}`);
  fireEvent.click(target);
  // The open is a fetch; the editor card is what proves it landed.
  await screen.findByRole("button", { name: /^Save$/ });
}

/**
 * Leave preview mode and return the textarea the editor card then shows.
 *
 * Every existing file's row carries an "Edit" button too, and clicking those
 * opens a DIFFERENT file, so walking the list of them raced an in-flight open
 * against the buffer this helper is here to hand back. The editor card is
 * rendered after the file list, so its own preview toggle is the last one.
 */
async function leavePreview(): Promise<HTMLElement> {
  const toggles = await screen.findAllByRole("button", { name: /^Edit$/ });
  fireEvent.click(toggles[toggles.length - 1]);
  const box = screen.queryByLabelText("File content");
  if (!box) throw new Error("the editor's Edit toggle did not reveal the file content textarea");
  return box;
}

async function renderLoaded() {
  render(withQuery(<AgentsPage />));
  await screen.findByText("QA Engineer");
  // The list arrives one render before the auto-selection does, and the
  // detail column is what most of this file is about.
  await waitFor(() => expect(screen.queryByText("Select a profile")).toBeNull());
}

beforeEach(() => {
  jest.clearAllMocks();
  answerReads();
});

// ═══════════════════════════════════════════════════════════════
// D21: the page stops blanking
// ═══════════════════════════════════════════════════════════════

describe("a refetch after a mutation is silent", () => {
  it("saving a file leaves the list, the selection and the editor on screen", async () => {
    await renderLoaded();
    await openProfileFile("SOUL.md");
    // Save is disabled until there is something to save, so type first.
    const box = await leavePreview();
    fireEvent.change(box, { target: { value: "# Bob, edited before saving" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    });

    // The refetch happened, and nothing was replaced by a spinner.
    await waitFor(() => expect(paths().filter((p) => p === "/api/agent/profiles").length).toBe(2));
    expect(screen.getByText("QA Engineer")).toBeInTheDocument();
    expect(screen.queryByText(/Loading profiles/i)).toBeNull();
  });

  it("GREEN CONTROL: the FIRST load still shows the spinner", async () => {
    let release: ((v: unknown) => void) | null = null;
    mockApiFetch.mockImplementation(
      (path: string) =>
        path === "/api/agent/profiles"
          ? new Promise((resolve) => {
              release = () => resolve({ data: { profiles: [BOB, QA] } });
            })
          : Promise.resolve({ data: { content: "" } }),
    );

    render(withQuery(<AgentsPage />));

    expect((await screen.findAllByText(/Loading profiles/i)).length).toBeGreaterThan(0);
    await act(async () => {
      release?.(null);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// D23: unsaved work is not thrown away in silence
// ═══════════════════════════════════════════════════════════════

describe("a discard asks first", () => {
  /** Open Bob's SOUL.md, leave preview, and type something unsaved. */
  async function openAndEdit() {
    await renderLoaded();
    await openProfileFile("SOUL.md");
    const box = await leavePreview();
    fireEvent.change(box, { target: { value: "# Bob, edited and unsaved" } });
    return box;
  }

  it("selecting another profile keeps the edit and asks", async () => {
    await openAndEdit();

    fireEvent.click(screen.getByText("QA Engineer"));

    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep editing/i })).toBeInTheDocument();
    expect((screen.getByLabelText("File content") as HTMLTextAreaElement).value).toMatch(/edited and unsaved/);
  });

  it("Keep editing leaves the buffer exactly as it was", async () => {
    await openAndEdit();
    fireEvent.click(screen.getByText("QA Engineer"));
    await screen.findByText(/unsaved changes/i);

    fireEvent.click(screen.getByRole("button", { name: /Keep editing/i }));

    expect(screen.queryByText(/unsaved changes/i)).toBeNull();
    expect((screen.getByLabelText("File content") as HTMLTextAreaElement).value).toMatch(/edited and unsaved/);
  });

  it("Discard changes goes through with what was asked for", async () => {
    await openAndEdit();
    fireEvent.click(screen.getByText("QA Engineer"));
    await screen.findByText(/unsaved changes/i);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Discard changes/i }));
    });

    await waitFor(() => expect(screen.queryByLabelText("File content")).toBeNull());
    expect(screen.queryByText(/unsaved changes/i)).toBeNull();
  });

  it("GREEN CONTROL: with nothing edited, selecting another profile just works", async () => {
    await renderLoaded();
    await openProfileFile("SOUL.md");
    await leavePreview();

    fireEvent.click(screen.getByText("QA Engineer"));

    expect(screen.queryByText(/unsaved changes/i)).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText("File content")).toBeNull());
  });
});

// ═══════════════════════════════════════════════════════════════
// D25: a profile can be renamed
// ═══════════════════════════════════════════════════════════════

describe("a profile's name and description can be edited", () => {
  /** Every PUT body the page sent, with its path. */
  const puts = () =>
    mockApiFetch.mock.calls
      .filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT")
      .map(([path, init]) => ({ path: String(path), body: JSON.parse(String((init as { body: string }).body)) }));

  it("the header offers Edit, which sends name and description to the profile route", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("QA Engineer"));

    fireEvent.click(await screen.findByRole("button", { name: /Edit profile/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Name/i), { target: { value: "QA Lead" } });
    fireEvent.change(within(dialog).getByLabelText(/Description/i), { target: { value: "Owns the gate" } });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /^Save/i }));
    });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].path).toBe("/api/agent/profiles/qa");
    expect(puts()[0].body).toEqual({ name: "QA Lead", description: "Owns the gate" });
  });

  it("the root agent is renamed through its own route, which touches no files", async () => {
    await renderLoaded();
    // Bob is selected first by default.
    fireEvent.click(await screen.findByRole("button", { name: /Edit profile/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Name/i), { target: { value: "Atlas" } });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /^Save/i }));
    });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].path).toBe("/api/agent/root");
    expect(puts()[0].body).toMatchObject({ displayName: "Atlas" });
  });
});

// ═══════════════════════════════════════════════════════════════
// D27: the sync facts are on screen
// ═══════════════════════════════════════════════════════════════

describe("what the list says about syncing", () => {
  it("a failed sync shows the reason, not just the word", () => {
    render(<AgentProfileList profiles={[BOB, QA]} selectedProfileId="qa" onSelect={jest.fn()} />);

    expect(screen.getByText(/ENOENT: memories\/USER\.md/)).toBeInTheDocument();
  });

  it("a synced profile says when it last reached Hermes", () => {
    render(<AgentProfileList profiles={[BOB, QA]} selectedProfileId="default" onSelect={jest.fn()} />);

    expect(screen.getAllByText(/Last pushed/i).length).toBeGreaterThanOrEqual(1);
  });

  it("a profile that has never been pushed says so rather than nothing", () => {
    const fresh = { ...QA, id: "new", name: "New", syncStatus: "synced", syncError: null, syncedAt: null };
    render(
      <AgentProfileList
        profiles={[fresh as unknown as AgentProfile]}
        selectedProfileId="new"
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText(/Never pushed/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// The copy an operator meets first
// ═══════════════════════════════════════════════════════════════

describe("the identity block is written for the operator", () => {
  it("the file-name note is behind a disclosure, not the first thing on the card", async () => {
    await renderLoaded();

    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.textContent).toMatch(/SOUL\.md/);
    // Outside the disclosure, the card leads with what the agent IS.
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("details").forEach((d) => d.remove());
    expect(clone.textContent).not.toMatch(/skills\.disabled/);
    expect(clone.textContent).not.toMatch(/platform_toolsets/);
  });

  it("no ADR reference reaches the operator", () => {
    const { readFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const panel = readFileSync(
      join(__dirname, "..", "..", "src", "components", "agents", "AgentGrowthPanel.tsx"),
      "utf-8",
    );
    // The rendered copy, not the header comment: the comment explaining WHY
    // the number is what it is belongs in the file.
    const rendered = panel.slice(panel.indexOf("return ("));

    expect(rendered).not.toMatch(/ADR-0004/);
    expect(rendered).not.toMatch(/not implemented/);
  });
});

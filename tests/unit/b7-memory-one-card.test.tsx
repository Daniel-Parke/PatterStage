/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B7 oracle, group provider-switch, the browser half (T-0101, D58, D65, and
// the plan's "two stacked first-visit warnings collapse into one card").
//
// Written before the product code moved. Contract sections 1 and 2:
//
//   * Test connection reads the envelope it is actually sent. `ok({ health })`
//     is `{ data: { health } }` and safeApiCall hands back the RAW body in
//     `.data`, so the component's `res.data.health` is always undefined and
//     every probe, against a healthy Hindsight, reported failure (D58);
//   * Save sends the loaded row's type and label instead of the literals
//     "hindsight" / "Hindsight", and asks for activation only when the row was
//     not already active, so editing the port on a holographic install stops
//     silently switching the provider (D65);
//   * a first visit with nothing listening shows ONE card, headed "Set up
//     memory", carrying the health sentence once. The "built-in default"
//     warning is for a store that ANSWERED and may be someone else's; the two
//     never appear together.
//
// The page is rendered for the one-card rules, because the two warnings live in
// two components and "only one of them" is a page-level fact. AppPageShell,
// PageHeader and next/navigation are stood in for as b6-restore-page does.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/memory",
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

const mockSafeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  safeApiCall: (...a: unknown[]) => mockSafeApiCall(...a),
}));

import MemoryProviderSettings from "@/components/memory/MemoryProviderSettings";
import MemoryPage from "@/app/agent/memory/page";

// ── doubles ─────────────────────────────────────────────────────

interface ProviderRow {
  type: string;
  label: string;
  isActive: boolean;
  confirmed: boolean;
}

/** GET /api/memory/config, in the envelope the route really sends. */
function configPayload(rows: ProviderRow[], host = "127.0.0.1", port = 9177) {
  const active = rows.find((r) => r.isActive) ?? rows[0];
  return {
    ok: true,
    data: {
      data: {
        active: { type: active?.type ?? "hindsight", config: { host, port, bank: "hermes" } },
        providers: rows,
      },
    },
  };
}

const HINDSIGHT_ACTIVE: ProviderRow[] = [
  { type: "hindsight", label: "Hindsight", isActive: true, confirmed: true },
];
const HOLOGRAPHIC_ACTIVE: ProviderRow[] = [
  { type: "holographic", label: "Holographic", isActive: true, confirmed: true },
  { type: "hindsight", label: "Hindsight", isActive: false, confirmed: true },
];

/** POST /api/memory/config, likewise two levels deep. */
function healthPayload(available: boolean, status = "healthy") {
  return { ok: true, data: { data: { health: { available, status } } } };
}

/** The PUT body the component sent, parsed. */
function putBodies(): Array<Record<string, unknown>> {
  return mockSafeApiCall.mock.calls
    .filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT")
    .map(([, init]) => (init as { body: Record<string, unknown> }).body);
}

// The card and the memory browser both go through safeApiCall, so the double
// routes by path: a queue for /api/memory/config, one standing answer for the
// store itself.
let configQueue: unknown[] = [];
// What the store route really answers with nothing listening: 200 and an
// honest body, which is what turns into the plain-English banner sentence.
const STORE_DOWN = { ok: true, data: { data: { available: false, error: "fetch failed", memories: [] } } };
let storeAnswer: unknown = STORE_DOWN;

/** What /api/memory/config answers, in order. */
function answerWith(...responses: unknown[]) {
  configQueue = [...responses];
}

/** The store is up, and empty. */
function storeIsUp() {
  storeAnswer = { ok: true, data: { data: { memories: [], total: 0, mode: "ok", available: true } } };
}

/** A card button, once the card has read the row it is about to act on. */
async function loadedButton(name: RegExp): Promise<HTMLElement> {
  const button = await screen.findByRole("button", { name });
  await waitFor(() => expect(button).not.toBeDisabled());
  return button;
}
const loadedSaveButton = () => loadedButton(/^Save$/);

beforeEach(() => {
  jest.clearAllMocks();
  configQueue = [];
  // Nothing listening: the first-visit state most of this file is about.
  storeAnswer = STORE_DOWN;
  mockSafeApiCall.mockImplementation(async (path: unknown) => {
    if (String(path).includes("/api/memory/hindsight")) return storeAnswer;
    return configQueue.shift() ?? { ok: true, data: { data: {} } };
  });
});

// ═══════════════════════════════════════════════════════════════
// D58: Test connection
// ═══════════════════════════════════════════════════════════════

describe("Test connection believes a healthy answer", () => {
  it("reads health through both envelope levels and reports Connected", async () => {
    answerWith(configPayload(HINDSIGHT_ACTIVE), healthPayload(true, "ok"));
    render(<MemoryProviderSettings />);
    const probe = await loadedButton(/Test connection/i);

    await act(async () => {
      fireEvent.click(probe);
    });

    expect(await screen.findByText(/Connected \(ok\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Connection test failed/)).toBeNull();
  });

  it("an unavailable answer reports the reason it carried, not a generic failure", async () => {
    answerWith(configPayload(HINDSIGHT_ACTIVE), {
      ok: true,
      data: { data: { health: { available: false, error: "connection refused" } } },
    });
    render(<MemoryProviderSettings />);
    const probe = await loadedButton(/Test connection/i);

    await act(async () => {
      fireEvent.click(probe);
    });

    expect(await screen.findByText("connection refused")).toBeInTheDocument();
  });

  it("GREEN CONTROL: a refused call still falls back to the route's error", async () => {
    answerWith(configPayload(HINDSIGHT_ACTIVE), { ok: false, error: "the database is locked" });
    render(<MemoryProviderSettings />);
    const probe = await loadedButton(/Test connection/i);

    await act(async () => {
      fireEvent.click(probe);
    });

    expect(await screen.findByText("the database is locked")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D65: Save keeps the row it loaded
// ═══════════════════════════════════════════════════════════════

describe("Save edits the active provider, it does not replace it", () => {
  it("a holographic install saves as holographic, with its own label", async () => {
    answerWith(configPayload(HOLOGRAPHIC_ACTIVE), { ok: true, data: { data: {} } }, healthPayload(true));
    render(<MemoryProviderSettings />);
    const save = await loadedSaveButton();

    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => expect(putBodies()).toHaveLength(1));
    expect(putBodies()[0]).toMatchObject({ type: "holographic", label: "Holographic" });
    expect(putBodies()[0].type).not.toBe("hindsight");
  });

  it("an already-active row is not re-activated", async () => {
    // makeActive rewrites every other row's is_active. Sending it for a row
    // that is already active is a write nobody asked for.
    answerWith(configPayload(HOLOGRAPHIC_ACTIVE), { ok: true, data: { data: {} } }, healthPayload(true));
    render(<MemoryProviderSettings />);
    const save = await loadedSaveButton();

    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => expect(putBodies()).toHaveLength(1));
    expect(putBodies()[0].makeActive).not.toBe(true);
  });

  it("a row that is NOT active is activated by Save", async () => {
    answerWith(
      configPayload([{ type: "hindsight", label: "Hindsight", isActive: false, confirmed: false }]),
      { ok: true, data: { data: {} } },
      healthPayload(true),
    );
    render(<MemoryProviderSettings />);
    const save = await loadedSaveButton();

    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => expect(putBodies()).toHaveLength(1));
    expect(putBodies()[0].makeActive).toBe(true);
  });

  it("the header names the active provider rather than a hardcoded one", async () => {
    answerWith(configPayload(HOLOGRAPHIC_ACTIVE));
    render(<MemoryProviderSettings />);

    expect(await screen.findByText("Holographic")).toBeInTheDocument();
    expect(screen.queryByText("Hindsight")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// One card, not two warnings
// ═══════════════════════════════════════════════════════════════

describe("a first visit with nothing listening says it once", () => {
  it("the card is headed 'Set up memory' and carries the health sentence", async () => {
    answerWith(
      configPayload([{ type: "hindsight", label: "Hindsight", isActive: true, confirmed: false }]),
    );

    render(<MemoryPage />);

    expect(await screen.findByRole("heading", { name: "Set up memory" })).toBeInTheDocument();
    const message = await screen.findAllByText(/No memory provider is answering/i);
    expect(message).toHaveLength(1);
  });

  it("the 'built-in default' warning is not stacked on top of it", async () => {
    answerWith(
      configPayload([{ type: "hindsight", label: "Hindsight", isActive: true, confirmed: false }]),
    );

    render(<MemoryPage />);

    await screen.findByRole("heading", { name: "Set up memory" });
    // The guess warning means "something answered and it may not be yours". It
    // says nothing useful when nothing answered at all.
    expect(screen.queryByText(/built-in default/i)).toBeNull();
  });

  it("the memory list says it is not connected, never 'No memories yet'", async () => {
    answerWith(
      configPayload([{ type: "hindsight", label: "Hindsight", isActive: true, confirmed: false }]),
    );

    render(<MemoryPage />);

    expect(await screen.findByText(/Memory is not connected/i)).toBeInTheDocument();
    expect(screen.queryByText(/No memories yet/i)).toBeNull();
  });

  it("the endpoint fields are on the setup card, so the fix is where the problem is stated", async () => {
    answerWith(
      configPayload([{ type: "hindsight", label: "Hindsight", isActive: true, confirmed: false }]),
    );

    render(<MemoryPage />);

    const heading = await screen.findByRole("heading", { name: "Set up memory" });
    const card = heading.closest("div[class*='rounded']") as HTMLElement;
    expect(within(card).getByLabelText("Host")).toBeTruthy();
    expect(within(card).getByRole("button", { name: /Test connection/i })).toBeTruthy();
  });
});

describe("a store that answered, on a row nobody confirmed", () => {
  it("keeps the guess warning and the ordinary heading", async () => {
    answerWith(
      configPayload([{ type: "hindsight", label: "Hindsight", isActive: true, confirmed: false }]),
      healthPayload(true),
    );
    storeIsUp();

    render(<MemoryPage />);

    // The banner is what settles last, so it is what the wait is for.
    const banner = await screen.findByRole("status");
    expect(banner.textContent).toMatch(/built-in default/i);
    expect(screen.getByRole("heading", { name: "Memory provider" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Set up memory" })).toBeNull();
  });
});

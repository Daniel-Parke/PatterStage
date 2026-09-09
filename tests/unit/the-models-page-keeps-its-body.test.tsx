/**
 * The Models page keeps what is on screen across a reload (T-0139).
 *
 * Every write on the page reloads the registry, and the page answered the
 * reload by swapping its whole body for the spinner: the Fallback Chain
 * disclosure an operator had opened closed again, the Add Custom form went
 * with it, and the credentials list blinked out for the length of the fetch.
 * The spinner is for the FIRST read, when there is nothing to keep; a reload
 * with a registry already on screen keeps it there (the PageLoading contract,
 * U8, T-0122: the header always renders and the body is never blanked to
 * say "still fetching").
 *
 * The reload's reads are held mid-flight here, because in jsdom a fetch that
 * answers at once lands both ends of the reload in one flush and the swap
 * never paints; in a browser the network makes them two frames, and it did.
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ModelsPage from "@/app/agent/models/page";
import { TASK_TYPES } from "@/lib/models/task-types";

interface FetchResponseInit {
  body: unknown;
  status?: number;
}

function jsonResponse({ body, status = 200 }: FetchResponseInit) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const MODEL = {
  id: "m-1",
  name: "MiniMax-M3",
  provider: "minimax",
  modelId: "MiniMax-M3",
  baseUrl: null,
  contextLength: null,
  credentialsId: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

/** The registry's reads, each answered as often as the page asks. */
function answers(): Record<string, FetchResponseInit> {
  const config = { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 };
  return {
    "/api/models/sync/drift": { body: { data: null } },
    "/api/models/fallbacks/config": { body: { data: { config } } },
    "/api/models/fallbacks": { body: { data: { entries: [], config } } },
    "/api/models/defaults": {
      body: { data: { defaults: TASK_TYPES.reduce<Record<string, string | null>>((acc, t) => ({ ...acc, [t]: t === "agent" ? MODEL.id : null }), {}) } },
    },
    "/api/models/import": { body: { data: { modelsImported: 1, modelsSkipped: 0, credentialsUpdated: 0 } } },
    "/api/credentials": { body: { data: { credentials: [] } } },
    "/api/models": { body: { data: { models: [MODEL] } } },
  };
}

/**
 * A fetch that answers from the map, and holds every GET behind `gate` while
 * `held` is on: the reload in flight, as a network makes it.
 */
function installFetch(map: Record<string, FetchResponseInit>) {
  let held = false;
  let release: () => void = () => undefined;
  let gate = Promise.resolve();
  const hold = () => {
    held = true;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const open = () => {
    held = false;
    release();
  };
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (held && (init?.method ?? "GET") === "GET") await gate;
    const key = Object.keys(map)
      .sort((a, b) => b.length - a.length)
      .find((k) => path === k || path.startsWith(`${k}/`));
    if (!key) throw new Error(`Unmatched fetch: ${url}`);
    return jsonResponse(map[key]);
  }) as typeof global.fetch;
  return { hold, open };
}

describe("a reload keeps the registry on screen", () => {
  it("the Fallback Chain an operator opened is still open, and the body still there, while a write reloads the page", async () => {
    const net = installFetch(answers());
    render(<ModelsPage />);
    const disclosure = await screen.findByRole("button", { name: /Fallback Chain/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    const credentialsHeading = screen.getByRole("heading", { name: /credentials/i });

    // A write: Re-import reloads the registry when it lands. The reload's
    // reads are held, so the page is caught mid-reload.
    net.hold();
    fireEvent.click(screen.getByRole("button", { name: /Re-import from config/ }));
    await screen.findByText(/Re-imported 1 model from config\.yaml/);
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([u]) => String(u).includes("/api/credentials")).length).toBe(2));

    // Mid-reload: the same nodes, still mounted, the disclosure still open,
    // and no spinner where the registry was.
    expect(screen.queryByText(/Loading models/)).toBeNull();
    expect(document.contains(disclosure)).toBe(true);
    expect(document.contains(credentialsHeading)).toBe(true);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    // And after the reload lands, the same again.
    net.open();
    await waitFor(() => expect(screen.getByRole("button", { name: /Re-import from config/ })).toBeEnabled());
    expect(document.contains(disclosure)).toBe(true);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
  });

  it("the first read still shows the spinner under a header that says what it can", async () => {
    const net = installFetch(answers());
    net.hold();
    render(<ModelsPage />);
    expect(screen.getByRole("heading", { name: "Models", exact: true })).toBeInTheDocument();
    expect(screen.getByText(/Loading models/)).toBeInTheDocument();
    net.open();
    await screen.findByRole("button", { name: /Fallback Chain/ });
    expect(screen.queryByText(/Loading models/)).toBeNull();
  });
});

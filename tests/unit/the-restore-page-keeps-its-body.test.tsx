/**
 * The Restore page keeps what is on screen across a reload (C6, T-0143).
 *
 * Every restore reloads the three reads (the pack, the bundled profiles, the
 * seeded templates), and the page used to answer the reload by swapping its
 * whole body for the spinner: the "How this works" disclosure an operator had
 * opened closed again, and the sections blinked out for the length of the
 * fetch. The spinner is for the FIRST read, when there is nothing to keep; a
 * reload with the page already on screen keeps it there (the PageLoading
 * contract, U8, T-0122).
 *
 * The reload's reads are held mid-flight here, because in jsdom a fetch that
 * answers at once lands both ends of the reload in one flush and the swap
 * never paints; in a browser the network makes them two frames, and it did.
 */

import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { fetchMap, jsonResponse, type FetchAnswer } from "../helpers/fetch-map";
import { renderWithQuery } from "../helpers/render-with-query";

import RestorePage from "@/app/agent/settings/restore/page";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const PACK = { catalogVersion: "v1", root: 1, profiles: 2, templates: 1, categories: 3, skills: 4, tools: 5, memories: 6 };

/** The page's reads, each answered as often as the page asks. */
function answers(): Record<string, FetchAnswer> {
  return {
    "/api/seed": { body: { data: { state: { lastRun: "2026-09-01T10:00:00.000Z" }, pack: PACK } } },
    "/api/agent/profiles": {
      body: {
        data: {
          profiles: [
            { id: "default", name: "Bob", isDefault: true, isBundled: false, syncStatus: "synced" },
            { id: "qa", name: "QA Engineer", isDefault: false, isBundled: true, syncStatus: "synced" },
          ],
        },
      },
    },
    "/api/templates": {
      body: { data: { templates: [{ id: "bug-hunt", name: "Bug hunt", seedKey: "ch.tpl.bug-hunt", isCustom: false }] } },
    },
  };
}

/**
 * The map's fetch for the reads, a fixed answer for the one write, and a gate
 * in front of the reads: while `held` is on every GET waits for `open`, which
 * is the reload in flight, as a network makes it.
 */
function installFetch(map: Record<string, FetchAnswer>) {
  const answer = fetchMap(map);
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
  const gated = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "POST") return jsonResponse({ data: { root: 1, pushed: 0, backup: null } });
    if (held) await gate;
    return answer(input, init);
  });
  global.fetch = gated as typeof global.fetch;
  // The gated mock, not the map's: a held GET has been asked for before it is answered.
  const gets = (path: string) =>
    (gated.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>).filter(
      ([u, init]) => String(u) === path && (init?.method ?? "GET") === "GET",
    ).length;
  return { hold, open, gets };
}

describe("a reload keeps the page on screen", () => {
  it("the disclosure an operator opened is still open, and the sections still there, while a restore reloads the page", async () => {
    const net = installFetch(answers());
    renderWithQuery(<RestorePage />);
    const agents = await screen.findByRole("heading", { name: "Professional agents" });
    const details = screen.getByText("How this works").closest("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText("How this works"));
    expect(details.open).toBe(true);
    const qa = screen.getByText("QA Engineer");

    // A write: Restore Bob reloads the three reads when it lands. The reads
    // are held, so the page is caught mid-reload.
    net.hold();
    const bob = screen.getByRole("button", { name: "Restore Bob" });
    fireEvent.click(bob);
    fireEvent.click(bob);
    await screen.findByTestId("restore-result");
    await waitFor(() => expect(net.gets("/api/seed")).toBe(2));
    expect(net.gets("/api/agent/profiles")).toBe(2);
    expect(net.gets("/api/templates")).toBe(2);

    // Mid-reload: the same nodes, still mounted, the disclosure still open,
    // and no spinner where the page was.
    expect(screen.queryByText(/Reading the restore status/)).toBeNull();
    expect(document.contains(agents)).toBe(true);
    expect(document.contains(details)).toBe(true);
    expect(document.contains(qa)).toBe(true);
    expect(details.open).toBe(true);

    // And after the reload lands, the same again.
    net.open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore everything" })).toBeEnabled());
    expect(document.contains(details)).toBe(true);
    expect(details.open).toBe(true);
    expect(document.contains(qa)).toBe(true);
  });

  it("the first read still shows the spinner under a header that says what it can", async () => {
    const net = installFetch(answers());
    net.hold();
    renderWithQuery(<RestorePage />);
    // The header's own line; its h1 is the route's title, which jsdom's "/" cannot supply.
    expect(screen.getByText(/Put back what PatterStage ships/)).toBeInTheDocument();
    expect(screen.getByText(/Reading the restore status/)).toBeInTheDocument();
    net.open();
    await screen.findByRole("heading", { name: "Professional agents" });
    expect(screen.queryByText(/Reading the restore status/)).toBeNull();
  });
});

/**
 * The Skills page keeps what is on screen across a reload (C6, T-0143).
 *
 * A toggle reloads the catalogue when it lands, and the page used to answer
 * every reload by swapping its whole body for the loading placeholder: the
 * search box, the category rows and the row the operator had just switched
 * all blinked out for the length of the fetch. The placeholder is for the
 * FIRST read, when there is nothing to keep, and for a profile switch, which
 * is a first read of another catalogue; a reload with a catalogue already on
 * screen keeps it there (the PageLoading contract, U8, T-0122).
 *
 * The reload's reads are held mid-flight here, because in jsdom a fetch that
 * answers at once lands both ends of the reload in one flush and the swap
 * never paints; in a browser the network makes them two frames, and it did.
 */

import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fetchMap, type FetchAnswer } from "../helpers/fetch-map";
import { renderWithQuery } from "../helpers/render-with-query";

import SkillsPage from "@/app/agent/skills/page";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const ACTIVE = "cat-00-skill-000";
const INACTIVE = "cat-00-skill-002";

function skill(name: string, enabled: boolean) {
  return { name, category: "cat-00", description: `does ${name}`, enabled };
}

/** The page's reads, each answered as often as the page asks. */
function answers(): Record<string, FetchAnswer> {
  return {
    "/api/agent/profiles": { body: { data: { profiles: [{ id: "default", name: "Bob", description: "" }] } } },
    [`/api/skills/${INACTIVE}/toggle`]: { body: { data: { ok: true } } },
    "/api/skills": {
      body: { data: { skills: [skill(ACTIVE, true), skill("cat-00-skill-001", true), skill(INACTIVE, false)], profile: "default" } },
    },
  };
}

/**
 * The map's fetch, and a gate in front of it: while `held` is on every GET
 * waits for `open`, which is the reload in flight, as a network makes it.
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
    if (held && (init?.method ?? "GET") === "GET") await gate;
    return answer(input, init);
  });
  global.fetch = gated as typeof global.fetch;
  // The gated mock, not the map's: a held GET has been asked for before it is answered.
  return { hold, open, calls: () => (gated.mock.calls as Array<[RequestInfo | URL]>).map(([u]) => String(u)) };
}

const rows = () => screen.queryAllByTestId("skill-row");
const rowFor = (name: string) => rows().find((r) => r.getAttribute("data-skill") === name);

describe("a reload keeps the catalogue on screen", () => {
  it("the rows and the search box are still there, and no placeholder, while a toggle reloads the page", async () => {
    const net = installFetch(answers());
    renderWithQuery(<SkillsPage />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    const search = screen.getByRole("textbox", { name: /search skills/i });
    fireEvent.change(search, { target: { value: "skill" } });
    const active = rowFor(ACTIVE)!;
    const inactive = rowFor(INACTIVE)!;

    // A write: the toggle reloads the catalogue when it lands. The reload's
    // read is held, so the page is caught mid-reload.
    net.hold();
    fireEvent.click(within(inactive).getByTestId("skill-toggle"));
    await screen.findByText(`${INACTIVE} enabled`);
    await waitFor(() => expect(net.calls().filter((u) => u.startsWith("/api/skills?")).length).toBe(2));

    // Mid-reload: the same nodes, still mounted, the search still typed, and
    // no placeholder where the catalogue was.
    expect(screen.queryByRole("status", { name: /loading skills/i })).toBeNull();
    expect(document.contains(active)).toBe(true);
    expect(document.contains(inactive)).toBe(true);
    expect(document.contains(search)).toBe(true);
    expect(search).toHaveValue("skill");

    // And after the reload lands, the same again.
    net.open();
    await waitFor(() => expect(within(rowFor(INACTIVE)!).getByTestId("skill-toggle")).toBeEnabled());
    expect(document.contains(search)).toBe(true);
    expect(search).toHaveValue("skill");
    expect(screen.queryByRole("status", { name: /loading skills/i })).toBeNull();
  });

  it("the first read still shows the placeholder under a header that says what it can", async () => {
    const net = installFetch(answers());
    net.hold();
    renderWithQuery(<SkillsPage />);
    expect(screen.getByRole("status", { name: /loading skills/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading skills…/)).toBeInTheDocument();
    net.open();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.queryByRole("status", { name: /loading skills/i })).toBeNull();
  });
});

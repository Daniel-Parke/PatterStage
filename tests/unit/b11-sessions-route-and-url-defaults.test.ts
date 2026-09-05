/** @jest-environment node */

/**
 * B11, four sharper oracles the sweep asked for (T-0105).
 *
 * The SQL file asks the repository and the page files ask the page; between
 * them sits the route, which is where `sources` becomes a field on the wire,
 * and the query parser, which is where a source the UI has no word for is
 * either accepted or silently dropped. A URL helper that writes every default
 * back, and a message cap that defaults to no cap at all, walked through
 * everything too.
 */

import { NextRequest } from "next/server";

const listSessions = jest.fn();
jest.mock("@/lib/sessions/session-repository", () => ({
  listSessions: (...a: unknown[]) => listSessions(...a),
  getSession: jest.fn(() => null),
  estimateSessionSize: jest.fn(() => 0),
}));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/read-only", () => ({ isReadOnly: () => true }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => new Response("err", { status: 500 })),
}));

import { GET } from "@/app/api/sessions/route";
import { parseSessionQuery } from "@/lib/sessions/sessions-api-helpers";
import { getMaxSessionMessages } from "@/lib/sessions/sessions-api-guard";
import { writeSessionsViewToUrl, readSessionsViewFromUrl } from "@/lib/sessions/sessions-url-state";

const TOTALS = { total: 2, active: 0, messages: 4, bySource: { cli: 1, "worker-7": 1 } };

beforeEach(() => {
  jest.clearAllMocks();
  listSessions.mockReturnValue({
    sessions: [],
    total: 2,
    totals: TOTALS,
    sources: ["cli", "worker-7"],
  });
});

describe("GET /api/sessions", () => {
  async function get(query = ""): Promise<Record<string, unknown>> {
    const res = await GET(new NextRequest(`http://localhost/api/sessions${query}`));
    const body = (await res.json()) as { data?: Record<string, unknown> };
    return body.data ?? {};
  }

  it("puts the reachable sources on the wire", async () => {
    // The page builds its filter buttons from this; an empty array is the
    // four-name constant all over again (T-0105, D29).
    expect(await get()).toMatchObject({ sources: ["cli", "worker-7"] });
  });

  it("forwards a source the UI has no word for, rather than dropping it", async () => {
    await get("?source=worker-7");

    expect(listSessions).toHaveBeenCalledWith(expect.objectContaining({ source: "worker-7" }));
  });

  it("forwards the status and the noise flag", async () => {
    await get("?status=failed&hideApiNoise=1");

    expect(listSessions).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", excludeApiNoise: true }),
    );
  });
});

describe("parseSessionQuery", () => {
  const req = (q: string) => new NextRequest(`http://localhost/api/sessions?${q}`);

  it("accepts a source outside the named set", () => {
    expect(parseSessionQuery(req("source=worker-7")).source).toBe("worker-7");
  });

  it("refuses one that is not a source at all", () => {
    expect(parseSessionQuery(req("source=%20%20")).source).toBeUndefined();
    expect(parseSessionQuery(req("source=has a space")).source).toBeUndefined();
  });
});

describe("the transcript message cap", () => {
  const original = process.env.MAX_SESSION_MESSAGES;
  afterEach(() => {
    if (original === undefined) delete process.env.MAX_SESSION_MESSAGES;
    else process.env.MAX_SESSION_MESSAGES = original;
  });

  it("has a default, so an unset environment is still capped", () => {
    delete process.env.MAX_SESSION_MESSAGES;

    expect(getMaxSessionMessages()).toBe(2000);
  });

  it("honours the environment, and ignores junk", () => {
    process.env.MAX_SESSION_MESSAGES = "50";
    expect(getMaxSessionMessages()).toBe(50);

    process.env.MAX_SESSION_MESSAGES = "not-a-number";
    expect(getMaxSessionMessages()).toBe(2000);

    process.env.MAX_SESSION_MESSAGES = "0";
    expect(getMaxSessionMessages()).toBe(2000);
  });
});

describe("the sessions view as a query string", () => {
  const DEFAULT_VIEW = {
    search: "",
    source: null,
    failedOnly: false,
    page: 0,
    pageSize: 50,
    missionId: null,
  };

  it("writes nothing at all for the view everyone starts on", () => {
    // `?page=1&size=50&search=` is noise, and it makes the plain link and the
    // default view look like different places.
    expect(writeSessionsViewToUrl(DEFAULT_VIEW, 50)).toBe("");
  });

  it("writes only what differs, and reads it back", () => {
    const view = { ...DEFAULT_VIEW, search: "alpha", source: "worker-7", page: 2, pageSize: 25 };

    const q = writeSessionsViewToUrl(view, 50);

    expect(q).toContain("search=alpha");
    expect(q).toContain("source=worker-7");
    expect(q).toContain("page=3");
    expect(q).toContain("size=25");
    expect(readSessionsViewFromUrl(q, 50)).toEqual(view);
  });
});

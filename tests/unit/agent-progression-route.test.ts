/** @jest-environment node */
// The two routes that touch the per-Body progression record.
//
// GET /api/agents/progression is the read side: latest-per-profile by default,
// one profile's whole trail when a slug is given.
//
// BOTH of them capture. That used to be true of /api/stats alone, so an install
// driven over HTTP -- a QA pass, a scripted operator -- never captured, and the
// read side answered with rows nobody had written while the spend figures
// beside them read live (T-0081, RC-A).
//
// The assertions that earn their place are the swallow ones: a capture failure
// must be logged and swallowed on the dashboard, which must not go dark because
// a bookkeeping write was refused, and swallowed on the read, which owes its
// caller the stored rows whatever happened to a courtesy write on the way past.

const readLatestAgentProgressionSnapshots = jest.fn();
const readAgentProgressionHistory = jest.fn();
const getDashboardStats = jest.fn();
const captureAgentProgressionSnapshots = jest.fn();
const captureAgentProgressionFromLiveStats = jest.fn();

jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));
jest.mock("@/lib/stats/agent-progression-repository", () => ({
  readLatestAgentProgressionSnapshots: () => readLatestAgentProgressionSnapshots(),
  readAgentProgressionHistory: (slug: string) => readAgentProgressionHistory(slug),
}));
jest.mock("@/lib/stats/stats-repository", () => ({
  getDashboardStats: () => getDashboardStats(),
}));
jest.mock("@/lib/stats/agent-progression", () => ({
  captureAgentProgressionSnapshots: (input: unknown) => captureAgentProgressionSnapshots(input),
  captureAgentProgressionFromLiveStats: () => captureAgentProgressionFromLiveStats(),
}));

import type { NextRequest } from "next/server";
import { GET as progressionGET } from "@/app/api/agents/progression/route";
import { GET as statsGET } from "@/app/api/stats/route";

function req(qs: string): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/agents/progression${qs}`),
  } as unknown as NextRequest;
}
async function jsonOf(res: Response): Promise<{ data?: Record<string, unknown>; error?: string }> {
  return (await res.json()) as { data?: Record<string, unknown>; error?: string };
}

const ROW = {
  id: 7,
  profileSlug: "scout",
  capturedAt: "2026-08-22T10:00:00Z",
  level: 4,
  levelTitle: "Specialist",
  xp: 700,
  achievementsScope: "install",
  achievementsJson: "[]",
  inputsJson: "{}",
  inputsDigest: "abc",
  schemaVersion: 31,
  computationVersion: 1,
};

beforeEach(() => jest.clearAllMocks());

describe("GET /api/agents/progression", () => {
  it("returns the newest row per profile when no slug is given", async () => {
    readLatestAgentProgressionSnapshots.mockReturnValue([ROW]);

    const res = await progressionGET(req(""));

    expect(res.status).toBe(200);
    expect((await jsonOf(res)).data).toEqual({ slug: null, snapshots: [ROW] });
    expect(readAgentProgressionHistory).not.toHaveBeenCalled();
  });

  it("returns one profile's whole trail when a slug is given", async () => {
    readAgentProgressionHistory.mockReturnValue([ROW, { ...ROW, id: 9, xp: 900 }]);

    const res = await progressionGET(req("?slug=scout"));

    expect(res.status).toBe(200);
    expect(readAgentProgressionHistory).toHaveBeenCalledWith("scout");
    expect((await jsonOf(res)).data).toEqual({
      slug: "scout",
      snapshots: [ROW, { ...ROW, id: 9, xp: 900 }],
    });
    expect(readLatestAgentProgressionSnapshots).not.toHaveBeenCalled();
  });

  it("captures on the way past, so an API-only install is not blind", async () => {
    // The wiring half of RC-A. That the capture actually WRITES a row is proved
    // against real SQLite in the-numbers-are-measured.test.ts; this is the
    // assertion that the route asks for it at all.
    readLatestAgentProgressionSnapshots.mockReturnValue([ROW]);

    await progressionGET(req(""));

    expect(captureAgentProgressionFromLiveStats).toHaveBeenCalled();
  });

  it("captures BEFORE reading, or the first request still answers empty", async () => {
    // Ordering is the whole point. A capture after the read would leave the
    // very first caller -- the one who has never opened the dashboard, which is
    // exactly the reported case -- looking at nothing.
    const order: string[] = [];
    captureAgentProgressionFromLiveStats.mockImplementation(() => order.push("capture"));
    readLatestAgentProgressionSnapshots.mockImplementation(() => {
      order.push("read");
      return [ROW];
    });

    await progressionGET(req(""));

    expect(order).toEqual(["capture", "read"]);
  });

  it("still answers when the capture throws", async () => {
    captureAgentProgressionFromLiveStats.mockImplementation(() => {
      throw new Error("stats unavailable");
    });
    readLatestAgentProgressionSnapshots.mockReturnValue([ROW]);
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await progressionGET(req(""));

    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it("500s with a message when the read throws", async () => {
    readLatestAgentProgressionSnapshots.mockImplementation(() => {
      throw new Error("no such table: agent_progression_snapshots");
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await progressionGET(req(""));

    expect(res.status).toBe(500);
    expect((await jsonOf(res)).error).toBe("Failed to load agent progression");
    spy.mockRestore();
  });
});

describe("GET /api/stats captures progression", () => {
  const stats = { agents: [{ slug: "scout" }], achievements: [{ id: "first-contact" }] };

  it("hands the aggregate's own agents and achievements to the capture", async () => {
    getDashboardStats.mockReturnValue(stats);

    const res = await statsGET();

    expect(res.status).toBe(200);
    expect(captureAgentProgressionSnapshots).toHaveBeenCalledWith({
      agents: stats.agents,
      achievements: stats.achievements,
    });
    expect((await jsonOf(res)).data).toEqual({ stats });
  });

  it("still serves the dashboard when the capture is refused", async () => {
    getDashboardStats.mockReturnValue(stats);
    captureAgentProgressionSnapshots.mockImplementation(() => {
      throw new Error("append-only: a correction is a new row, never an edit");
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await statsGET();

    expect(res.status).toBe(200);
    expect((await jsonOf(res)).data).toEqual({ stats });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("capturing agent progression"),
    );
    spy.mockRestore();
  });
});

/** @jest-environment node */
// Tests for the /api/analytics routes (summary + timeseries) with the
// aggregates/repository + ensureDb mocked. Focuses on the response shape and
// the query-param validation (days clamp + type enum) rather than the SQL.

const getAnalyticsSummary = jest.fn();
const timeseries = jest.fn();

jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));
jest.mock("@/lib/analytics/aggregates", () => ({
  getAnalyticsSummary: (...a: unknown[]) => getAnalyticsSummary(...a),
}));
jest.mock("@/lib/analytics/analytics-repository", () => ({
  timeseries: (...a: unknown[]) => timeseries(...a),
}));

import type { NextRequest } from "next/server";
import { GET as summaryGET } from "@/app/api/analytics/route";
import { GET as tsGET } from "@/app/api/analytics/timeseries/route";

function tsReq(qs: string): NextRequest {
  return { url: `http://localhost/api/analytics/timeseries${qs}` } as unknown as NextRequest;
}
async function jsonOf(res: Response): Promise<{ data?: Record<string, unknown>; error?: string }> {
  return (await res.json()) as { data?: Record<string, unknown>; error?: string };
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/analytics", () => {
  it("returns the analytics summary", async () => {
    const summary = { totals: { "mission.dispatched": 3 }, last30: {}, activeDays: 2, generatedAt: "t" };
    getAnalyticsSummary.mockReturnValue(summary);
    const res = await summaryGET();
    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({ data: { analytics: summary } });
  });
});

describe("GET /api/analytics/timeseries", () => {
  it("applies defaults (days=30, bucket=day) and passes the type through", async () => {
    timeseries.mockReturnValue([{ date: "2026-06-15", value: 1 }]);
    const res = await tsGET(tsReq("?type=mission.dispatched"));
    expect(res.status).toBe(200);
    expect((await jsonOf(res)).data).toMatchObject({
      type: "mission.dispatched",
      days: 30,
      bucket: "day",
    });
    expect(timeseries).toHaveBeenCalledWith("mission.dispatched", 30);
  });

  it("passes null type when omitted and honours an explicit days window", async () => {
    timeseries.mockReturnValue([]);
    const res = await tsGET(tsReq("?days=7"));
    expect(res.status).toBe(200);
    expect(timeseries).toHaveBeenCalledWith(null, 7);
  });

  it.each(["?days=0", "?days=9999", "?days=abc", "?type=bogus"])(
    "rejects invalid query %s with 400",
    async (qs) => {
      const res = await tsGET(tsReq(qs));
      expect(res.status).toBe(400);
      expect(timeseries).not.toHaveBeenCalled();
    },
  );
});

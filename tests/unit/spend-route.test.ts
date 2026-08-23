/** @jest-environment node */
// ORACLE for T-0021 (WO-0014): /api/spend, the surface the console reads and
// the one place a figure can be set.
//
// The validation here is the load-bearing part. Clause 4 says the stop is the
// operator's to switch on BESIDE HIS OWN FIGURE, so the route must refuse to
// arm a stop with no figure, and must refuse to strip the figure out from under
// an armed one. The database refuses both as well (migration 033); this refuses
// them with a sentence a person can read instead of a constraint name.

const getSpendSummary = jest.fn();
const writeSpendPolicy = jest.fn();
const readSpendPolicy = jest.fn();

jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null) }));
jest.mock("@/lib/spend/spend-summary", () => ({
  getSpendSummary: (...a: unknown[]) => getSpendSummary(...a),
}));
jest.mock("@/lib/spend/spend-repository", () => ({
  writeSpendPolicy: (...a: unknown[]) => writeSpendPolicy(...a),
  readSpendPolicy: () => readSpendPolicy(),
}));

import type { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/spend/route";
import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

function putReq(body: unknown): NextRequest {
  return {
    url: "http://localhost/api/spend",
    method: "PUT",
    json: async () => body,
  } as unknown as NextRequest;
}
async function jsonOf(res: Response): Promise<{ data?: Record<string, unknown>; error?: string }> {
  return (await res.json()) as { data?: Record<string, unknown>; error?: string };
}

beforeEach(() => {
  jest.clearAllMocks();
  readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY });
  getSpendSummary.mockReturnValue({ periods: [], policy: UNSET_SPEND_POLICY });
});

describe("GET /api/spend", () => {
  it("returns the summary under the ok() envelope", async () => {
    const summary = { periods: [], policy: UNSET_SPEND_POLICY, unmeasured: [] };
    getSpendSummary.mockReturnValue(summary);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({ data: { spend: summary } });
  });
});

describe("PUT /api/spend: setting a figure", () => {
  it("accepts a figure and a period", async () => {
    const res = await PUT(putReq({ limitUsd: 40, period: "week" }));
    expect(res.status).toBe(200);
    expect(writeSpendPolicy).toHaveBeenCalledWith({ limitUsd: 40, period: "week" });
  });

  it("accepts clearing the figure back to unset", async () => {
    const res = await PUT(putReq({ limitUsd: null }));
    expect(res.status).toBe(200);
    // Clearing the figure disarms the stop in the same write, so the pair can
    // never be left in the state the database refuses.
    expect(writeSpendPolicy).toHaveBeenCalledWith({ limitUsd: null, hardStop: false });
  });

  it("rejects a figure that is not a positive number", async () => {
    for (const bad of [0, -1, "40", Number.NaN]) {
      const res = await PUT(putReq({ limitUsd: bad }));
      expect(res.status).toBe(400);
    }
    expect(writeSpendPolicy).not.toHaveBeenCalled();
  });

  it("rejects a period it cannot measure", async () => {
    const res = await PUT(putReq({ period: "fortnight" }));
    expect(res.status).toBe(400);
    expect(writeSpendPolicy).not.toHaveBeenCalled();
  });

  it("rejects a body with nothing in it", async () => {
    const res = await PUT(putReq({}));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/spend: arming the stop", () => {
  it("refuses to arm a stop when no figure has ever been set", async () => {
    const res = await PUT(putReq({ hardStop: true }));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toMatch(/budget/i);
    expect(writeSpendPolicy).not.toHaveBeenCalled();
  });

  it("arms the stop when a figure already exists", async () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 40 });
    const res = await PUT(putReq({ hardStop: true }));
    expect(res.status).toBe(200);
    expect(writeSpendPolicy).toHaveBeenCalledWith({ hardStop: true });
  });

  it("arms the stop when a figure is supplied in the same request", async () => {
    const res = await PUT(putReq({ limitUsd: 40, hardStop: true }));
    expect(res.status).toBe(200);
    expect(writeSpendPolicy).toHaveBeenCalledWith({ limitUsd: 40, hardStop: true });
  });

  it("disarming the stop is always allowed", async () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 40, hardStop: true });
    const res = await PUT(putReq({ hardStop: false }));
    expect(res.status).toBe(200);
    expect(writeSpendPolicy).toHaveBeenCalledWith({ hardStop: false });
  });
});

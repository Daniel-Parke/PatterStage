/** @jest-environment node */

// T-0089, ruling 3: round 6, finding 14. The gate accepted four verbs and
// documented none; the UI sends two. `add_feature` silently routed as APPROVE
// and `review` as REJECT: a client guessing "approve" got a Zod flatten, and
// one guessing "add_feature" approved a gate by accident.

import { NextRequest } from "next/server";
import { approvalActionSchema } from "@/lib/composer/schema";

jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => true }));
const mockRecord = jest.fn((..._a: unknown[]) => ({ id: "a1" }));
jest.mock("@/lib/composer/composer-repository", () => ({
  getComposerRun: () => ({ id: "r1", status: "awaiting_approval", currentNodeId: "n1", error: null, workflowId: "w1" }),
  getNode: () => ({ id: "n1", gate: "hil" }),
  recordComposerApproval: (...a: unknown[]) => mockRecord(...a),
  updateComposerRun: jest.fn(),
}));
jest.mock("@/lib/composer/engine", () => ({ advanceComposerRun: jest.fn(async () => undefined) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));

import { POST } from "@/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/composer/runs/r1/nodes/n1/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "r1", nodeId: "n1" }) },
  );
}

beforeEach(() => jest.clearAllMocks());

describe("the schema", () => {
  it("accepts exactly accept and reject", () => {
    expect(approvalActionSchema.safeParse("accept").success).toBe(true);
    expect(approvalActionSchema.safeParse("reject").success).toBe(true);
    expect(approvalActionSchema.safeParse("review").success).toBe(false);
    expect(approvalActionSchema.safeParse("add_feature").success).toBe(false);
  });
});

describe("the route", () => {
  it("answers a guessed verb with the two real ones and the hint", async () => {
    const res = await post({ action: "approve" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/"accept"/);
    expect(body.error).toMatch(/"reject"/);
    expect(body.error).toMatch(/approve/);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("no longer routes add_feature as an approval", async () => {
    const res = await post({ action: "add_feature" });

    expect(res.status).toBe(400);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: accept is recorded", async () => {
    const res = await post({ action: "accept" });

    expect(res.status).not.toBe(400);
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ action: "accept" }));
  });
});

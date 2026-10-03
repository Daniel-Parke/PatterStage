/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Tests for the `parseCategoryIdOrError` helper in
 * `src/app/api/missions/route.ts`.
 *
 * The helper is a file-local function in the missions route — not exported
 * — so the tests exercise it indirectly through the route's POST handler.
 * The 6 cases below cover the full shape contract documented in the
 * helper's JSDoc:
 *   - undefined  → 400 (impossible; the route pre-validates fields)
 *   - null       → null       (passthrough; explicit "no category")
 *   - ""         → null       (passthrough; consistent with parseCategoryId)
 *   - valid id   → id string  (passthrough)
 *   - unknown id → 400 NextResponse "Category not found"
 *   - non-string → 400 NextResponse "categoryId must be a string"
 */

jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());

jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(
    (_route: string, _ctx: string, _err: unknown, msg: string) => ({
      __is500: true,
      error: msg,
    }),
  ),
}));
jest.mock("@/lib/api/api-auth", () => ({
  isReadOnly: jest.fn(() => false),
}));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/missions/mission-repository", () => ({
  listMissions: jest.fn(() => []),
  getMission: jest.fn(() => undefined),
  createMission: jest.fn(),
  promoteMission: jest.fn(),
  updateMission: jest.fn(),
  cancelMission: jest.fn(),
  deleteMission: jest.fn(),
  buildMissionPrompt: jest.fn(
    ({ instruction }: { instruction: string }) => instruction,
  ),
}));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/missions/mission-category-repository", () => ({
  getCategory: jest.fn((id: string) =>
    id === "valid-cat" ? { id: "valid-cat", name: "Valid" } : null,
  ),
}));

import { POST } from "@/app/api/missions/route";
const { __responses } = require("next/server") as {
  __responses: Array<{ data: unknown; init?: ResponseInit }>;
};
const { createMission } = require("@/lib/missions/mission-repository") as {
  createMission: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  __responses.length = 0;
});

function lastResponse() {
  const r = __responses[__responses.length - 1];
  if (!r) throw new Error("no response captured");
  return r;
}

async function postDispatch(body: Record<string, unknown>) {
  const req = {
    url: "http://localhost/api/missions",
    headers: new Map(),
    json: () => Promise.resolve(body),
  } as unknown as Parameters<typeof POST>[0];
  await POST(req);
}

describe("parseCategoryIdOrError — dispatch branch", () => {
  it("normalises undefined to null (the downstream createMission contract)", async () => {
    createMission.mockReturnValue({ id: "m1", name: "test" });

    await postDispatch({
      action: "dispatch",
      name: "test",
      instruction: "do it",
      dispatchMode: "save",
    });

    expect(createMission).toHaveBeenCalledTimes(1);
    const arg = createMission.mock.calls[0][0];
    // `categoryId: categoryId ?? null` in the dispatch payload collapses
    // undefined → null, matching the prior inline-`parseCategoryId` shape.
    expect(arg.categoryId).toBeNull();
  });

  it("passes null through (explicit no category)", async () => {
    createMission.mockReturnValue({ id: "m1", name: "test" });

    await postDispatch({
      action: "dispatch",
      name: "test",
      instruction: "do it",
      dispatchMode: "save",
      categoryId: null,
    });

    const arg = createMission.mock.calls[0][0];
    expect(arg.categoryId).toBeNull();
  });

  it("passes empty string through as null (consistent with parseCategoryId)", async () => {
    createMission.mockReturnValue({ id: "m1", name: "test" });

    await postDispatch({
      action: "dispatch",
      name: "test",
      instruction: "do it",
      dispatchMode: "save",
      categoryId: "",
    });

    const arg = createMission.mock.calls[0][0];
    expect(arg.categoryId).toBeNull();
  });

  it("passes a valid categoryId through", async () => {
    createMission.mockReturnValue({ id: "m1", name: "test" });

    await postDispatch({
      action: "dispatch",
      name: "test",
      instruction: "do it",
      dispatchMode: "save",
      categoryId: "valid-cat",
    });

    const arg = createMission.mock.calls[0][0];
    expect(arg.categoryId).toBe("valid-cat");
  });

  it("returns 400 for an unknown categoryId", async () => {
    await postDispatch({
      action: "dispatch",
      name: "test",
      instruction: "do it",
      dispatchMode: "save",
      categoryId: "bogus-cat",
    });

    const resp = lastResponse();
    expect(resp.init?.status).toBe(400);
    expect((resp.data as { error: string }).error).toBe("Category not found");
    expect(createMission).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-string categoryId", async () => {
    await postDispatch({
      action: "dispatch",
      name: "test",
      instruction: "do it",
      dispatchMode: "save",
      categoryId: 42,
    });

    const resp = lastResponse();
    expect(resp.init?.status).toBe(400);
    expect((resp.data as { error: string }).error).toBe(
      "categoryId must be a string",
    );
    expect(createMission).not.toHaveBeenCalled();
  });
});

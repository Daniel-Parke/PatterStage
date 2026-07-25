/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

// Tests for the `requireMissionOrNotFound(body)` 2-step helper that
// consolidates the `requireMissionId` + `getMissionOrNotFound` pattern
// across the 3 POST sites (update, cancel, delete) in
// src/app/api/missions/route.ts.
//
// Behavioural contract: the helper returns the Mission record when
// the body has an `id` (or `missionId`) AND a mission with that id
// exists. It returns a NextResponse 400 when the id is missing, and
// a NextResponse 404 when the id is present but no mission exists.
// The 3 callers all short-circuit on `instanceof NextResponse` and
// pass the returned Mission record through to the next step.

jest.mock("next/server", () => {
  const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
  class NextResponse {
    ok: boolean;
    status: number;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    json() { return Promise.resolve(this._data); }
    static json(data: unknown, init?: ResponseInit) {
      responses.push({ data, init });
      return new NextResponse(data, init);
    }
  }
  return {
    NextRequest: class NextRequest {
      url: string;
      method: string;
      headers: Headers;
      private _body: string;
      constructor(url: string, init?: RequestInit) {
        this.url = url;
        this.method = init?.method ?? "GET";
        this.headers = new Headers(init?.headers as HeadersInit);
        this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
      }
      async json() { return JSON.parse(this._body); }
    },
    NextResponse,
    __responses: responses,
  };
});

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

const mockGetMission = jest.fn();
jest.mock("@/lib/mission-repository", () => ({
  getMission: (...args: unknown[]) => mockGetMission(...args),
  updateMission: jest.fn(),
  listMissions: jest.fn(),
  createMission: jest.fn(),
  deleteMission: jest.fn(),
  buildMissionPrompt: jest.fn(),
}));


jest.mock("@/lib/mission-category-repository", () => ({
  getCategory: jest.fn(),
}));

jest.mock("@/lib/local-dir-entry", () => ({
  normalizeLocalDirsInput: jest.fn((d) => d ?? []),
}));

jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: jest.fn(() => []),
}));

jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: jest.fn(() => Promise.resolve({ ok: true })),
  dispatchMissionRun: jest.fn(() => Promise.resolve({ ok: true })),
}));

jest.mock("@/lib/mission-promote-handler", () => ({
  promoteMission: jest.fn(),
}));

jest.mock("@/lib/mission-dispatch", () => ({
  dispatchMissionNow: jest.fn(),
}));

jest.mock("@/lib/mission-queue-tick", () => ({
  runMissionQueueTick: jest.fn(),
}));

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
}));

jest.mock("@/lib/session-repository", () => ({
  updateSession: jest.fn(),
}));

import { NextResponse } from "next/server";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requireMissionOrNotFound (via POST /api/missions)", () => {
  it("returns 400 'Mission id is required' when the body has no id or missionId", async () => {
    mockGetMission.mockReturnValue(undefined);

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<NextResponse>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    // Cancel branch — fastest short-circuit
    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Mission id is required");
    // getMission should NOT be called when the id is missing — the
    // helper returns the 400 first.
    expect(mockGetMission).not.toHaveBeenCalled();
  });

  it("returns 400 when id is an empty string", async () => {
    mockGetMission.mockReturnValue(undefined);

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<NextResponse>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", id: "" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Mission id is required");
  });

  it("accepts the `missionId` alias when `id` is missing (delete branch)", async () => {
    // The DELETE branch uses `requireMissionId` which reads
    // `body.id ?? body.missionId` — verify the alias still works
    // through the new 2-step helper.
    mockGetMission.mockReturnValue(undefined);

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<NextResponse>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "delete", missionId: "m-alias" }),
    });
    const res = await POST(req);

    // The mission doesn't exist (mockGetMission returns undefined), so
    // the 2-step helper returns 404 — proving `missionId` was resolved
    // to "m-alias" and passed to getMission.
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Mission not found");
    expect(mockGetMission).toHaveBeenCalledWith("m-alias");
  });

  it("returns 404 'Mission not found' when id is present but mission is missing", async () => {
    mockGetMission.mockReturnValue(undefined);

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<NextResponse>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: "m-missing" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Mission not found");
    expect(mockGetMission).toHaveBeenCalledWith("m-missing");
  });

  it("returns the mission record when both id and mission exist (cancel branch continues to updateMission)", async () => {
    // The cancel branch's continuation calls `updateMission(cancelId, ...)`.
    // We mock it to capture the call and verify the id resolution worked
    // end-to-end.
    const mockUpdateMission = require("@/lib/mission-repository").updateMission as jest.Mock;
    mockGetMission.mockReturnValue({
      id: "m-1",
      status: "dispatched",
      sessionId: null,
    });
    mockUpdateMission.mockReturnValue({
      id: "m-1",
      status: "failed",
      result: "Cancelled by user",
    });

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<NextResponse>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", id: "m-1" }),
    });
    const res = await POST(req);

    // The cancel succeeded — the response is 200 with a mission payload.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { cancel: { accepted: boolean }; mission: { id: string } } };
    expect(body.data.cancel.accepted).toBe(true);
    expect(body.data.mission.id).toBe("m-1");
    // updateMission was called with the id resolved by the helper.
    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m-1",
      expect.objectContaining({ status: "failed", result: "Cancelled by user" }),
    );
  });
});

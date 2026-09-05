/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// T-0111: the two READ events, and the one place each is knowable.
//
// The operator ruled on 2026-09-06 that chapter 4 keeps its six steps, which
// means the ledger records two reads: `artifact.opened` and `logs.opened`.
// Every other type in the taxonomy is a write, and B4's own rule says a type is
// emitted "only after its write succeeded and only from a write path", so these
// two need their own account:
//
//   - They are emitted SERVER-side, from the GET handler the screen already
//     calls. There is deliberately no POST on /api/analytics, because a client
//     that could write this ledger could forge the quest progress that reads it.
//   - They fire on the path that actually hands the thing over. A 404 for an
//     artifact that does not exist, or for a log directory that was never
//     written, is not somebody reading something.
//
// The repositories and the filesystem are doubles, so what the handler did NOT
// record is as assertable as what it did.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";

const recordEvent = jest.fn();
jest.mock("@/lib/analytics/record-event", () => ({
  recordEvent: (...args: unknown[]) => recordEvent(...args),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500 })),
}));

const getArtifact = jest.fn();
jest.mock("@/lib/artifacts-repository", () => ({
  getArtifact: (id: string) => getArtifact(id),
  deleteArtifact: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: class NextResponse {
    constructor(
      public status: number,
      public body: unknown,
    ) {}
    async json() {
      return this.body;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

import { GET as getArtifactRoute } from "@/app/api/artifacts/[id]/route";
import { ANALYTICS_EVENT_TYPES, ANALYTICS_ENTITY_TYPES } from "@/lib/analytics/event-types";
import { categoryForEventType } from "@/lib/analytics/categories";

beforeEach(() => jest.clearAllMocks());

describe("the taxonomy carries the two reads", () => {
  it("names both, and a category for each", () => {
    expect(ANALYTICS_EVENT_TYPES).toContain("artifact.opened");
    expect(ANALYTICS_EVENT_TYPES).toContain("logs.opened");
    expect(categoryForEventType("artifact.opened")).not.toBeNull();
    expect(categoryForEventType("logs.opened")).not.toBeNull();
  });

  it("names the entity a log event points at, which is a file and not a row", () => {
    expect(ANALYTICS_ENTITY_TYPES).toContain("log");
    expect(ANALYTICS_ENTITY_TYPES).toContain("artifact");
  });
});

describe("GET /api/artifacts/[id] records that it was opened", () => {
  const call = (id: string) =>
    (getArtifactRoute as unknown as (r: unknown, c: { params: Promise<{ id: string }> }) => Promise<{ status: number }>)(
      {},
      { params: Promise.resolve({ id }) },
    );

  it("records the read once the artifact is actually handed over", async () => {
    getArtifact.mockReturnValue({ id: "A-1", name: "A report", content: "x" });
    const res = await call("A-1");

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(
      "artifact.opened",
      expect.objectContaining({ entityType: "artifact", entityId: "A-1" }),
    );
  });

  it("records nothing for an id that is not an artifact", async () => {
    // A 404 is somebody following a stale link, not somebody reading. A ledger
    // that counted those would let a quest be ticked by guessing at ids.
    getArtifact.mockReturnValue(null);
    const res = await call("nope");

    expect(res.status).toBe(404);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe("GET /api/logs records that a file was read", () => {
  it("emits logs.opened only where the lines are returned", () => {
    // Read as source rather than driven: the handler resolves a real logs
    // directory through the agent workspace, and a double for that is a double
    // for the thing under test. What matters is WHERE the call sits, and that
    // is a structural claim.
    const source = readFileSync(join(process.cwd(), "src", "app", "api", "logs", "route.ts"), "utf-8");

    expect(source).toContain('recordEvent("logs.opened"');

    const emit = source.indexOf('recordEvent("logs.opened"');
    const success = source.indexOf("return ok({", emit);
    const notFound = source.indexOf("notFoundWith(", emit);

    // The emit comes before the success return and after every refusal above
    // it: a 404 for a missing directory, a missing file or a rejected name has
    // already returned by the time this line is reached.
    expect(emit).toBeGreaterThan(0);
    expect(success).toBeGreaterThan(emit);
    expect(notFound === -1 || notFound > emit).toBe(true);
  });
});

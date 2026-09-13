/** @jest-environment node */
// recordEvent must be best-effort: insert the event, but never throw into the
// caller and never write in read-only mode. The repository's insertEvent is
// mocked so these tests assert the emit contract, not the SQL.

jest.mock("@/lib/analytics/analytics-repository", () => ({ insertEvent: jest.fn() }));

import { insertEvent } from "@/lib/analytics/analytics-repository";
import { recordEvent } from "@/lib/analytics/record-event";

const mockInsert = insertEvent as jest.MockedFunction<typeof insertEvent>;

describe("recordEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CH_READ_ONLY;
  });

  it("forwards the full option shape to insertEvent (metadata → JSON)", () => {
    recordEvent("mission.dispatched", {
      entityType: "mission",
      entityId: "m1",
      profile: "bob",
      metadata: { tokens: 5 },
    });
    expect(mockInsert).toHaveBeenCalledWith({
      eventType: "mission.dispatched",
      entityType: "mission",
      entityId: "m1",
      profile: "bob",
      metadataJson: JSON.stringify({ tokens: 5 }),
    });
  });

  it("defaults all optional fields to null", () => {
    recordEvent("session.started");
    expect(mockInsert).toHaveBeenCalledWith({
      eventType: "session.started",
      entityType: null,
      entityId: null,
      profile: null,
      metadataJson: null,
    });
  });

  it("no-ops in read-only mode", () => {
    process.env.CH_READ_ONLY = "1";
    recordEvent("mission.dispatched", { entityId: "m1" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("never throws when insertEvent fails — logs instead", () => {
    mockInsert.mockImplementation(() => {
      throw new Error("db locked");
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => recordEvent("story.created", { entityId: "s1" })).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("swallows a non-serialisable metadata payload (circular ref)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => recordEvent("chat.message_sent", { metadata: circular })).not.toThrow();
    expect(mockInsert).not.toHaveBeenCalled(); // JSON.stringify threw before the insert
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

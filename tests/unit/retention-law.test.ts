/** @jest-environment node */
// The declared facts about the readings tables, held against the code they
// describe (ADR-0009, WG-ARCH-008).
//
// The point of these is not that the numbers are correct in the abstract, which
// no test can decide. It is that the numbers still mean what the ADR says they
// mean: the window sits above the longest read a live consumer performs, and the
// floor is not something a later edit can quietly walk down.

import {
  RETENTION_LAW,
  RETENTION_TABLES,
  isRetentionTable,
  validateRetainDays,
} from "@/lib/retention/retention-law";

describe("the declared retention law", () => {
  it("declares an owner and a consumer for every readings table", () => {
    for (const table of RETENTION_TABLES) {
      const law = RETENTION_LAW[table];
      expect(law.owner).toMatch(/^src\/lib\//);
      expect(law.consumer.length).toBeGreaterThan(10);
    }
  });

  it("keeps every window at or above its floor, and every floor above zero", () => {
    for (const table of RETENTION_TABLES) {
      const law = RETENTION_LAW[table];
      expect(law.floorDays).toBeGreaterThan(0);
      expect(law.defaultDays).toBeGreaterThanOrEqual(law.floorDays);
    }
  });

  // The defence for the analytics window, as an assertion rather than a
  // paragraph. 365 is the longest `sinceDays` default in analytics-repository.ts;
  // a window under it makes a live chart show a smaller answer than yesterday.
  it("keeps analytics_events above the longest read its consumers perform", () => {
    const law = RETENTION_LAW.analytics_events;
    expect(law.longestConsumerReadDays).toBe(365);
    expect(law.floorDays).toBeGreaterThanOrEqual(law.longestConsumerReadDays);
    expect(law.defaultDays).toBeGreaterThan(law.longestConsumerReadDays);
  });

  // Chat has no windowed consumer, so the honest declaration is zero rather than
  // an invented measurement, and the floor carries the protection instead.
  it("records chat_messages as having no windowed consumer, and floors it anyway", () => {
    const law = RETENTION_LAW.chat_messages;
    expect(law.longestConsumerReadDays).toBe(0);
    expect(law.floorDays).toBe(30);
  });

  it("recognises the two declared tables and nothing else", () => {
    expect(isRetentionTable("analytics_events")).toBe(true);
    expect(isRetentionTable("chat_messages")).toBe(true);
    expect(isRetentionTable("missions")).toBe(false);
    expect(isRetentionTable("")).toBe(false);
  });

  describe("validateRetainDays", () => {
    it("accepts the floor and anything above it", () => {
      expect(validateRetainDays("analytics_events", 365)).toEqual({ ok: true });
      expect(validateRetainDays("analytics_events", 4000)).toEqual({ ok: true });
      expect(validateRetainDays("chat_messages", 30)).toEqual({ ok: true });
    });

    it("refuses a window below the floor, and says why in a sentence", () => {
      const analytics = validateRetainDays("analytics_events", 90);
      expect(analytics.ok).toBe(false);
      expect(analytics.ok === false && analytics.reason).toMatch(/365 days/);
      expect(analytics.ok === false && analytics.reason).toMatch(/consumers read up to 365 days/);

      const chat = validateRetainDays("chat_messages", 3);
      expect(chat.ok).toBe(false);
      expect(chat.ok === false && chat.reason).toMatch(/shorter than a month/);
    });

    it("refuses a non-integer, which is how a fractional day becomes a surprise", () => {
      expect(validateRetainDays("analytics_events", 400.5).ok).toBe(false);
      expect(validateRetainDays("analytics_events", Number.NaN).ok).toBe(false);
    });
  });
});

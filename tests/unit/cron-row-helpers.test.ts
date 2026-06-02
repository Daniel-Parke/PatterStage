// Unit tests for the cron job row caption helper
// (src/lib/cron-row-helpers.ts)

import {
  computeCronJobRowCaption,
  type CronJobRowShape,
} from "@/lib/cron-row-helpers";

const NOW = new Date("2026-06-02T12:00:00Z").getTime();
const FIVE_MIN_AGO = new Date(NOW - 5 * 60_000).toISOString();
const FIVE_MIN_FROM_NOW = new Date(NOW + 5 * 60_000).toISOString();
const TEN_MIN_AGO_ISO = new Date(NOW - 10 * 60_000).toISOString();

function job(over: Partial<CronJobRowShape>): CronJobRowShape {
  return { ...over };
}

describe("computeCronJobRowCaption", () => {
  describe("priority 1: state === running", () => {
    it("returns 'Executing...' + green", () => {
      const caption = computeCronJobRowCaption(
        job({ state: "running" }),
        NOW,
      );
      expect(caption.text).toBe("Executing...");
      expect(caption.colorClass).toBe("text-neon-green");
    });

    it("'Executing...' wins even when lastRun/nextRun are populated", () => {
      const caption = computeCronJobRowCaption(
        job({
          state: "running",
          lastStatus: "ok",
          lastRun: FIVE_MIN_AGO,
          nextRun: FIVE_MIN_FROM_NOW,
        }),
        NOW,
      );
      expect(caption.text).toBe("Executing...");
    });
  });

  describe("priority 2: lastRun && !nextRun", () => {
    it("returns lastStatus + lastRun ago", () => {
      const caption = computeCronJobRowCaption(
        job({ lastStatus: "ok", lastRun: FIVE_MIN_AGO }),
        NOW,
      );
      expect(caption.text).toMatch(/^Ok \d+[smh] ago$/);
      expect(caption.colorClass).toBe("text-neon-green");
    });

    it("falls back to 'Ok' when lastStatus is null", () => {
      const caption = computeCronJobRowCaption(
        job({ lastStatus: null, lastRun: FIVE_MIN_AGO }),
        NOW,
      );
      expect(caption.text).toMatch(/^Ok \d/);
      expect(caption.colorClass).toBe("text-neon-green");
    });

    it("uses red colour when lastStatus is a non-ok value", () => {
      const caption = computeCronJobRowCaption(
        job({ lastStatus: "error", lastRun: FIVE_MIN_AGO }),
        NOW,
      );
      expect(caption.colorClass).toBe("text-red-400");
    });

    it("does NOT take this branch when nextRun is also set", () => {
      // Should fall through to priority 3
      const caption = computeCronJobRowCaption(
        job({
          lastStatus: "ok",
          lastRun: FIVE_MIN_AGO,
          nextRun: FIVE_MIN_FROM_NOW,
        }),
        NOW,
      );
      expect(caption.text).toMatch(/^Next /);
    });
  });

  describe("priority 3: nextRun && nextRun > now", () => {
    it("returns 'Next X' with green colour", () => {
      const caption = computeCronJobRowCaption(
        job({ nextRun: FIVE_MIN_FROM_NOW }),
        NOW,
      );
      expect(caption.text).toMatch(/^Next /);
      expect(caption.colorClass).toBe("text-neon-green");
    });

    it("does NOT take this branch when nextRun <= now", () => {
      const caption = computeCronJobRowCaption(
        job({ lastRun: FIVE_MIN_AGO, nextRun: TEN_MIN_AGO_ISO }),
        NOW,
      );
      // nextRun is in the past, falls through to priority 4
      expect(caption.text).toMatch(/^Active · Ran /);
    });
  });

  describe("priority 4: lastRun only when nextRun is also set", () => {
    it("returns 'Active · Ran X' with green colour when lastRun exists but nextRun is in the past", () => {
      // nextRun in the past means priority 3 is skipped; lastRun is set
      // so priority 4 wins.
      const caption = computeCronJobRowCaption(
        job({ lastRun: FIVE_MIN_AGO, nextRun: TEN_MIN_AGO_ISO }),
        NOW,
      );
      expect(caption.text).toMatch(/^Active · Ran /);
      expect(caption.colorClass).toBe("text-neon-green");
    });
  });

  describe("priority 5: fallback (Queued)", () => {
    it("returns 'Queued' with orange when nothing is set", () => {
      const caption = computeCronJobRowCaption(job({}), NOW);
      expect(caption.text).toBe("Queued");
      expect(caption.colorClass).toBe("text-neon-orange");
    });

    it("returns 'Queued' when nextRun is in the past and no lastRun", () => {
      const caption = computeCronJobRowCaption(
        job({ nextRun: TEN_MIN_AGO_ISO }),
        NOW,
      );
      expect(caption.text).toBe("Queued");
    });
  });
});

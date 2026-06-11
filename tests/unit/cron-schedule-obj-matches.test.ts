import { scheduleObjMatches } from "@/lib/cron/hermes-sync";

/**
 * Contract tests for `scheduleObjMatches` — the comparator used by the
 * 4th-layer reconciliation (`ensureCronHermesSync`) to detect on-disk
 * jobs.json artifacts left over from prior broken push paths.
 *
 * The session-2026-06-10 investigation found that the live mission
 * `5585c131` (Review & Refactor, every 30m) had been pushed to
 * `~/.hermes/cron/jobs.json` as `{kind: "every 30m", display: "..."}`
 * — an invalid `kind` the Python scheduler silently drops every tick.
 * After PR #170 fixed the push path, the DB column was canonical but
 * the disk artifact was still corrupted. The reconciliation uses
 * `scheduleObjMatches` to detect this and re-push.
 *
 * The comparator is semantic, not field-by-field: it must agree on
 * `kind` + the contract-bearing field (`expr` for cron, `minutes` for
 * interval) and IGNORE differences in `display` (a label, not a
 * contract — the user may have customised it).
 */
describe("scheduleObjMatches — reconciliation comparator", () => {
  describe("cron kind", () => {
    it("matches when both sides have the same expr", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *", display: "every 30m" };
      const onDisk = { kind: "cron", expr: "*/30 * * * *", display: "Every 30 minutes" };
      expect(scheduleObjMatches(onDisk, expected)).toBe(true);
    });

    it("ignores display field differences (display is a label, not a contract)", () => {
      const expected = { kind: "cron", expr: "0 9 * * 1-5" };
      const onDiskA = { kind: "cron", expr: "0 9 * * 1-5" };
      const onDiskB = { kind: "cron", expr: "0 9 * * 1-5", display: "Weekdays at 9am" };
      const onDiskC = { kind: "cron", expr: "0 9 * * 1-5", display: "DRASTICALLY DIFFERENT" };
      expect(scheduleObjMatches(onDiskA, expected)).toBe(true);
      expect(scheduleObjMatches(onDiskB, expected)).toBe(true);
      expect(scheduleObjMatches(onDiskC, expected)).toBe(true);
    });

    it("trims whitespace on expr", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      const onDisk = { kind: "cron", expr: "  */30 * * * *  " };
      expect(scheduleObjMatches(onDisk, expected)).toBe(true);
    });

    it("does NOT match when expr differs (the live mission bug would match this)", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      const onDisk = { kind: "cron", expr: "0 9 * * 1-5" };
      expect(scheduleObjMatches(onDisk, expected)).toBe(false);
    });

    it("does NOT match when on-disk has the broken 'every 30m' kind (the bug)", () => {
      // The live bug: `{kind: "every 30m", display: "every 30m"}` is on
      // disk, but the DB is canonical (`*/30 * * * *`). The expected
      // shape (from buildScheduleObjForHermes) is `{kind: "cron", ...}`.
      // The comparator must return false so the reconciliation re-pushes.
      const expected = { kind: "cron", expr: "*/30 * * * *", display: "every 30m" };
      const onDisk = { kind: "every 30m", display: "every 30m" };
      expect(scheduleObjMatches(onDisk, expected)).toBe(false);
    });
  });

  describe("interval kind", () => {
    it("matches when both sides have the same minutes", () => {
      const expected = { kind: "interval", minutes: 30, display: "every 30m" };
      const onDisk = { kind: "interval", minutes: 30, display: "Every 30 minutes" };
      expect(scheduleObjMatches(onDisk, expected)).toBe(true);
    });

    it("does NOT match when minutes differ", () => {
      const expected = { kind: "interval", minutes: 30 };
      const onDisk = { kind: "interval", minutes: 60 };
      expect(scheduleObjMatches(onDisk, expected)).toBe(false);
    });

    it("does NOT match when on-disk is missing minutes", () => {
      const expected = { kind: "interval", minutes: 30 };
      const onDisk = { kind: "interval" };
      expect(scheduleObjMatches(onDisk, expected)).toBe(false);
    });
  });

  describe("kind mismatches", () => {
    it("does NOT match when kind changes (cron -> interval)", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      const onDisk = { kind: "interval", minutes: 30 };
      expect(scheduleObjMatches(onDisk, expected)).toBe(false);
    });

    it("does NOT match when kind changes (invalid -> cron)", () => {
      // The legacy pre-#168 shape `{kind: "invalid", raw: "..."}` — the
      // reconciliation must re-push so the Python scheduler gets a
      // shape it can actually compute next_run_at from.
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      const onDisk = { kind: "invalid" };
      expect(scheduleObjMatches(onDisk, expected)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("does NOT match when on-disk is null or undefined", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      expect(scheduleObjMatches(null, expected)).toBe(false);
      expect(scheduleObjMatches(undefined, expected)).toBe(false);
    });

    it("does NOT match when on-disk is a string (legacy shape from old code)", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      expect(scheduleObjMatches("*/30 * * * *", expected)).toBe(false);
    });

    it("does NOT match when on-disk is a number", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      expect(scheduleObjMatches(42, expected)).toBe(false);
    });

    it("does NOT match when on-disk is an empty object", () => {
      const expected = { kind: "cron", expr: "*/30 * * * *" };
      expect(scheduleObjMatches({}, expected)).toBe(false);
    });
  });
});

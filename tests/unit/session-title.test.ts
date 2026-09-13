/**
 * session-title — fallback chain for session display titles.
 *
 * Pure unit tests (no DB, no Next.js). Verifies the documented fallback
 * chain in src/lib/session-title.ts:
 *   1. session.title wins
 *   2. for source=cron: "Cron: <cron job name from jobs.json>" (or job id)
 *   3. for source=mission: "Mission: <mission name>" (or id)
 *   4. for source=api: "API: <first 8 chars of id>"
 *   5. final fallback: "Session <first 8 chars of id>"
 */

import {
  formatSessionTitle,
  cronJobIdFromSessionId,
  parseCronSessionId,
  type CronJobEntry,
  type TitleInput,
} from "@/lib/sessions/session-title";

function makeInput(overrides: Partial<TitleInput> = {}): TitleInput {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    source: "cli",
    title: null,
    ...overrides,
  };
}

describe("formatSessionTitle", () => {
  describe("title field present", () => {
    it("returns the explicit title regardless of source", () => {
      expect(formatSessionTitle(makeInput({ source: "cli", title: "My session" }))).toBe(
        "My session",
      );
      expect(formatSessionTitle(makeInput({ source: "cron", title: "My cron" }))).toBe(
        "My cron",
      );
      expect(formatSessionTitle(makeInput({ source: "mission", title: "My mission" }))).toBe(
        "My mission",
      );
      expect(formatSessionTitle(makeInput({ source: "api", title: "My API call" }))).toBe(
        "My API call",
      );
    });
  });

  describe("source = cron", () => {
    it("uses the cron job name from the provided map when present", () => {
      const jobId = "22c05492-ee7a-4066-9193-de91c01b35c4";
      const jobs = new Map<string, CronJobEntry>([[jobId, { id: jobId, name: "Review & Refactor" }]]);
      const sessionId = `cron_${jobId}_20260601_185050`;
      expect(formatSessionTitle(makeInput({ id: sessionId, source: "cron" }), jobs)).toBe(
        "Cron: Review & Refactor",
      );
    });

    it("falls back to the job id prefix when the job is not in the map", () => {
      const sessionId = "cron_22c05492-ee7a-4066-9193-de91c01b35c4_20260601_185050";
      // Pass an explicit empty map so the test doesn't pick up the real
      // ~/.hermes/cron/jobs.json from the host filesystem.
      const emptyMap = new Map<string, CronJobEntry>();
      expect(
        formatSessionTitle(makeInput({ id: sessionId, source: "cron" }), emptyMap),
      ).toBe("Cron: 22c05492");
    });

    it("returns a generic Session <id> for malformed cron session ids", () => {
      // No underscore after cron_ → cronJobIdFromSessionId returns null → generic fallback
      expect(formatSessionTitle(makeInput({ id: "cron_malformed", source: "cron" }))).toBe(
        "Session cron_mal",
      );
    });
  });

  describe("source = mission", () => {
    it("uses profileName as a mission-name fallback when title is absent", () => {
      expect(
        formatSessionTitle(
          makeInput({ id: "abc12345-rest", source: "mission", profileName: "Refactor pass" }),
        ),
      ).toBe("Mission: Refactor pass");
    });

    it("returns a Mission <id> prefix when both title and profileName are missing", () => {
      expect(formatSessionTitle(makeInput({ id: "abc12345-rest", source: "mission" }))).toBe(
        "Mission abc12345",
      );
    });
  });

  describe("source = api", () => {
    it("returns API: <id prefix>", () => {
      expect(formatSessionTitle(makeInput({ id: "api-1234567890abcdef", source: "api" }))).toBe(
        "API: api-1234",
      );
    });
  });

  describe("generic / cli fallback", () => {
    it("returns Session <id prefix> for cli source", () => {
      expect(formatSessionTitle(makeInput({ id: "20260601_185236_ca8230", source: "cli" }))).toBe(
        "Session 20260601",
      );
    });

    it("returns Session <id prefix> for unknown source values", () => {
      // 8-character id prefix is used in the fallback regardless of source
      const result = formatSessionTitle(
        makeInput({ id: "x".repeat(16), source: "experiment" as TitleInput["source"] }),
      );
      expect(result).toBe("Session xxxxxxxx");
      expect(result).toHaveLength("Session ".length + 8);
    });
  });
});

describe("cronJobIdFromSessionId", () => {
  it("extracts the job uuid from a well-formed cron session id", () => {
    expect(
      cronJobIdFromSessionId("cron_22c05492-ee7a-4066-9193-de91c01b35c4_20260601_185050"),
    ).toBe("22c05492-ee7a-4066-9193-de91c01b35c4");
  });

  it("returns null when the session id does not start with cron_", () => {
    expect(cronJobIdFromSessionId("cli_abc_123")).toBeNull();
    expect(cronJobIdFromSessionId("")).toBeNull();
  });

  it("returns null when the cron_ prefix has no underscore-separated job id", () => {
    expect(cronJobIdFromSessionId("cron_")).toBeNull();
    expect(cronJobIdFromSessionId("cron_onlyonesegment")).toBeNull();
  });
});

describe("parseCronSessionId", () => {
  it("extracts the job id and remaining date+time segments", () => {
    expect(parseCronSessionId("cron_22c05492-ee7a-4066-9193-de91c01b35c4_20260601_185050")).toEqual({
      jobId: "22c05492-ee7a-4066-9193-de91c01b35c4",
      rest: ["20260601", "185050"],
    });
  });

  it("preserves any extra underscore-separated segments in rest", () => {
    // If Hermes ever adds a 5th segment, parseCronSessionId must not
    // silently drop it — the sync loop in session-repository.ts joins
    // rest with a space when building the "Cron: <name> — ..." title.
    expect(parseCronSessionId("cron_jobid_date_time_extra")).toEqual({
      jobId: "jobid",
      rest: ["date", "time", "extra"],
    });
  });

  it("returns null when the id does not start with cron_", () => {
    expect(parseCronSessionId("cli_jobid_date_time")).toBeNull();
    expect(parseCronSessionId("")).toBeNull();
  });

  it("returns null when the id has only the job id and no date/time", () => {
    // cron_<jobid> has just one segment after the prefix — no date+time to parse.
    expect(parseCronSessionId("cron_onlyonesegment")).toBeNull();
  });

  it("returns null when the id has only a job id and a trailing underscore", () => {
    // rest is [""] which has length 1 (not 2), so the date+time gate fails.
    expect(parseCronSessionId("cron_jobid_")).toBeNull();
  });
});

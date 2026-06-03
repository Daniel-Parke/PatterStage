// Unit tests for the cron-sync-failure shared helper
// (src/lib/cron-sync-failure.ts)
//
// The body shape `{ error: "Failed to sync cron job to Hermes",
//                    cronPushError: <pushResult.error ?? "unknown"> }`
// at status 502 was duplicated across 3 files before this helper
// landed. These tests lock the wire contract: the canonical error
// string, the `cronPushError` fallback to "unknown" when the push
// result is `ok: false` with no `error` field, the status code, and
// the console-logging shape from the response variant.

import { NextResponse } from "next/server";
import {
  cronSyncFailureBody,
  cronSyncFailureResponse,
} from "@/lib/cron-sync-failure";

describe("cronSyncFailureBody", () => {
  it("returns the canonical error string and the push error verbatim", () => {
    expect(cronSyncFailureBody({ ok: false, error: "disk full" })).toEqual({
      error: "Failed to sync cron job to Hermes",
      cronPushError: "disk full",
    });
  });

  it("falls back to 'unknown' for cronPushError when push error is missing", () => {
    expect(cronSyncFailureBody({ ok: false })).toEqual({
      error: "Failed to sync cron job to Hermes",
      cronPushError: "unknown",
    });
  });

  it("preserves an empty-string push error verbatim (?? is null/undefined only)", () => {
    // The helper preserves the original cron/route.ts behaviour: the
    // `?? "unknown"` fallback only fires for `null` / `undefined`. An
    // empty-string error from the pusher (rare, but possible if the
    // pusher ran a sub-process that exited 0 with no message) is
    // surfaced verbatim. This locks the byte-equivalence with the
    // pre-refactor `pushResult.error ?? "unknown"` form.
    expect(cronSyncFailureBody({ ok: false, error: "" })).toEqual({
      error: "Failed to sync cron job to Hermes",
      cronPushError: "",
    });
  });
});

describe("cronSyncFailureResponse", () => {
  // Capture console.error output from logApiError so we can assert the
  // log shape (route label + "pushJobToHermes" context + error message).
  let consoleSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("returns a NextResponse with status 502", async () => {
    const res = cronSyncFailureResponse("PUT /api/cron", { ok: false, error: "x" });
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(502);
  });

  it("body has the canonical error + cronPushError fields", async () => {
    const res = cronSyncFailureResponse("POST /api/missions", { ok: false, error: "hermes down" });
    const body = await res.json();
    expect(body).toEqual({
      error: "Failed to sync cron job to Hermes",
      cronPushError: "hermes down",
    });
  });

  it("uses 'unknown' fallback when push error is missing", async () => {
    const res = cronSyncFailureResponse("PUT /api/cron", { ok: false });
    const body = await res.json();
    expect(body).toEqual({
      error: "Failed to sync cron job to Hermes",
      cronPushError: "unknown",
    });
  });

  it("logs the failure with the route label, 'pushJobToHermes' context, and the underlying error", () => {
    cronSyncFailureResponse("PUT /api/cron", { ok: false, error: "hermes timeout" });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[API PUT /api/cron] Error pushJobToHermes: hermes timeout"),
    );
  });

  it("logs the 'unknown' fallback in the console line when push error is missing", () => {
    cronSyncFailureResponse("PUT /api/cron", { ok: false });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[API PUT /api/cron] Error pushJobToHermes: unknown"),
    );
  });

  it("matches the wire shape of the pre-refactor inline 502 in missions/route.ts and mission-promote-handler.ts", async () => {
    // The pre-refactor inline sites produced exactly this body — these
    // assertions lock the byte-equivalence contract for the migration.
    // If a future change alters the body keys, this test will fail and
    // force the author to either (a) preserve the wire contract or
    // (b) update all 3 call sites in lockstep.
    const res = cronSyncFailureResponse("POST /api/missions", { ok: false, error: "pusherr" });
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["cronPushError", "error"]);
    expect(res.status).toBe(502);
  });
});

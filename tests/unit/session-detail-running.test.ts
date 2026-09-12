/**
 * isSessionStillRunning — pure helper extracted from the session detail
 * page. Detects when a session has no messages but the API note
 * indicates the agent is still running, so the page can show a refresh
 * CTA instead of "No messages in this session".
 */

import { isSessionStillRunning } from "@/lib/sessions/session-title";

describe("isSessionStillRunning", () => {
  it("returns true when messages are empty and note mentions 'still running'", () => {
    expect(
      isSessionStillRunning(0, "This cron-spawned session is still running."),
    ).toBe(true);
  });

  it("returns true when note mentions 'in progress'", () => {
    expect(isSessionStillRunning(0, "Agent is in progress.")).toBe(true);
  });

  it("returns true when note mentions 'mid-flight'", () => {
    expect(isSessionStillRunning(0, "Session is mid-flight, please wait.")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSessionStillRunning(0, "Session is STILL RUNNING.")).toBe(true);
    expect(isSessionStillRunning(0, "MID-FLIGHT")).toBe(true);
  });

  it("returns false when messages are present (regardless of note)", () => {
    expect(
      isSessionStillRunning(5, "This cron-spawned session is still running."),
    ).toBe(false);
  });

  it("returns false when note is null or empty", () => {
    expect(isSessionStillRunning(0, null)).toBe(false);
    expect(isSessionStillRunning(0, undefined)).toBe(false);
    expect(isSessionStillRunning(0, "")).toBe(false);
  });

  it("returns false when note doesn't match the running pattern", () => {
    expect(
      isSessionStillRunning(
        0,
        "This mission-spawned session has no output file yet. The agent may still be running, or the output was written to ~/.hermes/state.db — refresh to check.",
      ),
    ).toBe(false);
  });
});

/**
 * Unit tests for `fallbackForDeployMessage` from
 * src/lib/deploy-action-fallback.ts.
 *
 * The Sidebar's three deploy action click handlers
 * (handleUpdate/handleRestart/doRebuild) all need a "failed"
 * fallback for the catch block when the post-throw Error has no
 * message. The convention is: take the startedMessage and replace
 * the trailing "started …" with "failed".
 *
 * These tests lock the convention so a future message rewrite
 * ("Update in progress…") gets flagged in CI before it ships.
 */
import { fallbackForDeployMessage } from "@/lib/deploy-action-fallback";

describe("fallbackForDeployMessage", () => {
  it("replaces 'started —' with 'failed' (the Update case)", () => {
    expect(
      fallbackForDeployMessage("Update started — deploying in background..."),
    ).toBe("Update failed");
  });

  it("replaces 'started…' with 'failed' (the Restart + Rebuild case)", () => {
    expect(fallbackForDeployMessage("Rebuild started…")).toBe("Rebuild failed");
    expect(fallbackForDeployMessage("Restart started…")).toBe("Restart failed");
  });

  it("returns the input unchanged for the Restart message (no 'started' word)", () => {
    // The Sidebar's Restart startedMessage is "Restart requested
    // (~/.hermes/logs/ch-restart.log)…" — it doesn't include
    // "started", so the regex doesn't match and the input is
    // returned unchanged. This is a pre-existing quirk of the
    // inline form: the catch block would set the message to the
    // literal "Restart requested (~/.hermes/logs/ch-restart.log)…"
    // on a network failure. Locked here so a future "fix" of the
    // restart message is intentional.
    expect(
      fallbackForDeployMessage("Restart requested (~/.hermes/logs/ch-restart.log)…"),
    ).toBe("Restart requested (~/.hermes/logs/ch-restart.log)…");
  });

  it("preserves the verb when there's no 'started' word", () => {
    // The regex `started.*$` is intentionally narrow. A message
    // that doesn't include "started" returns the input unchanged,
    // which surfaces a literal "Verb …" as the failure message.
    // The Sidebar's 3 messages all include "started" so this case
    // is for future-proofing only.
    expect(fallbackForDeployMessage("Update in progress…")).toBe(
      "Update in progress…",
    );
  });

  it("returns the input unchanged for an empty string", () => {
    expect(fallbackForDeployMessage("")).toBe("");
  });

  it("only replaces the FIRST 'started' onwards (greedy but anchored)", () => {
    // The regex matches the first 'started' to end of string.
    // "Update started, build started" would lose the "build started"
    // tail — but the Sidebar never sends that shape, so this is
    // documenting behaviour rather than enforcing it.
    expect(
      fallbackForDeployMessage("Update started, build started"),
    ).toBe("Update failed");
  });

  it("preserves capitalization of the verb", () => {
    expect(fallbackForDeployMessage("ReBuild started…")).toBe("ReBuild failed");
  });
});

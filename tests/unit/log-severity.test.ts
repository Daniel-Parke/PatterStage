/** @jest-environment node */
// detectSeverity classifies a log line by its LEVEL PREFIX — whichever level
// keyword appears first wins, so a WARNING line whose body mentions "error"
// stays a warning (it was flooding the Errors panel with red chips).

import { detectSeverity } from "@/lib/sync/sources/LogSync";

describe("detectSeverity", () => {
  it("classes a WARNING line as a warning even when the body says 'error'", () => {
    expect(
      detectSeverity("WARNING agent.auxiliary_client: marking openrouter unhealthy for 60s (payment / credit error)"),
    ).toBe("warning");
  });

  it("classes a genuine ERROR line as error", () => {
    expect(detectSeverity("2026-06-22 ERROR something blew up")).toBe("error");
  });

  it("classes a CRITICAL line as critical", () => {
    expect(detectSeverity("CRITICAL fatal: out of memory")).toBe("critical");
  });

  it("does not mis-class an ERROR line that mentions 'warning' later", () => {
    expect(detectSeverity("ERROR config: ignoring deprecated warning flag")).toBe("error");
  });

  it("falls back to error for a 'failed' line with no explicit level", () => {
    expect(detectSeverity("request failed after 3 retries")).toBe("error");
  });
});

/** @jest-environment node */

import { injectMissingTimestamps, parseLogLine } from "@/lib/log-line-format";

describe("parseLogLine", () => {
  describe("agent.log standard format", () => {
    it("parses YYYY-MM-DD HH:MM:SS,SSS LEVEL source: message", () => {
      const result = parseLogLine("2026-05-11 10:20:04,123 ERROR gateway.run: Connection refused");
      expect(result.timestamp).toBe("2026-05-11 10:20:04,123");
      expect(result.level).toBe("error");
      expect(result.message).toBe("gateway.run: Connection refused");
    });

    it("parses YYYY-MM-DD HH:MM:SS (no milliseconds) format", () => {
      const result = parseLogLine("2026-05-11 10:20:04 ERROR gateway.run: Service started");
      expect(result.timestamp).toBe("2026-05-11 10:20:04");
      expect(result.level).toBe("error");
    });

    it("parses plain date-prefixed line without level", () => {
      const result = parseLogLine("2026-05-11 10:20:04 Next.js 16.2.3 started");
      expect(result.timestamp).toBe("2026-05-11 10:20:04");
      expect(result.level).toBe("unknown");
      expect(result.message).toBe("Next.js 16.2.3 started");
    });
  });

  describe("ISO-8601 and slash formats", () => {
    it("parses YYYY-MM-DDTHH:MM:SSZ ISO format", () => {
      const result = parseLogLine("2026-05-11T10:20:04.000Z ERROR test");
      expect(result.timestamp).toBe("2026-05-11T10:20:04.000Z");
      expect(result.level).toBe("error");
    });

    it("parses YYYY/MM/DD slash-separated date", () => {
      const result = parseLogLine("2026/05/11 10:20:04 INFO test");
      expect(result.timestamp).toBe("2026/05/11 10:20:04");
      expect(result.level).toBe("info");
    });
  });

  describe("watchdog / hardware-cron format: [TIMESTAMP] LEVEL [SOURCE] message", () => {
    it("parses watchdog INFO entry — timestamp extracted, level from message", () => {
      // Format: [YYYY-MM-DD HH:MM:SS] INFO [WATCHDOG] OK: ...
      const result = parseLogLine("[2026-05-09 01:34:37] INFO [WATCHDOG] OK: PatterStage is running on port 3000");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("info");
      expect(result.message).toBe("OK: PatterStage is running on port 3000");
    });

    it("parses watchdog WARN entry", () => {
      const result = parseLogLine("[2026-05-09 01:34:37] WARN [WATCHDOG] PatterStage NOT responding on port 3000");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("warn");
      expect(result.message).toBe("PatterStage NOT responding on port 3000");
    });

    it("parses watchdog ERROR entry", () => {
      const result = parseLogLine("[2026-05-09 01:34:37] ERROR [WATCHDOG] FAIL: PatterStage restart failed");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("error");
      expect(result.message).toBe("FAIL: PatterStage restart failed");
    });

    it("parses ch-health stub format with INFO prefix", () => {
      // Format: [YYYY-MM-DD HH:MM:SS] INFO [ch-health] Health check triggered
      const result = parseLogLine("[2026-05-11 10:52:00] INFO [ch-health] Health check triggered");
      expect(result.timestamp).toBe("2026-05-11 10:52:00");
      expect(result.level).toBe("info");
      expect(result.message).toBe("Health check triggered");
    });

    it("parses ch-sysmon stub format", () => {
      const result = parseLogLine("[2026-05-11 09:00:00] INFO [ch-sysmon] System monitor triggered");
      expect(result.timestamp).toBe("2026-05-11 09:00:00");
      expect(result.level).toBe("info");
      expect(result.message).toBe("System monitor triggered");
    });

    it("parses old-style [TIMESTAMP] [SOURCE] format (backward compat)", () => {
      // Old format: [YYYY-MM-DD HH:MM:SS] [SOURCE] msg — no explicit level keyword.
      // parseLogLine extracts timestamp, then falls back to unknown level and raw message.
      // The raw line is preserved in this case since there's no level to extract.
      const result = parseLogLine("[2026-05-09 01:34:37] [WATCHDOG] OK: All services healthy");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("unknown");
      // Message contains the full original line since no structured parsing matched
      expect(result.message).toContain("WATCHDOG");
      expect(result.message).toContain("OK:");
    });
  });

  describe("explicit [LEVEL] bracket format", () => {
    it("parses [ERROR] standalone bracket", () => {
      const result = parseLogLine("[ERROR] Connection refused");
      expect(result.level).toBe("error");
      expect(result.message).toBe("Connection refused");
    });

    it("parses [WARN] standalone bracket", () => {
      const result = parseLogLine("[WARN] Disk space low");
      expect(result.level).toBe("warn");
    });

    it("parses [INFO] standalone bracket", () => {
      const result = parseLogLine("[INFO] Service started");
      expect(result.level).toBe("info");
    });

    it("parses [DEBUG] standalone bracket", () => {
      const result = parseLogLine("[DEBUG] Verbose output here");
      expect(result.level).toBe("debug");
    });
  });

  describe("API timestamp injection fallback", () => {
    it("parses API-injected YYYY-MM-DD HH:MM:SS format (mtime prefix)", () => {
      // The API injects mtime as "YYYY-MM-DD HH:MM:SS <original line>"
      const result = parseLogLine("2026-05-11 10:20:04 ▲ Next.js 16.2.3");
      expect(result.timestamp).toBe("2026-05-11 10:20:04");
      expect(result.level).toBe("unknown");
      expect(result.message).toBe("▲ Next.js 16.2.3");
    });

    it("does not double-inject on already-timestamped line", () => {
      const result = parseLogLine("2026-05-11 10:20:04 ▲ Next.js 16.2.3");
      // Recognised as timestamped — no mtime injection needed in API
      expect(result.timestamp).toBe("2026-05-11 10:20:04");
    });
  });

  describe("epoch conversion", () => {
    // These test the epoch path in parseLogLine. Epoch timestamps must NOT start
    // with a digit that looks like a date (4-digit year prefix) to avoid matching
    // RE_SPACE_TS first. We use a very large number (far future) that won't be
    // confused with a date-formatted timestamp.
    it("converts Unix epoch seconds (far-future value avoids RE_SPACE_TS)", () => {
      // 4102444800 = 2100-01-01 00:00:00 UTC — 10 digits, unambiguous
      const result = parseLogLine("4102444800 INFO test");
      expect(result.timestamp).toBe("2100-01-01 00:00:00");
      expect(result.level).toBe("info");
    });

    it("converts Unix epoch milliseconds (13 digits)", () => {
      const result = parseLogLine("4102444800000 INFO test");
      expect(result.timestamp).toBe("2100-01-01 00:00:00");
    });
  });

  describe("finishParse — RE_BRACKET_LEVEL path (bracket level after timestamp+plain-level prefix)", () => {
    // NOTE: RE_LEADING_LEVEL_PLAIN runs before RE_BRACKET_LEVEL in finishParse's else branch.
    // When both a plain level prefix (e.g. "ERROR gateway.run:") and a bracket level (e.g. [ERROR])
    // are present, the leading plain level wins and the bracket is treated as plain message text.
    it("treats [ERROR] bracket as plain text when preceded by plain-level source prefix", () => {
      const result = parseLogLine("2026-05-11 10:20:04 ERROR gateway.run: [ERROR] Connection refused");
      expect(result.level).toBe("error");
      expect(result.message).toBe("gateway.run: [ERROR] Connection refused");
    });

    it("treats [WARN] bracket as plain text when preceded by plain-level source prefix", () => {
      const result = parseLogLine("2026-05-11 10:20:04 INFO app: [WARN] Low memory");
      expect(result.level).toBe("info");
      expect(result.message).toBe("app: [WARN] Low memory");
    });

    it("treats [DEBUG] bracket as plain text when preceded by plain-level source prefix", () => {
      const result = parseLogLine("2026-05-11 10:20:04 ERROR service: [DEBUG] verbose details");
      expect(result.level).toBe("error");
      expect(result.message).toBe("service: [DEBUG] verbose details");
    });
  });

  describe("finishParse — RE_LEADING_LEVEL_PLAIN strip path", () => {
    it("extracts level from leading LEVEL source: and preserves source in message", () => {
      // "ERROR gateway.run: Connection refused" -> level=error, message="gateway.run: Connection refused"
      const result = parseLogLine("2026-05-11 10:20:04 ERROR gateway.run: Connection refused");
      expect(result.level).toBe("error");
      expect(result.message).toBe("gateway.run: Connection refused");
    });

    it("handles WARN with source label", () => {
      const result = parseLogLine("2026-05-11 10:20:04 WARN auth: Invalid token");
      expect(result.level).toBe("warn");
      expect(result.message).toBe("auth: Invalid token");
    });

    it("handles INFO with source label", () => {
      const result = parseLogLine("2026-05-11 10:20:04 INFO server: Listening on port 3000");
      expect(result.level).toBe("info");
      expect(result.message).toBe("server: Listening on port 3000");
    });

    it("falls back to levelFromMessage when no colon follows plain level token", () => {
      // "ERROR Something went wrong" — no colon, RE_LEADING_LEVEL_PLAIN doesn't match.
      // levelFromMessage sees "ERROR" and returns "error"; message is stripped of the level token.
      const result = parseLogLine("2026-05-11 10:20:04 ERROR Something went wrong");
      expect(result.level).toBe("error");
      expect(result.message).toBe("Something went wrong");
    });
  });

  describe("edge cases", () => {
    it("returns empty for blank lines", () => {
      const result = parseLogLine("");
      expect(result.message).toBe("");
      expect(result.timestamp).toBeNull();
    });

    it("returns unknown level for completely unstructured content", () => {
      const result = parseLogLine("just some random text with no structure");
      expect(result.level).toBe("unknown");
    });
  });
});

describe("injectMissingTimestamps", () => {
  const FALLBACK = "2026-05-11 10:20:04";

  it("injects the fallback on lines without a parseable timestamp", () => {
    const out = injectMissingTimestamps(
      ["plain text with no timestamp", "another bare line"],
      FALLBACK,
    );
    expect(out).toEqual([
      `${FALLBACK} plain text with no timestamp`,
      `${FALLBACK} another bare line`,
    ]);
  });

  it("leaves lines that already have a parseable timestamp unchanged", () => {
    const lines = [
      "2026-05-11 09:00:00 INFO already has a timestamp",
      "2026-05-11T09:00:00.000Z ISO format",
      "2026/05/11 09:00:00 slash format",
      "[2026-05-11 09:00:00] bracket format",
    ];
    const out = injectMissingTimestamps(lines, FALLBACK);
    expect(out).toEqual(lines);
  });

  it("leaves empty / whitespace-only lines unchanged (no garbage timestamps)", () => {
    const lines = ["", "   ", "\t"];
    const out = injectMissingTimestamps(lines, FALLBACK);
    expect(out).toEqual(lines);
  });

  it("injected timestamps round-trip through parseLogLine (no UI special-casing)", () => {
    const out = injectMissingTimestamps(["bare line"], FALLBACK);
    const parsed = parseLogLine(out[0]);
    expect(parsed.timestamp).toBe(FALLBACK);
  });

  it("mixes injected and existing timestamps in one call", () => {
    const lines = [
      "2026-05-11 09:00:00 INFO has timestamp",
      "bare line gets injected",
      "another bare",
    ];
    const out = injectMissingTimestamps(lines, FALLBACK);
    expect(out).toEqual([
      "2026-05-11 09:00:00 INFO has timestamp",
      `${FALLBACK} bare line gets injected`,
      `${FALLBACK} another bare`,
    ]);
  });
});

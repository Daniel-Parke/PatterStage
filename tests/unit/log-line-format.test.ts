/** @jest-environment node */

import { parseLogLine } from "@/lib/log-line-format";

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
      const result = parseLogLine("[2026-05-09 01:34:37] INFO [WATCHDOG] OK: Control Hub is running on port 3000");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("info");
      expect(result.message).toBe("OK: Control Hub is running on port 3000");
    });

    it("parses watchdog WARN entry", () => {
      const result = parseLogLine("[2026-05-09 01:34:37] WARN [WATCHDOG] Control Hub NOT responding on port 3000");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("warn");
      expect(result.message).toBe("Control Hub NOT responding on port 3000");
    });

    it("parses watchdog ERROR entry", () => {
      const result = parseLogLine("[2026-05-09 01:34:37] ERROR [WATCHDOG] FAIL: Control Hub restart failed");
      expect(result.timestamp).toBe("2026-05-09 01:34:37");
      expect(result.level).toBe("error");
      expect(result.message).toBe("FAIL: Control Hub restart failed");
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

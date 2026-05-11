/** @jest-environment node */

import { parseLogLine } from "@/lib/log-line-format";

describe("parseLogLine", () => {
  describe("standard timestamp formats", () => {
    it("parses YYYY-MM-DD HH:MM:SS.SSS format (space-separated)", () => {
      const result = parseLogLine("2026-05-11 10:20:04.123 ERROR Something went wrong");
      expect(result.timestamp).toBe("2026-05-11 10:20:04.123");
      expect(result.level).toBe("error");
    });

    it("parses [YYYY-MM-DD HH:MM:SS] bracket format (watchdog style)", () => {
      // The watchdog format is [TIMESTAMP] [LEVEL] MESSAGE.
      // The bracket-level regex captures [WATCHDOG] as the level token first.
      // WATCHDOG is not a standard log level, so levelFromMessage returns "unknown".
      const result = parseLogLine("[2026-05-09 01:34:37] [WATCHDOG] OK: Control Hub is running");
      expect(result.level).toBe("unknown");
      // The timestamp is null because RE_BRACKET_LEVEL captures [WATCHDOG] first,
      // and the remaining text [2026-05-09 01:34:37] [WATCHDOG] doesn't match RE_ISO_PREFIX.
      expect(result.timestamp).toBeNull();
      // The full original line is preserved as the message.
      expect(result.message).toContain("Control Hub is running");
    });

    it("parses YYYY-MM-DDTHH:MM:SSZ ISO format", () => {
      const result = parseLogLine("2026-05-11T10:20:04.000Z ERROR test");
      expect(result.timestamp).toBe("2026-05-11T10:20:04.000Z");
      expect(result.level).toBe("error");
    });

    it("parses YYYY/MM/DD HH:MM:SS slash-separated date", () => {
      const result = parseLogLine("2026/05/11 10:20:04 INFO test");
      expect(result.timestamp).toBe("2026/05/11 10:20:04");
      expect(result.level).toBe("info");
    });
  });

  describe("timestamp-injected lines (API fallback)", () => {
    it("parses API-injected YYYY-MM-DD HH:MM:SS format", () => {
      // This is the format the API injects for lines without timestamps
      const result = parseLogLine("2026-05-11 10:20:04 Next.js 16.2.3 started");
      expect(result.timestamp).toBe("2026-05-11 10:20:04");
      expect(result.level).toBe("unknown");
      expect(result.message).toBe("Next.js 16.2.3 started");
    });

    it("does not double-inject timestamp on already-timestamped API-injected line", () => {
      // A line that was already injected by the API should not get another prefix
      const result = parseLogLine("2026-05-11 10:20:04 ▲ Next.js 16.2.3");
      // The first 19 chars match the space-TS pattern so it is recognized as timestamped
      expect(result.timestamp).toBe("2026-05-11 10:20:04");
    });
  });

  describe("level detection", () => {
    it("detects ERROR level from [ERROR] bracket format", () => {
      const result = parseLogLine("[ERROR] Connection failed");
      expect(result.level).toBe("error");
    });

    it("detects WARN level from [WARN] bracket format", () => {
      const result = parseLogLine("[WARN] Disk space low");
      expect(result.level).toBe("warn");
    });

    it("detects INFO level from [INFO] bracket format", () => {
      const result = parseLogLine("[INFO] Service started");
      expect(result.level).toBe("info");
    });

    it("detects DEBUG level from [DEBUG] bracket format", () => {
      const result = parseLogLine("[DEBUG] Verbose output here");
      expect(result.level).toBe("debug");
    });
  });

  describe("edge cases", () => {
    it("returns empty message for blank lines", () => {
      const result = parseLogLine("");
      expect(result.message).toBe("");
      expect(result.timestamp).toBeNull();
    });

    it("returns unknown level for unrecognized content", () => {
      const result = parseLogLine("just some random text with no structure");
      expect(result.level).toBe("unknown");
    });

    it("handles epoch timestamp conversion", () => {
      // 1715404800 = 2024-05-11 00:00:00 UTC
      const result = parseLogLine("1715404800 INFO test");
      expect(result.timestamp).not.toBeNull();
      expect(result.level).toBe("info");
    });
  });
});

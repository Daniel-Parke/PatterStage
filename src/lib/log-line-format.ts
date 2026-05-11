/**
 * Parse plain-text log lines into timestamp, level, and message for aligned display.
 */

export type ParsedLogLevel = "error" | "warn" | "info" | "debug" | "unknown";

export interface ParsedLogLine {
  timestamp: string | null;
  level: ParsedLogLevel;
  message: string;
}

const RE_SPACE_TS =
  /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)\s+(.*)$/;
const RE_ISO_PREFIX =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/;
const RE_SLASH_TS =
  /^(\d{4}\/\d{2}\/\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)\s+(.*)$/;
/** Matches [TIMESTAMP] where TIMESTAMP looks like YYYY-MM-DD HH:MM:SS */
const RE_BRACKET_TS = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)\]/;
/** Matches [TS] LEVEL [SOURCE] msg where TS=YYYY-MM-DD HH:MM:SS */
const RE_WATCHDOG = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+([A-Z]{3,})\s+\[([^\]]+)\]\s*(.*)$/;
const RE_BRACKET_LEVEL = /^\[(DEBUG|INFO|INF|WARN|WARNING|ERROR|ERR|FATAL|TRACE)\]\s*(.*)$/i;
const RE_EPOCH = /^(\d{10}|\d{13})(\s+|$)(.*)$/;

function levelFromToken(token: string): ParsedLogLevel | null {
  const u = token.toUpperCase();
  if (u === "ERROR" || u === "ERR" || u === "FATAL") return "error";
  if (u === "WARN" || u === "WARNING") return "warn";
  if (u === "INFO" || u === "INF" || u === "TRACE") return "info";
  if (u === "DEBUG") return "debug";
  return null;
}

function levelFromMessage(text: string): ParsedLogLevel {
  const upper = text.toUpperCase();
  if (/\b(ERROR|ERR|FATAL)\b/.test(upper) || text.includes("Error")) {
    return "error";
  }
  if (/\b(WARN|WARNING)\b/.test(upper)) return "warn";
  if (/\bDEBUG\b/.test(upper)) return "debug";
  if (/\b(INFO|INF)\b/.test(upper)) return "info";
  return "unknown";
}

/**
 * Parse a single log line into display fields.
 *
 * Supported formats:
 *   1. YYYY-MM-DD HH:MM:SS[,SSS] LEVEL source: msg   (agent.log standard)
 *   2. YYYY-MM-DD HH:MM:SS[,SSS] msg                 (date-prefixed plain)
 *   3. [YYYY-MM-DD HH:MM:SS] [SOURCE] msg            (watchdog/hardware-cron)
 *   4. [LEVEL] msg                                   (explicit level bracket)
 *   5. [YYYY-MM-DD HH:MM:SS] msg                     (bracket timestamp only)
 *   6. epoch seconds / milliseconds
 */
export function parseLogLine(raw: string): ParsedLogLine {
  const line = raw.replace(/\r$/, "");
  if (!line) {
    return { timestamp: null, level: "unknown", message: "" };
  }

  let rest = line;
  let timestamp: string | null = null;
  let level: ParsedLogLevel = "unknown";

  const tryTs = (re: RegExp): boolean => {
    const m = rest.match(re);
    if (!m) return false;
    timestamp = m[1];
    rest = m[2] ?? "";
    return true;
  };

  // 1. Standard timestamp at start: YYYY-MM-DD HH:MM:SS.SSS
  if (tryTs(RE_SPACE_TS)) {
    return finishParse(timestamp, rest);
  }
  // 2. ISO-8601 with T separator
  if (tryTs(RE_ISO_PREFIX)) {
    return finishParse(timestamp, rest);
  }
  // 3. Slash-separated date
  if (tryTs(RE_SLASH_TS)) {
    return finishParse(timestamp, rest);
  }
  // 4. Epoch timestamp
  const epoch = rest.match(RE_EPOCH);
  if (epoch) {
    const ms = epoch[1].length === 13 ? Number(epoch[1]) : Number(epoch[1]) * 1000;
    if (Number.isFinite(ms)) {
      try {
        timestamp = new Date(ms).toISOString().replace("T", " ").slice(0, 19);
      } catch {
        timestamp = epoch[1];
      }
      rest = (epoch[3] ?? "").trimStart();
      return finishParse(timestamp, rest);
    }
  }

  // 5. [TS] LEVEL [SOURCE] msg — dedicated handler for watchdog/hardware-cron format
  const wd = rest.match(RE_WATCHDOG);
  if (wd) {
    return {
      timestamp: wd[1],
      level: levelFromToken(wd[2]) ?? levelFromMessage(wd[4] ?? ""),
      message: (wd[4] ?? "").trim() || line,
    };
  }

  // 6. Bracket formats — extract timestamp from [YYYY-MM-DD HH:MM:SS] if present
  const bracketTs = rest.match(RE_BRACKET_TS);
  if (bracketTs) {
    timestamp = bracketTs[1];
    rest = rest.slice(bracketTs[0].length).trimStart();
  }

  // 7. Try explicit [LEVEL] bracket (ERROR, WARN, INFO, DEBUG, etc.)
  const explicitLevel = rest.match(RE_BRACKET_LEVEL);
  if (explicitLevel) {
    level = levelFromToken(explicitLevel[1]) ?? levelFromMessage(rest);
    rest = explicitLevel[2] ?? "";
    return { timestamp, level, message: rest.trim() || line };
  }

  // 8. No recognisable format — derive level from content
  return { timestamp, level: levelFromMessage(line), message: line };
}

/** Strip a leading LEVEL token, e.g. "ERROR gateway.run: Connection refused" -> "gateway.run: Connection refused" */
const RE_LEADING_LEVEL_PLAIN = /^([A-Z]{3,})\s+(\S+:)\s*/;

function finishParse(ts: string | null, msg: string): ParsedLogLine {
  const trimmed = msg.trimStart();
  let level: ParsedLogLevel = "unknown";
  let message = trimmed;

  const br = trimmed.match(RE_BRACKET_LEVEL);
  if (br) {
    level = levelFromToken(br[1]) ?? levelFromMessage(trimmed);
    message = (br[2] ?? "").trim();
  } else {
    const leadPlain = trimmed.match(RE_LEADING_LEVEL_PLAIN);
    if (leadPlain) {
      level = levelFromToken(leadPlain[1]) ?? levelFromMessage(trimmed);
      // Preserve the source name in the message (e.g. "gateway.run:" from "ERROR gateway.run: msg")
      const sourceLabel = leadPlain[2] ?? "";
      const remaining = trimmed.slice(leadPlain[0].length);
      message = sourceLabel ? `${sourceLabel} ${remaining}` : remaining;
    } else {
      level = levelFromMessage(trimmed);
      message = trimmed;
    }
  }

  return { timestamp: ts, level, message: message || trimmed };
}
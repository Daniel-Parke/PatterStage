// ═══════════════════════════════════════════════════════════════
// log-line-severity.ts — how the Logs panel decides what a line IS.
//
// Pulled out of LogInsights.tsx because it is the arithmetic behind numbers an
// operator reads, and arithmetic that decides a number should be testable
// without rendering a donut. tests/unit/log-line-severity.test.ts is its oracle.
//
// ── Not the same job as detectSeverity() in src/lib/sync/sources/LogSync.ts ──
//
// That one looks similar and must not be merged with this one. LogSync has
// already SELECTED the lines it cares about before it classifies them, so its
// fallback for a line with no level keyword is "error", and that is right
// there. Here every line in the operator's current view is classified,
// including the 90% of a log that is ordinary output, so the same fallback
// would mark the whole file as errors. Two callers, two contracts; the
// resemblance is the trap.
//
// ── What this counts, and why it changed (T-0034) ───────────────────────────
//
// The previous rule was one regex: a line containing the word "error", "err",
// "fail", "fatal", "exception" or "traceback" was an error. That is the whole
// heuristic, and it read `Found 0 errors` as an error, `completed with no
// errors` as an error, and `[INFO] error budget still healthy` as an error.
// Every false positive went twice into the panel: once into the error donut,
// and again into the clean-rate ring, which is 1 - errors/total. A clean tsc
// run reported errors and a health score below 100%.
//
// The rule now works in the order a log line is actually written:
//
//   1. A LEVEL the logger emitted wins. `[WARN] one probe failed` is a warning,
//      whatever the prose after it says, because the process that wrote the
//      line already classified it and it knows better than a regex does.
//   2. NEGATED and ZERO-COUNTED mentions are struck out before anything is
//      counted, so "no errors", "without failures" and "errors: 0" say nothing.
//   3. Only what survives both is read as prose.
//
// It is still a heuristic over unstructured text and it will still be wrong on
// something. What it may no longer be is wrong in the flattering direction on
// its own initiative: `Found 0 errors` was the single most common line in this
// app's own build logs, and it was being counted as a failure.
// ═══════════════════════════════════════════════════════════════

export type LogSeverity = "error" | "warn" | "info";

/** Level names a logger writes, longest first so `error` beats `err`. */
const LEVELS = "fatal|critical|crit|error|err|warning|warn|notice|info|debug|trace";

/** `level=error`, `severity: WARN`, `lvl="info"` — a structured level field. */
const LEVEL_FIELD = new RegExp(String.raw`\b(?:level|lvl|severity)\s*[=:]\s*"?(${LEVELS})\b`, "i");

/**
 * A level TAG at the head of a line or inside a bracket: `[ERROR]`, `ERROR:`,
 * `<warn>`, `INFO - started`. The trailing delimiter is what makes it a tag
 * rather than a word, which is why `information:` and `errorProne.ts` do not
 * match it.
 */
const LEVEL_TAG = new RegExp(
  String.raw`(?:^|[\s[(<|])(${LEVELS})(?:\s*[\]>)|:]|\s+[-|]\s)`,
  "i",
);

/**
 * A mention that says the thing did NOT happen: "no errors", "0 failures",
 * "without warnings", "errors: 0", "error_count=0", "errorCount: 0".
 * Struck out of the line before the prose pass looks at what is left.
 */
const NEGATED = new RegExp(
  String.raw`\b(?:no|zero|0|none|without)\s+(?:new\s+|other\s+|further\s+)?` +
    String.raw`(?:errors?|failures?|fail(?:ed|s)?|warn(?:ing)?s?|exceptions?)\b`,
  "gi",
);

const ZERO_COUNTED = new RegExp(
  String.raw`\b(?:errors?|failures?|fail(?:ed|s)?|warn(?:ing)?s?|exceptions?)` +
    String.raw`(?:[_\s-]?count)?\s*[:=]\s*0\b`,
  "gi",
);

/**
 * Match a word only when it is not part of a longer identifier. `\b` alone is
 * not enough: it happily matches inside `warnings-as-values.md` and
 * `error.log`, which are filenames rather than events. A trailing `.` that ends
 * a sentence is still a match, because `an error.` is an error.
 */
function mentions(text: string, words: string): boolean {
  return new RegExp(String.raw`(?<![\w./-])(?:${words})(?![./-]?\w)`, "i").test(text);
}

const ERROR_WORDS = "errors?|fatal|critical|exceptions?|traceback|fail(?:ed|s|ure|ures)?|panic(?:ked)?";
const WARN_WORDS = "warn(?:ing)?s?|deprecated";

/** The severity of one raw log line. See the header for what each tier means. */
export function severityOf(line: string): LogSeverity {
  const tag = LEVEL_FIELD.exec(line) ?? LEVEL_TAG.exec(line);
  if (tag) {
    const level = tag[1].toLowerCase();
    if (level === "fatal" || level === "critical" || level === "crit" || level === "error" || level === "err") {
      return "error";
    }
    if (level === "warning" || level === "warn") return "warn";
    return "info";
  }

  const residue = line.replace(NEGATED, " ").replace(ZERO_COUNTED, " ");
  if (mentions(residue, ERROR_WORDS)) return "error";
  if (mentions(residue, WARN_WORDS)) return "warn";
  return "info";
}

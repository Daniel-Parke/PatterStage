// log-line-severity.ts — how the Logs panel decides what a line IS, out of
// LogInsights.tsx so the arithmetic behind an operator's numbers is testable
// without rendering a donut (tests/unit/log-line-severity.test.ts is its oracle).
//
// Not detectSeverity() in src/lib/sync/sources/LogSync.ts, and not to be merged
// with it: LogSync classifies lines it has already SELECTED, so "error" is the
// right fallback for a line with no level keyword there. Here every line in
// view is classified, and that fallback would mark the whole file as errors.
//
// T-0034 replaced one regex (any line containing "error", "err", "fail",
// "fatal", "exception" or "traceback"). Be precise about what it got wrong,
// because the first write-up and the task record overstated it: it ended in
// `\b`, so plurals such as `Found 0 errors` were already info. What it
// miscounted was the singular and the incidental mention (`no error found`,
// `[INFO] error budget still healthy`), each going into the error donut and
// the clean-rate ring alike. KNOWN NARROWING: a bare `err` in prose is now
// info, since in running text it is as often the verb; the LEVEL TAG spelling
// (`npm ERR!`, the commonest failure line in a Node project) still counts.
//
// The rule works in the order a line is written: negated and zero-counted
// mentions are struck first; a level the logger emitted beats the prose after
// it, since the writer knows better than a regex; only what survives is read as
// prose. Still a heuristic, but no longer wrong in the flattering direction.

export type LogSeverity = "error" | "warn" | "info";

/** Level names a logger writes, longest first so `error` beats `err`. */
const LEVELS = "fatal|critical|crit|error|err|warning|warn|notice|info|debug|trace";

/** `level=error`, `severity: WARN`, `lvl="info"` — a structured level field. */
const LEVEL_FIELD = new RegExp(String.raw`\b(?:level|lvl|severity)\s*[=:]\s*"?(${LEVELS})\b`, "i");

/**
 * A level TAG at the head of a line or inside a bracket: `[ERROR]`, `ERROR:`,
 * `<warn>`, `INFO - started`, `npm ERR!`. The trailing delimiter makes it a tag
 * rather than a word (`information:` and `errorProne.ts` do not match). `!` is
 * in the set for `npm ERR!`, which otherwise has no tag and, since a bare `err`
 * is deliberately not an error word, is not caught by the prose pass either.
 */
const LEVEL_TAG = new RegExp(
  String.raw`(?:^|[\s[(<|])(${LEVELS})(?:\s*[\]>)|:!]|\s+[-|]\s)`,
  "i",
);

/**
 * A mention that says it did NOT happen: "no errors", "0 failures", "without
 * warnings", "errors: 0", "error_count=0". Struck out before the prose pass.
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
 * A word not inside a longer identifier. `\b` alone matches inside
 * `warnings-as-values.md` and `error.log`, which are filenames, not events. A
 * sentence-ending `.` still matches, because `an error.` is an error.
 */
function mentions(text: string, words: string): boolean {
  return new RegExp(String.raw`(?<![\w./-])(?:${words})(?![./-]?\w)`, "i").test(text);
}

const ERROR_WORDS = "errors?|fatal|critical|exceptions?|traceback|fail(?:ed|s|ure|ures)?|panic(?:ked)?";
const WARN_WORDS = "warn(?:ing)?s?|deprecated";

/** The severity of one raw log line. See the header for what each tier means. */
export function severityOf(line: string): LogSeverity {
  // Strike negated and zeroed mentions FIRST. With the tag pass first, `error: 0`
  // matched LEVEL_TAG on `error:`, so a line reporting no errors counted as one.
  const residue = line.replace(NEGATED, " ").replace(ZERO_COUNTED, " ");

  const tag = LEVEL_FIELD.exec(residue) ?? LEVEL_TAG.exec(residue);
  if (tag) {
    const level = tag[1].toLowerCase();
    if (level === "fatal" || level === "critical" || level === "crit" || level === "error" || level === "err") {
      return "error";
    }
    if (level === "warning" || level === "warn") return "warn";
    return "info";
  }

  if (mentions(residue, ERROR_WORDS)) return "error";
  if (mentions(residue, WARN_WORDS)) return "warn";
  return "info";
}

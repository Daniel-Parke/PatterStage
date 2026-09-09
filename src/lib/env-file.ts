// ══════════════════════════════════════════════════════════════════════════════
// env-file — parse the entire .env file into a key→value Map
// ══════════════════════════════════════════════════════════════════════════════
//
// Sister module to `env-line.ts` (which parses a single line into a
// discriminated union for the read-only .env preview UI). This module
// parses the WHOLE file into a `Map<string, string>` for sync/import
// code that needs the full key→value table.

/**
 * Match a single .env key=value line. The key must be a valid identifier
 * (`[A-Za-z_][A-Za-z0-9_]*`); the value is everything after the first `=`
 * (no shell-quote stripping at this layer — callers that need to interpret
 * the value can strip quotes themselves; the sibling `env-line.ts`
 * `parseEnvLine` does this for the UI preview).
 *
 * Exported for `serializeEnvFile` in `@/modules/hermes/lib/config-sync.ts` which
 * needs to identify keyval lines while iterating the raw file (it
 * preserves comments and blank lines, so it can't just call
 * `parseEnvFile` and lose the surrounding context).
 */
export const ENV_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/**
 * Parse the entire content of a .env file into a `Map<string, string>`.
 *
 * Skip rules:
 *   - blank lines (whitespace-only after `trim()`) → ignored
 *   - lines starting with `#` (comments) → ignored
 *   - lines without a `=` (malformed) → ignored
 *   - duplicate keys → last write wins
 *
 * Newline handling: splits on `\r?\n` so both Unix (`\n`) and Windows
 * (`\r\n`) line endings are accepted.
 *
 * @param content - The full file content. Empty string returns an empty Map.
 * @returns Map of key → raw value (no quote stripping at this layer).
 *
 * @example
 *   const m = parseEnvFile("FOO=bar\n# comment\nBAZ=qux\n");
 *   // m = Map(2) { "FOO" => "bar", "BAZ" => "qux" }
 */
export function parseEnvFile(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const m = ENV_LINE_RE.exec(line);
    if (!m) continue;
    out.set(m[1]!, m[2]!);
  }
  return out;
}

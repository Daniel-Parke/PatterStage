// ══════════════════════════════════════════════════════════════════════════════
// env-line — parse a single .env file line for the read-only preview UI
// ══════════════════════════════════════════════════════════════════════════════
//
// The .env preview in /config/[section] is a read-only security display: it
// never writes back, never logs, and never sends the value to the client
// without masking via `maskKeyHint`. Extracting the line parser here lets
// us unit-test the 6 edge cases (blank, comment, no `=`, has `=`, leading-
// whitespace, quoted values) without round-tripping through the page.

/** A parsed .env line. The `kind` discriminates the variant. */
export type EnvLine =
  | { kind: "blank" }
  | { kind: "comment"; raw: string }
  | { kind: "invalid"; raw: string }
  | { kind: "keyval"; key: string; value: string };

/**
 * Parse a single .env line into a structured variant.
 *
 * - empty / whitespace-only → "blank"
 * - starts with `#` (after trim) → "comment"
 * - contains no `=` → "invalid" (displayed as plain text)
 * - otherwise → "keyval" with leading/trailing whitespace stripped from
 *   the key and the value, plus single/double quotes stripped from the
 *   value (matching the standard .env unquoting behaviour used by dotenv,
 *   python-dotenv, and friends).
 */
export function parseEnvLine(line: string): EnvLine {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "blank" };
  if (trimmed.startsWith("#")) return { kind: "comment", raw: line };

  const eqIdx = line.indexOf("=");
  if (eqIdx < 0) return { kind: "invalid", raw: line };

  const key = line.slice(0, eqIdx).trim();
  const value = line
    .slice(eqIdx + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  return { kind: "keyval", key, value };
}

/**
 * Build a stable React `key` for an .env line at index `i`. The key
 * combines the line index with a sanitized prefix of the raw line
 * text so React can identify lines across re-renders — the line
 * index alone is insufficient (two adjacent blank lines would both
 * get key `env-3`); the prefix alone is insufficient (two identical
 * blank lines would collapse). The 24-char prefix limit caps the
 * string length while still being unique-enough for the typical
 * 2-4 KB .env preview.
 *
 * The non-alphanumeric replacement (`[^a-zA-Z0-9]` → `-`) keeps the
 * key safe for React's `key` prop (no whitespace, no special chars
 * that would force React to warn about complex keys).
 *
 * Single call site today (`/agent/settings/[section]/page.tsx` .env preview),
 * but co-located with `parseEnvLine` so any future surface that
 * maps over .env lines (editor, linter, formatter) reuses the
 * identical key shape — keys from one surface stay stable when
 * round-tripped through another.
 */
export function envLineKey(line: string, i: number): string {
  return `env-${i}-${line.slice(0, 24).replace(/[^a-zA-Z0-9]/g, "-")}`;
}

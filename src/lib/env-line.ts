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

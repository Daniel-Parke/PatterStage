// env-line — parse one .env line for the read-only preview in /config/[section],
// which never writes back, never logs, and masks every value via `maskKeyHint`.

/** A parsed .env line. The `kind` discriminates the variant. */
export type EnvLine =
  | { kind: "blank" }
  | { kind: "comment"; raw: string }
  | { kind: "invalid"; raw: string }
  | { kind: "keyval"; key: string; value: string };

/**
 * blank, comment (`#` after trim), invalid (no `=`, shown as plain text), or
 * keyval with key and value trimmed and surrounding single/double quotes
 * stripped from the value, as dotenv and python-dotenv do.
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
 * A stable React key for line `i`: index plus a sanitised 24-char prefix, since
 * neither alone identifies a line across re-renders (the prefix collapses
 * identical lines). Non-alphanumerics become `-` so React does not warn.
 */
export function envLineKey(line: string, i: number): string {
  return `env-${i}-${line.slice(0, 24).replace(/[^a-zA-Z0-9]/g, "-")}`;
}

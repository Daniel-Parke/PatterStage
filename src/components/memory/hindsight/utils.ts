// ═══════════════════════════════════════════════════════════════
// Shared parsing utilities for Hindsight memory data
// ═══════════════════════════════════════════════════════════════

/** Parse the raw Python repr string from the Hindsight API into clean fields */
export function parseMemoryContent(raw: string): { text: string; type: string; tags: string[] } {
  const textMatch = raw.match(/'text':\s*'((?:[^'\\]|\\.)*)'/);
  const typeMatch =
    raw.match(/'fact_type':\s*'([^']*)'/) || raw.match(/(?:^|[^'])type='([^']*)'/);
  const tagsMatch =
    raw.match(/tags=\[(.*?)\]/) || raw.match(/'tags':\s*\[(.*?)\]/);
  const text = textMatch ? textMatch[1] : raw;
  const type = typeMatch ? typeMatch[1] : "unknown";
  const tags = tagsMatch
    ? tagsMatch[1]
        .split(",")
        .map((t) => t.trim().replace(/^'|'$/g, ""))
        .filter(Boolean)
    : [];
  return { text, type, tags };
}

/** Parse the reflect response Python repr — extract text='...' from the repr string */
export function parseReflectResponse(raw: string): string {
  const match = raw.match(/^text='((?:[^'\\]|\\.)*)'/);
  return match ? match[1] : raw;
}

/**
 * Coerce a string field with a default fallback. Centralises the
 * `typeof x === "string" ? x : fallback` pattern that appears
 * repeatedly in the HindsightBrowser when reading a payload field
 * that may be absent or non-string (e.g. an LLM-generated error
 * object instead of a plain string).
 *
 * The return type narrows based on the fallback: when `fallback` is
 * omitted, the result is `string | undefined`; when a fallback is
 * provided, the result is always `string` (the union with the
 * fallback is widened to `string` because `string` is assignable to
 * `string | undefined`).
 */
export function stringOr(value: unknown): string | undefined;
export function stringOr(value: unknown, fallback: string): string;
export function stringOr(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" ? value : fallback;
}

/** Badge colour for Hindsight fact_type */
export function hindsightFactTypeBadgeColor(t: string): "cyan" | "purple" | "orange" | "green" | "gray" {
  const n = t.toLowerCase();
  if (n === "observation") return "cyan";
  if (n === "world") return "purple";
  if (n === "directive") return "orange";
  if (n === "experience") return "green";
  return "gray";
}
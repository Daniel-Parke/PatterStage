// ═══════════════════════════════════════════════════════════════
// Shared parsing utilities for Hindsight memory data
// ═══════════════════════════════════════════════════════════════
//
// The direct-HTTP bridge (`@/lib/memory/hindsight-bridge`) returns plain
// JSON objects — no Python `repr()` strings to parse.

/**
 * Coerce a string field with a default fallback, for payload fields that
 * may be absent or non-string (e.g. an LLM-generated error object instead
 * of a plain string).
 */
export function stringOr(value: unknown): string | undefined;
export function stringOr(value: unknown, fallback: string): string;
export function stringOr(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" ? value : fallback;
}

/** Tailwind className for the standard Hindsight modal text `<input>`. */
export const HINDSIGHT_TEXT_INPUT_CLASS =
  "w-full bg-ps-surface-inset border border-ps-edge rounded-ps-md px-3 py-2 text-body text-ps-text-primary";

/**
 * Tailwind className for the standard Hindsight modal `<textarea>`. The
 * call site composes the height separately:
 * `className={\`w-full h-32 ${HINDSIGHT_TEXTAREA_CLASS}\`}`. Intentionally
 * separate from `HINDSIGHT_TEXT_INPUT_CLASS` (`p-3 resize-none` vs `px-3 py-2`).
 */
export const HINDSIGHT_TEXTAREA_CLASS =
  "bg-ps-surface-inset border border-ps-edge rounded-ps-md p-3 text-body text-ps-text-primary resize-none";

/** Badge colour for Hindsight fact_type */
export function hindsightFactTypeBadgeColor(t: string): "cyan" | "purple" | "orange" | "green" | "gray" {
  const n = t.toLowerCase();
  if (n === "observation") return "cyan";
  if (n === "world") return "purple";
  if (n === "directive") return "orange";
  if (n === "experience") return "green";
  return "gray";
}
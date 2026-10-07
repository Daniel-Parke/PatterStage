import type { RunUsage } from "@/lib/runtime/types";

function finiteCount(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? count : undefined;
}

/** Stored counts use the app vocabulary; provider responses have a separate normaliser. */
export function parseStoredUsage(raw: string | null | undefined): RunUsage | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const usage = value as Record<string, unknown>;
    const inputTokens = finiteCount(usage.inputTokens) ?? 0;
    const outputTokens = finiteCount(usage.outputTokens) ?? 0;
    // A derived sum may overflow; retain its valid components for cost calculation.
    const totalTokens = finiteCount(usage.totalTokens) ?? inputTokens + outputTokens;
    return { inputTokens, outputTokens, totalTokens };
  } catch {
    return null;
  }
}

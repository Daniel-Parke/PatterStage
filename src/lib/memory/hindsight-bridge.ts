// ═══════════════════════════════════════════════════════════════
// Hindsight Bridge Helpers — Pure functions for shaping Hindsight
// HTTP responses into the shapes used by the /api/memory/hindsight
// route handlers and the HindsightBrowser component.
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/api/memory/hindsight/route.ts so they can be
// unit-tested directly. The route handler imports them and stays a
// thin shell over the HTTP transport + these pure mappers.

/**
 * Normalize tags from arbitrary input (POST body, Hindsight response field)
 * into a deduplicated, lowercased, trimmed string array.
 *
 * - Non-string entries are dropped
 * - Whitespace is trimmed; empty strings are dropped
 * - Duplicates are removed
 * - Order is preserved (first-occurrence wins)
 */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [
    ...new Set(
      tags
        .filter((t): t is string => typeof t === "string" && t.trim() !== "")
        .map((t) => t.trim().toLowerCase()),
    ),
  ];
}

/** Mapped memory item — consumed by HindsightBrowser's "memories" tab. */
export interface MappedMemory {
  id: unknown;
  content: string;
  type: string;
  created_at: string;
  tags: unknown;
  entities: unknown;
  /** Hindsight's proof_count, named for what it is (T-0101, D63). */
  proofCount: number;
}

/** Map a raw Hindsight memory entry to the UI's expected shape. */
export function mapMemoryItem(item: Record<string, unknown>): MappedMemory {
  return {
    id: item.id,
    content: (item.text as string) || (item.content as string) || "",
    type: (item.fact_type as string) || "experience",
    created_at: (item.date as string) || (item.created_at as string) || "",
    tags: item.tags ?? [],
    entities: item.entities ?? "",
    proofCount: (item.proof_count as number) || 0,
  };
}

/** Mapped directive — consumed by HindsightBrowser's "directives" tab. */
export interface MappedDirective {
  id: string;
  name: string;
  content: string;
  priority: number;
  is_active: boolean;
  tags: unknown;
  created_at: string;
}

/** Map a raw Hindsight directive entry to the UI's expected shape. */
export function mapDirectiveItem(d: Record<string, unknown>): MappedDirective {
  return {
    id: (d.id as string) || "",
    name: (d.name as string) || "",
    content: (d.content as string) || "",
    priority: (d.priority as number) || 0,
    is_active: (d.is_active as boolean) ?? true,
    tags: d.tags ?? [],
    created_at: (d.created_at as string) || "",
  };
}

/** Mapped mental model — consumed by HindsightBrowser's "mental models" tab. */
export interface MappedMentalModel {
  id: string;
  name: string;
  source_query: string;
  content: string;
  tags: unknown;
  created_at: string;
  last_refreshed_at: string;
}

/** Map a raw Hindsight mental-model entry to the UI's expected shape. */
export function mapMentalModelItem(
  m: Record<string, unknown>,
): MappedMentalModel {
  return {
    id: (m.id as string) || "",
    name: (m.name as string) || "",
    source_query: (m.source_query as string) || "",
    content: (m.content as string) || "",
    tags: m.tags ?? [],
    created_at: (m.created_at as string) || "",
    last_refreshed_at: (m.last_refreshed_at as string) || "",
  };
}

"use client";

// ═══════════════════════════════════════════════════════════════
// useToolsetCatalog — human labels for toolset ids, over HTTP
//
// ToolsetSelector is the one toolset consumer that must NOT move into the hermes
// module: it is rendered from the mission composer, which ADR-0005 keeps in core
// as the `commission` verb. What it edits is PatterStage's own columns
// (missions.suggested_toolsets, catalog_templates.suggested_toolsets), which are
// prompt hints and are not enforced at dispatch.
//
// Its only Hermes dependency was a compile-time import of a label lookup table.
// The catalogue is already served over HTTP by GET /api/tools, which the selector's
// sibling hook useProfileToolsets already talks to, so reading it there removes
// the last core->module edge in the toolsets cluster without moving core UI into a
// vendor module.
//
// Falls back to the raw id, exactly as toolsetCatalogLabel did for an unknown id.
// The only behaviour change is that labels arrive a beat late on first paint; ids
// are already human-readable (`web_search`, `session_search`), so an unresolved
// id reads as a slightly rawer label rather than an empty control.
// ═══════════════════════════════════════════════════════════════

import { useApiResource } from "./useApiResource";

interface ToolsetCatalogEntry {
  id: string;
  label: string;
}

/** `toolsetLabel(id)` returns the catalogue label, or the id when unknown. */
export function useToolsetCatalog(): { toolsetLabel: (id: string) => string } {
  const { data } = useApiResource<Record<string, string>>(
    ["toolset-catalog"],
    "/api/tools",
    {
      select: (payload) =>
        Object.fromEntries(
          ((payload as { toolsets?: ToolsetCatalogEntry[] } | undefined)?.toolsets ?? []).map(
            (t) => [t.id, t.label],
          ),
        ),
      fallback: {},
    },
  );
  const map = data ?? {};
  return { toolsetLabel: (id: string) => map[id] ?? id };
}

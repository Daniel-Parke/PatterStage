// ═══════════════════════════════════════════════════════════════
// PageTitle — set the browser tab title for a (mostly client) page
//
// Most PatterStage pages are client components and can't export Next metadata,
// so every page would otherwise share the root layout's static title. Rendering
// this (via PageHeader, which every page passes a title to) sets a per-page
// document.title client-side. No cleanup/restore — each page sets its own, so
// restoring on unmount would only clobber the next page's title mid-navigation.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { labelFor } from "@/lib/modules/registry";

/**
 * The page's name, from the registry when the page passes none (T-0097, D55):
 * the rail entry and the tab title are then the same word by construction.
 */
export function useRegistryTitle(title?: string): string {
  const pathname = usePathname();
  return title ?? labelFor(pathname ?? "/") ?? "";
}

export default function PageTitle({ title }: { title?: string }) {
  const resolved = useRegistryTitle(title);
  useEffect(() => {
    if (resolved) document.title = `${resolved} · PatterStage`;
  }, [resolved]);
  return null;
}

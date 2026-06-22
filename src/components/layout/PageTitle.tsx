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

export default function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    if (title) document.title = `${title} · PatterStage`;
  }, [title]);
  return null;
}

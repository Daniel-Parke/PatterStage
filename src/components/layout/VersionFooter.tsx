// ═══════════════════════════════════════════════════════════════
// VersionFooter — the sidebar's "Check for updates / Rebuild / Restart" block.
// Polls GET /api/update for version + deploy status; POSTs the three deploy
// actions. Collapsed and expanded render modes. Extracted from Sidebar.tsx.
// ═══════════════════════════════════════════════════════════════
//
// This file is now the seam between the two: useVersionFooter
// (src/hooks/useVersionFooter.ts) owns the state machine and every call
// to /api/update, and VersionFooterViews.tsx owns the two render modes.
// Splitting on that line is what the repo guide means by "page-core hook
// + render shell", applied to a component instead of a page.

"use client";

import { useVersionFooter } from "@/hooks/useVersionFooter";

import { VersionFooterCollapsed, VersionFooterExpanded } from "./VersionFooterViews";

export function VersionFooter({ collapsed }: { collapsed: boolean }) {
  const state = useVersionFooter();

  if (collapsed) {
    return <VersionFooterCollapsed state={state} />;
  }

  return <VersionFooterExpanded state={state} />;
}

// ═══════════════════════════════════════════════════════════════
// RailFooter — the version, and an update badge when there is one
//
// The rail used to end in three deploy buttons and a branch dropdown, which
// 403'd on every production install that had not set the flag and took the
// rail past 720px. They live on Settings > System now (T-0097, decision 12).
// This reads two things: the install's version and commit from
// /api/status/runtime, and whether origin is ahead from /api/update (cached
// server-side for five minutes). Neither can spawn anything. It renders
// INLINE, beside the collapse button, because every row the footer takes is a
// row the nav loses at 720px.
//
// Both reads go through useApiResource (T-0129). The runtime status is a read
// the Quests host makes too, and the footer fetching it raw on mount meant
// every screen paid for it twice; keyed on the endpoint it is one request.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { ArrowUpCircle } from "lucide-react";

import Badge from "@/components/ui/Badge";
import { useApiResource } from "@/hooks/useApiResource";

interface RuntimeSlice {
  appVersion?: string;
  gitHash?: string;
}

interface UpdateSlice {
  updateAvailable?: boolean;
  behind?: number;
  checkFailed?: boolean;
}

export function RailFooter({ collapsed }: { collapsed: boolean }) {
  const runtime = useApiResource<RuntimeSlice>("/api/status/runtime", {
    select: (p) => (p as RuntimeSlice | null) ?? undefined,
    staleTime: 60_000,
  });
  const update = useApiResource<UpdateSlice>("/api/update", {
    select: (p) => (p as UpdateSlice | null) ?? undefined,
    staleTime: 5 * 60_000,
  });

  const version = runtime.data?.appVersion ?? null;
  const gitHash = runtime.data?.gitHash ?? null;
  const u = update.data;
  const behind = !u || u.checkFailed ? null : u.updateAvailable ? Math.max(1, u.behind ?? 1) : 0;

  const updateAvailable = behind !== null && behind > 0;
  // The version alone in the rail: with the commit beside it the line
  // truncated to "v0.1.0 ·…" at 224px, which said less than the version
  // alone (the review of 2026-09-08, P4). The commit is the tooltip's, and
  // Settings › System's, where it already was (T-0134).
  const line = version ? `v${version}` : null;
  const detail = version ? `v${version}${gitHash && gitHash !== "unknown" ? ` · ${gitHash}` : ""}` : null;

  const badge = updateAvailable ? (
    <Link
      href="/agent/settings/system"
      aria-label="Update available"
      title={`Update available: ${behind} commit${behind === 1 ? "" : "s"} behind. Open System to install it.`}
      className="flex items-center min-h-6"
    >
      {/* A badge, on the rail's attention accent (the quest count wears the
          same orange), not a card: it is a chip beside the version line. */}
      <Badge color="orange" variant="outline" className="p-1 hover:bg-neon-orange/10 transition-colors">
        <ArrowUpCircle className="w-3.5 h-3.5 flex-shrink-0" />
      </Badge>
    </Link>
  ) : null;

  if (collapsed) return badge;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {badge}
      <span className="text-micro font-mono text-ps-text-faint truncate" title={detail ?? undefined}>
        {line ?? ""}
      </span>
    </span>
  );
}

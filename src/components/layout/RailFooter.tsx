// ═══════════════════════════════════════════════════════════════
// RailFooter — the version, and an update badge when there is one
//
// The rail used to end in three deploy buttons and a branch dropdown, which
// 403'd on every production install that had not set the flag and took the
// rail past 720px. They live on Settings > System now (T-0097, decision 12).
// This reads two things once on mount: the install's version and commit from
// /api/status/runtime, and whether origin is ahead from /api/update (cached
// server-side for five minutes). Neither can spawn anything. It renders
// INLINE, beside the collapse button, because every row the footer takes is a
// row the nav loses at 720px.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpCircle } from "lucide-react";

import { safeApiCallData } from "@/lib/api-fetch";

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
  const [version, setVersion] = useState<string | null>(null);
  const [gitHash, setGitHash] = useState<string | null>(null);
  const [behind, setBehind] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const runtime = await safeApiCallData<RuntimeSlice>("/api/status/runtime");
      if (cancelled) return;
      if (runtime?.appVersion) setVersion(runtime.appVersion);
      if (runtime?.gitHash) setGitHash(runtime.gitHash);
    })();
    void (async () => {
      const update = await safeApiCallData<UpdateSlice>("/api/update");
      if (cancelled || !update || update.checkFailed) return;
      setBehind(update.updateAvailable ? Math.max(1, update.behind ?? 1) : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateAvailable = behind !== null && behind > 0;
  const line = version ? `v${version}${gitHash && gitHash !== "unknown" ? ` · ${gitHash}` : ""}` : null;

  // The badge is icon-only with a name, so it fits beside the version text
  // in the one footer row; System says how far behind and offers the update.
  const badge = updateAvailable ? (
    <Link
      href="/agent/settings/system"
      aria-label="Update available"
      title={`Update available: ${behind} commit${behind === 1 ? "" : "s"} behind. Open System to install it.`}
      className="flex items-center rounded-md bg-orange-500/10 border border-orange-500/20 p-1 text-neon-orange hover:bg-orange-500/20 transition-colors"
    >
      <ArrowUpCircle className="w-3.5 h-3.5 flex-shrink-0" />
    </Link>
  ) : null;

  if (collapsed) return badge;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {badge}
      <span className="text-xs font-mono text-ps-text-faint truncate" title={line ?? undefined}>
        {line ?? ""}
      </span>
    </span>
  );
}

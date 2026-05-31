"use client";

import { ArrowDownToLine, ArrowUpToLine, Loader2 } from "lucide-react";

interface ProfileSyncBarProps {
  selectedSlug: string | null;
  onPushAll: () => void;
  onPullAll: () => void;
  onImportDiscovered?: () => void;
  onPushOne: (slug: string) => void;
  onPullOne: (slug: string) => void;
  busy: boolean;
}

export default function ProfileSyncBar({
  selectedSlug,
  onPushAll,
  onPullAll,
  onImportDiscovered,
  onPushOne,
  onPullOne,
  busy,
}: ProfileSyncBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onPushAll()}
        title="Push all profiles and Bob from database to Hermes disk"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono rounded-lg border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ArrowUpToLine className="w-3.5 h-3.5" />
        )}
        Push all
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onPullAll()}
        title="Pull all profiles and Bob from Hermes disk into database"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono rounded-lg border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ArrowDownToLine className="w-3.5 h-3.5" />
        )}
        Pull all
      </button>
      {onImportDiscovered ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onImportDiscovered()}
          title="Import profile directories on disk that are not yet in SQLite"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono rounded-lg border border-white/15 text-white/50 hover:bg-white/5 disabled:opacity-50"
        >
          Import discovered
        </button>
      ) : null}
      {selectedSlug != null ? (
        <>
          <span className="text-white/20">|</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPushOne(selectedSlug)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-neon-purple/80 hover:text-neon-purple"
          >
            <ArrowUpToLine className="w-3 h-3" />
            Push {selectedSlug}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPullOne(selectedSlug)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-neon-cyan/80 hover:text-neon-cyan"
          >
            <ArrowDownToLine className="w-3 h-3" />
            Pull {selectedSlug}
          </button>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { pluralise } from "@/lib/utils";

interface ProfilesDriftBannerProps {
  driftCount: number;
  errorCount: number;
  onPushAll: () => void;
  pushing: boolean;
}

export default function ProfilesDriftBanner({
  driftCount,
  errorCount,
  onPushAll,
  pushing,
}: ProfilesDriftBannerProps) {
  if (driftCount === 0 && errorCount === 0) return null;

  const parts: string[] = [];
  if (driftCount > 0) {
    parts.push(`${driftCount} profile${pluralise(driftCount)} drifted from database`);
  }
  if (errorCount > 0) {
    parts.push(`${errorCount} sync error${pluralise(errorCount)}`);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neon-orange/20 bg-neon-orange/5 mb-4">
      <AlertTriangle className="w-4 h-4 text-neon-orange/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono text-neon-orange/80">
          Profile drift — database and Hermes disk differ
        </span>
        <p className="mt-1 text-[10px] font-mono text-white/30">
          {parts.join(" · ")}. Pull imports disk into SQLite; Push writes canonical config.yaml.
        </p>
      </div>
      <button
        type="button"
        disabled={pushing}
        onClick={() => void onPushAll()}
        className="px-3 py-1 text-[10px] font-mono text-neon-orange/70 hover:text-neon-orange bg-neon-orange/10 hover:bg-neon-orange/20 rounded-lg transition-colors disabled:opacity-50"
      >
        {pushing ? "Pushing…" : "Push all to Hermes"}
      </button>
    </div>
  );
}

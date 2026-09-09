"use client";

import { AlertTriangle } from "lucide-react";
import { pluralise } from "@/lib/utils";
import { driftBannerHeadline } from "./drift-banner-headline";

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
  const headline = driftBannerHeadline({ driftCount, errorCount });
  if (!headline) return null;

  const parts: string[] = [];
  if (driftCount > 0) {
    parts.push(`${driftCount} profile${pluralise(driftCount)} drifted from database`);
  }
  if (errorCount > 0) {
    parts.push(`${errorCount} sync error${pluralise(errorCount)}`);
  }

  return (
    // flex-wrap, and the button basis-full below sm: on a phone the headline
    // sat in a 150px column beside "Push all to Hermes" (the review of
    // 2026-09-08). The sentences come first; the button wraps under them
    // and sits beside them again from sm (T-0131).
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-ps-lg border border-neon-orange/20 bg-neon-orange/5 mb-4">
      <AlertTriangle className="w-4 h-4 text-neon-orange/90 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-micro font-mono text-neon-orange/90">
          {headline}
        </span>
        <p className="mt-1 text-micro font-mono text-ps-text-muted">
          {parts.join(" · ")}. Pull imports disk into SQLite; Push writes canonical config.yaml.
        </p>
      </div>
      <button
        type="button"
        disabled={pushing}
        onClick={() => void onPushAll()}
        className="basis-full w-fit px-3 py-1 text-micro font-mono text-neon-orange/90 hover:text-neon-orange bg-neon-orange/10 hover:bg-neon-orange/20 rounded-ps-md transition-colors disabled:opacity-50 sm:basis-auto"
      >
        {pushing ? "Pushing…" : "Push all to Hermes"}
      </button>
    </div>
  );
}

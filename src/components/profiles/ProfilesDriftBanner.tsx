"use client";

import { AlertTriangle } from "lucide-react";
import { pluralise } from "@/lib/utils";
import { driftBannerHeadline } from "./drift-banner-headline";

interface ProfilesDriftBannerProps {
  driftCount: number;
  errorCount: number;
}

/**
 * States the drift and names the action. The banner carried its own "Push all
 * to Hermes" sixty pixels above the sync bar's "Push all": the same write, two
 * buttons, the banner's the more prominent though the bar's is the canonical
 * one beside Pull all (the review of 2026-09-08). One control per action; the
 * sentence says where it is (T-0132).
 */
export default function ProfilesDriftBanner({ driftCount, errorCount }: ProfilesDriftBannerProps) {
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
    <div className="flex items-start gap-3 px-4 py-3 rounded-ps-lg border border-neon-orange/20 bg-neon-orange/5 mb-4">
      <AlertTriangle className="mt-0.5 w-4 h-4 text-neon-orange/90 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-micro font-mono text-neon-orange/90">
          {headline}
        </span>
        <p className="mt-1 text-micro font-mono text-ps-text-muted">
          {parts.join(" · ")}. Push all, below, writes canonical config.yaml; Pull all imports disk into SQLite.
        </p>
      </div>
    </div>
  );
}

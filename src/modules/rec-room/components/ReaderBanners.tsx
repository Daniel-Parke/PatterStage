// ── ReaderBanners — the two fixed banners above the reader.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx.
// ReaderErrorBanner is the dismissible per-action error, including the
// auto-generation pause note; StoryFailureBanner is the sticky one for a
// story whose generation failed outright. Both are presentation: the
// error state and the retry route stay on the page.

"use client";

import { AlertTriangle, X } from "lucide-react";

export function ReaderErrorBanner({
  error,
  autoPaused,
  maxAutoFailures,
  onDismiss,
}: {
  error: string;
  autoPaused: boolean;
  maxAutoFailures: number;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[70] bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="text-xs text-red-300 flex-1">
        {error}
        {autoPaused && (
          <>
            {" "}
            <strong className="font-semibold">
              Auto-generation paused after {maxAutoFailures} consecutive failures.
            </strong>{" "}
            Use Retry on the chapter once the cause is fixed.
          </>
        )}
      </span>
      <button type="button" aria-label="Dismiss error" onClick={onDismiss} className="text-red-400/50 hover:text-red-400"><X className="w-4 h-4" aria-hidden="true" /></button>
    </div>
  );
}

export function StoryFailureBanner({
  generationError,
  onRetryFromCreate,
}: {
  generationError: string;
  onRetryFromCreate: () => void;
}) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[65] bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-red-300 font-semibold">Story generation failed</p>
        <p className="text-xs text-red-300/60">{generationError}</p>
      </div>
      <button onClick={onRetryFromCreate}
        className="px-3 py-1.5 text-xs text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20">
        Retry from Create
      </button>
    </div>
  );
}

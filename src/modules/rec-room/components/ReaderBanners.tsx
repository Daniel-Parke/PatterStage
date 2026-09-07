// ── ReaderBanners — the two fixed banners above the reader.
// ReaderErrorBanner is the dismissible per-action error, including the
// auto-generation pause note; StoryFailureBanner is the sticky one for a
// story whose generation failed outright. Both are alerts painted from the
// status ladder's fail rung and layered on the z ladder, not on raw red and
// an arbitrary z of 70 (U12, T-0126). The error state and the retry route
// stay on the page.

"use client";

import { AlertTriangle, X } from "lucide-react";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { statusToneClasses } from "@/lib/theme";

const FAIL = statusToneClasses.fail;

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
    <div role="alert" className={`fixed left-0 right-0 top-0 z-toast flex items-center gap-2 border-b px-4 py-2 ${FAIL.border} ${FAIL.fill}`}>
      <AlertTriangle className={`h-4 w-4 shrink-0 ${FAIL.text}`} aria-hidden="true" />
      <span className="flex-1 text-body text-ps-text-primary">
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
      <IconButton icon={X} label="Dismiss error" size="sm" onClick={onDismiss} />
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
    <div role="alert" className={`fixed left-0 right-0 top-0 z-overlay flex items-center gap-3 border-b px-4 py-3 ${FAIL.border} ${FAIL.fill}`}>
      <AlertTriangle className={`h-5 w-5 shrink-0 ${FAIL.text}`} aria-hidden="true" />
      <div className="flex-1">
        <p className="text-body font-semibold text-ps-text-primary">Story generation failed</p>
        <p className="text-body text-ps-text-secondary">{generationError}</p>
      </div>
      <Button variant="danger" size="sm" onClick={onRetryFromCreate}>
        Retry from Create
      </Button>
    </div>
  );
}

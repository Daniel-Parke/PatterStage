// ═════════════════════════════════════════════════════════════
// LoadingSpinner — something is happening.
//
// For a page, prefer PageLoading: a spinner says that something is happening
// and nothing about what, and replacing a 900px list with a 40px spinner is
// most of the 0.09-0.10 CLS measured on three Results screens. This stays for
// the inline case - a panel refreshing inside a page that has already drawn.
//
// EmptyState used to live here too, which is how nine callers came to import
// "LoadingSpinner" to render "no sessions yet". It has its own file (T-0122).
// ═════════════════════════════════════════════════════════════

import { Loader2 } from "lucide-react";

export function LoadingSpinner({
  text = "Loading...",
}: {
  text?: string;
}) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-ps-text-secondary">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-mono text-body">{text}</span>
      </div>
    </div>
  );
}

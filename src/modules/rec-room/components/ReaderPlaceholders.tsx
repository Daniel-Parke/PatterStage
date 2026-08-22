// ── ReaderPlaceholders — the reader's two pre-render states.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx: the
// spinner while the story loads, and the not-found card with its way
// back to the dashboard.

"use client";

import { Loader2 } from "lucide-react";

export function ReaderLoading() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
    </div>
  );
}

export function ReaderNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-white/40 mb-4">Story not found</p>
        <button onClick={onBack} className="text-xs text-neon-purple">← Back to Dashboard</button>
      </div>
    </div>
  );
}

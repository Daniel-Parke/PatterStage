"use client";

// ═══════════════════════════════════════════════════════════════
// Global Error Boundary — Catches render/effect errors gracefully
// Prevents raw error messages from flashing in the UI.
// ═══════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging but don't display raw messages
    console.error("Control Hub error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-dark-950 grid-bg flex items-center justify-center">
      <div className="max-w-md text-center px-6 py-12">
        <AlertTriangle className="w-12 h-12 text-neon-orange/60 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-white/50 mb-6">
          The application encountered an unexpected error. This is usually
          temporary — try refreshing the page.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/25 transition-colors font-mono text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
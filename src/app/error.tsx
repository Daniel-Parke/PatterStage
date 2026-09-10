"use client";

// ═══════════════════════════════════════════════════════════════
// Global Error Boundary — Catches render/effect errors gracefully
// Prevents raw error messages from flashing in the UI.
// ═══════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import Button from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging but don't display raw messages
    console.error("PatterStage error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ps-surface-ground grid-bg flex items-center justify-center">
      <div className="max-w-md text-center px-6 py-12">
        <AlertTriangle className="w-12 h-12 text-neon-orange/90 mx-auto mb-4" />
        <h1 className="text-title font-bold text-ps-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-body text-ps-text-muted mb-6">
          The application encountered an unexpected error. This is usually
          temporary — try refreshing the page.
        </p>
        <Button variant="primary" color="cyan" icon={RefreshCw} onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
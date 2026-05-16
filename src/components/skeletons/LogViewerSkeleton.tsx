// ═══════════════════════════════════════════════════════════════
// LogViewerSkeleton — Full-page skeleton for /logs
// Matches layout: header + file sidebar + log terminal
// Wraps in AppPageShell to match the Logs page.
// ═══════════════════════════════════════════════════════════════

import AppPageShell from "@/components/layout/AppPageShell";

// Pre-computed widths for log line bars — stable across renders
// (Math.random() in render violates React purity rules)
const LOG_BAR_WIDTHS = [65, 45, 80, 55, 35, 70, 50, 60, 40, 75, 55, 65, 45, 70, 50];

export function LogViewerSkeleton() {
  return (
    <AppPageShell>
      {/* Header */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
            <div className="space-y-1">
              <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-48 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-7 w-16 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-7 w-24 rounded-lg bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content: sidebar + terminal */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 px-6 py-6 min-h-0">
        {/* File sidebar skeleton */}
        <aside className="w-full lg:w-72 shrink-0 rounded-xl border border-white/10 bg-dark-900/40 p-3 animate-pulse">
          <div className="h-3 w-16 rounded bg-white/10 mb-3" />
          <div className="h-9 w-full rounded-lg bg-white/10 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-white/10" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 rounded bg-white/10" />
                  <div className="h-2.5 w-12 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Terminal skeleton */}
        <div className="flex-1 rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden flex flex-col animate-pulse">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-dark-800/50">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
            <div className="h-3 w-32 rounded bg-white/10 ml-2" />
          </div>
          <div className="p-4 flex-1 space-y-2.5">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-baseline">
                <div className="h-3 w-16 rounded bg-white/10 shrink-0" />
                <div className="h-3 w-12 rounded bg-white/10 shrink-0" />
                <div
                  className="h-3 rounded bg-white/10"
                  style={{ width: `${LOG_BAR_WIDTHS[i]}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}

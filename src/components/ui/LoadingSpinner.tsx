// ═══════════════════════════════════════════════════════════════
// Loading & Empty State Components
// ═══════════════════════════════════════════════════════════════

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
        <span className="font-mono text-sm">{text}</span>
      </div>
    </div>
  );
}

/**
 * The empty state. Only after a SUCCESSFUL read: a page that renders this over
 * a failed fetch is lying, and the read contract (T-0096) says the failure is
 * a LoadErrorBanner with a Retry instead. `ErrorBanner` used to live beside
 * this, a message with no way to retry; it is gone, and LoadErrorBanner is the
 * one error surface.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-10 h-10 text-white/20 mb-3" />
      <h3 className="text-sm font-medium text-ps-text-muted">{title}</h3>
      {description && (
        <p className="text-xs text-ps-text-faint mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

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

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 mb-4">
      <p className="text-red-400 text-sm font-mono">{message}</p>
    </div>
  );
}

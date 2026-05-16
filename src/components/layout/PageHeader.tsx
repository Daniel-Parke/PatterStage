// ═══════════════════════════════════════════════════════════════
// Page Header Component
// ═══════════════════════════════════════════════════════════════

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { AccentColor } from "@/types/hermes";
import { shellHeaderBarClasses, iconColorMap } from "@/lib/theme";
import { StatusDot } from "@/components/ui/Card";

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  color?: AccentColor;
  backHref?: string;
  backLabel?: string;
  /** When true, show only the back arrow (no BACK label). */
  backIconOnly?: boolean;
  status?: "online" | "warning" | "error" | "idle";
  actions?: React.ReactNode;
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  color = "cyan",
  backHref,
  backLabel = "BACK",
  backIconOnly = false,
  status,
  actions,
}: PageHeaderProps) {
  return (
    <header
      className={`${shellHeaderBarClasses} sticky top-0 z-30 justify-between gap-4 w-full`}
    >
      <div className="flex items-center gap-4 min-w-0">
        {backHref && (
          <>
            <Link
              href={backHref}
              className={`flex items-center text-white/40 hover:text-white transition-colors shrink-0 ${
                backIconOnly ? "" : "gap-2"
              }`}
              aria-label={backIconOnly ? backLabel : undefined}
            >
              <ArrowLeft className="w-4 h-4" />
              {!backIconOnly && (
                <span className="text-sm font-mono">{backLabel}</span>
              )}
            </Link>
            {!backIconOnly && <div className="w-px h-6 bg-white/20 shrink-0" />}
          </>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-5 h-5 shrink-0 ${iconColorMap[color]}`} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 truncate">
              {title}
              {status && <StatusDot status={status} pulse />}
            </h1>
            {subtitle && (
              <p className="text-xs text-white/40 font-mono truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}

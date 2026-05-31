// ═══════════════════════════════════════════════════════════════
// Hindsight Health Banner — shows when Hindsight is unavailable
// ═══════════════════════════════════════════════════════════════

import { RefreshCw } from "lucide-react";
import { ErrorBanner } from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import type { HealthState } from "./types";

interface HealthBannerProps {
  health: HealthState;
  loadingInitial: boolean;
  onRetry: () => void;
}

export default function HealthBanner({ health, loadingInitial, onRetry }: HealthBannerProps) {
  if (loadingInitial || health.available) return null;

  const message =
    health.error?.includes("Redis")
      ? "Redis is not running. Start Redis to enable memory features: redis-server"
      : health.message
        ? `Hindsight ${health.mode}: ${health.message}`
        : `Hindsight ${health.mode}: ${health.error || "not responding"}`;

  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex-1">
        <ErrorBanner message={message} />
      </div>
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
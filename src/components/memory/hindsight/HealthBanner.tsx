// ═══════════════════════════════════════════════════════════════
// Hindsight Health Banner — shows when Hindsight is unavailable
// ═══════════════════════════════════════════════════════════════

import { RefreshCw } from "lucide-react";
import { ErrorBanner } from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import { healthBannerMessage } from "./health-message";
import type { HealthState } from "./types";

interface HealthBannerProps {
  health: HealthState;
  loadingInitial: boolean;
  onRetry: () => void;
}

export default function HealthBanner({ health, loadingInitial, onRetry }: HealthBannerProps) {
  if (loadingInitial || health.available) return null;

  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex-1">
        <ErrorBanner message={healthBannerMessage(health)} />
      </div>
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}